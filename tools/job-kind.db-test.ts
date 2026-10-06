import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const WITH_BYTES = 'doc_job_kind_bytes';
const ADDRESS_ONLY = 'doc_job_kind_address';

const PUT_WITH_BYTES = `SELECT public.put_document($1, 'file', 'A test of the job kind',
  'raw/job-kind-test.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-01'::date) AS id`;

const PUT_ADDRESS_ONLY = `SELECT public.put_document($1, 'url', 'A test of the job kind',
  NULL, 'https://example.test/job-kind', NULL, NULL, NULL, NULL) AS id`;

const jobs = z.array(
  z.object({ kind: z.string(), status: z.string(), ended: z.boolean(), claimed: z.boolean() }),
);

const JOBS_OF = `SELECT kind, status, finished_at IS NOT NULL AS ended, claimed_at IS NOT NULL AS claimed
  FROM public.jobs WHERE document_id = $1 ORDER BY kind, created_at`;

const claimed = z.array(
  z.object({ job_id: z.uuid(), job_document: z.string(), job_kind: z.string() }),
);

// Departure: the queue holds the seeded jobs, so a test claims until its own document comes up.
const claimUntil = async (ask: Ask, document: string): Promise<z.infer<typeof claimed>[number]> => {
  for (;;) {
    const [row] = claimed.parse(await ask('SELECT * FROM public.claim_job()'));
    if (row === undefined) throw new Error(`The queue held no job for ${document}.`);
    if (row.job_document === document) return row;
  }
};

test('storing a file writes one store_only job that is born done', async () => {
  const held = await rolledBack('app', async (ask) => {
    await ask(PUT_WITH_BYTES, [WITH_BYTES]);
    return jobs.parse(await ask(JOBS_OF, [WITH_BYTES]));
  });
  expect(held).toStrictEqual([{ kind: 'store_only', status: 'done', ended: true, claimed: false }]);
});

test('the table refuses a store_only job that is not done', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      await ask(PUT_WITH_BYTES, [WITH_BYTES]);
      await ask(`INSERT INTO public.jobs (document_id, kind) VALUES ($1, 'store_only')`, [
        WITH_BYTES,
      ]);
    }),
  ).rejects.toMatchObject({ code: '23514', constraint: 'jobs_store_only_is_done' });
});

test('enqueue_job refuses a document with no bytes', async () => {
  await expect(
    rolledBack('app', async (ask) => {
      await ask(PUT_ADDRESS_ONLY, [ADDRESS_ONLY]);
      await ask("SELECT public.enqueue_job($1, 'extract_text')", [ADDRESS_ONLY]);
    }),
  ).rejects.toThrow(/no bytes/);
});

// A second reading is not queued any more, so its kind is refused as `store_only` is.
for (const kind of ['store_only', 'second_read'])
  test(`enqueue_job refuses the kind ${kind}`, async () => {
    await expect(
      rolledBack('app', async (ask) => {
        await ask(PUT_WITH_BYTES, [WITH_BYTES]);
        await ask('SELECT public.enqueue_job($1, $2)', [WITH_BYTES, kind]);
      }),
    ).rejects.toMatchObject({ code: '22023' });
  });

test('enqueue_job refuses a second open job of one kind and accepts another kind', async () => {
  const held = await rolledBack('app', async (ask) => {
    await ask(PUT_WITH_BYTES, [WITH_BYTES]);
    await ask("SELECT public.enqueue_job($1, 'extract_text')", [WITH_BYTES]);
    await ask('SAVEPOINT second');
    let refusal: unknown = null;
    try {
      await ask("SELECT public.enqueue_job($1, 'extract_text')", [WITH_BYTES]);
    } catch (error: unknown) {
      refusal = error;
      await ask('ROLLBACK TO SAVEPOINT second');
    }
    await ask("SELECT public.enqueue_job($1, 'map_structured')", [WITH_BYTES]);
    return { refusal, rows: jobs.parse(await ask(JOBS_OF, [WITH_BYTES])) };
  });
  expect(held.refusal).toMatchObject({ code: '23505' });
  expect(held.rows.map((row) => `${row.kind}:${row.status}`)).toStrictEqual([
    'extract_text:queued',
    'map_structured:queued',
    'store_only:done',
  ]);
});

test('claim_job returns the kind and never returns a store_only row', async () => {
  const kinds = await rolledBack('superuser', async (ask) => {
    await ask(PUT_WITH_BYTES, [WITH_BYTES]);
    await ask("SELECT public.enqueue_job($1, 'extract_text')", [WITH_BYTES]);
    const taken: string[] = [];
    for (let round = 0; round < 1000; round += 1) {
      const [row] = claimed.parse(await ask('SELECT * FROM public.claim_job()'));
      if (row === undefined) break;
      taken.push(row.job_kind);
    }
    return taken;
  });
  expect(kinds).toContain('extract_text');
  expect(kinds).not.toContain('store_only');
});

test('complete_job ends a running job and refuses one that is not running', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    await ask(PUT_WITH_BYTES, [WITH_BYTES]);
    await ask("SELECT public.enqueue_job($1, 'extract_text')", [WITH_BYTES]);
    let refusal: unknown = null;
    await ask('SAVEPOINT queued');
    const [queued] = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        await ask("SELECT id FROM public.jobs WHERE document_id = $1 AND kind = 'extract_text'", [
          WITH_BYTES,
        ]),
      );
    try {
      await ask('SELECT public.complete_job($1)', [queued?.id]);
    } catch (error: unknown) {
      refusal = error;
      await ask('ROLLBACK TO SAVEPOINT queued');
    }
    const job = await claimUntil(ask, WITH_BYTES);
    await ask('SELECT public.complete_job($1)', [job.job_id]);
    return { refusal, rows: jobs.parse(await ask(JOBS_OF, [WITH_BYTES])) };
  });
  expect((held.refusal as Error).message).toMatch(/not running/);
  expect(held.rows).toContainEqual({
    kind: 'extract_text',
    status: 'done',
    ended: true,
    claimed: true,
  });
});
