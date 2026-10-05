// The doors that the runner needs: a claim that goes back for a quota that is spent, the three
// waits of the runner as one strict read, and a proposal that carries its idempotency key. Each
// gesture runs inside a transaction that rolls back, so the census tests count the same rows
// before and after.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const DOCUMENT = 'doc_runner_doors';
const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const CALL_DIGEST = 'c'.repeat(64);

const PUT = `SELECT public.put_document($1, 'file', 'A test of the runner doors',
  'raw/runner-doors.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-01'::date)`;
const ENQUEUE = `SELECT public.enqueue_job($1, 'extract_text')`;

const claimed = z.array(z.object({ job_id: z.uuid(), job_document: z.string() }));
const jobs = z.array(
  z.object({
    status: z.string(),
    attempts: z.number().int(),
    claimed_at: z.date().nullable(),
    claimed_by: z.string().nullable(),
  }),
);
const READ_JOB = 'SELECT status, attempts, claimed_at, claimed_by FROM public.jobs WHERE id = $1';

const ids = z.array(z.object({ id: z.uuid() }));

const inside = async <T>(work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

// A refusal aborts the transaction, so the reset runs on success alone and the rollback does the
// rest.
const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

// Departure: the queue holds the seeded jobs, so the test claims until its own document comes up.
const running = async (ask: Ask): Promise<string> => {
  await ask(PUT, [DOCUMENT]);
  await ask(ENQUEUE, [DOCUMENT]);
  return as(ask, 'gabriel_agent', async () => {
    for (let round = 0; round < 1000; round += 1) {
      const [row] = claimed.parse(await ask('SELECT * FROM public.claim_job()'));
      if (row === undefined) break;
      if (row.job_document === DOCUMENT) return row.job_id;
    }
    throw new Error('The queue held no job for the test document.');
  });
};

const release = (ask: Ask, id: string): Promise<readonly unknown[]> =>
  as(ask, 'gabriel_agent', () => ask('SELECT public.release_job_for_quota($1)', [id]));

const jobOf = async (ask: Ask, id: string): Promise<z.infer<typeof jobs>[number]> => {
  const [job] = jobs.parse(await ask(READ_JOB, [id]));
  if (job === undefined) throw new Error('The job row is absent.');
  return job;
};

test('a release for quota returns the job to the queue with the count it had before the claim', async () => {
  const held = await inside(async (ask) => {
    const id = await running(ask);
    const before = await jobOf(ask, id);
    await release(ask, id);
    return { before, after: await jobOf(ask, id) };
  });
  expect(held.before).toMatchObject({ status: 'running', attempts: 1 });
  expect(held.after).toStrictEqual({
    status: 'queued',
    attempts: 0,
    claimed_at: null,
    claimed_by: null,
  });
});

test('a release never takes the count below the failures that the row holds', async () => {
  const after = await inside(async (ask) => {
    const id = await running(ask);
    await ask('UPDATE public.jobs SET network_failures = 1 WHERE id = $1', [id]);
    await release(ask, id);
    return jobOf(ask, id);
  });
  expect(after).toMatchObject({ status: 'queued', attempts: 1 });
});

test('a release refuses a job that is not running', async () => {
  await expect(
    inside(async (ask) => {
      await ask(PUT, [DOCUMENT]);
      const [queued] = ids.parse(
        await ask('SELECT public.enqueue_job($1, $2) AS id', [DOCUMENT, 'extract_text']),
      );
      return release(ask, queued?.id ?? '');
    }),
  ).rejects.toThrow(/not running/);
});

const settings = z.array(
  z.object({
    lease_seconds: z.number(),
    quota_wait_seconds: z.number(),
    empty_wait_seconds: z.number(),
  }),
);

test('the runner reads its lease and its two waits in one call, as numbers above zero', async () => {
  const [row] = await inside((ask) =>
    as(ask, 'gabriel_agent', async () =>
      settings.parse(await ask('SELECT * FROM public.runner_settings()')),
    ),
  );
  expect(row).toBeDefined();
  expect(Object.keys(row ?? {}).sort()).toStrictEqual([
    'empty_wait_seconds',
    'lease_seconds',
    'quota_wait_seconds',
  ]);
  for (const value of Object.values(row ?? {})) expect(value).toBeGreaterThan(0);
});

test('an absent row of the runner stops the read and gives no default', async () => {
  await expect(
    inside(async (ask) => {
      await ask("DELETE FROM public.parameter WHERE key = 'runner_quota_wait_seconds'");
      return as(ask, 'gabriel_agent', () => ask('SELECT * FROM public.runner_settings()'));
    }),
  ).rejects.toThrow(/runner_quota_wait_seconds/);
});

const CALL = `SELECT public.record_model_call('extractor', 'v1', 'freellmapi', 'a-model', $1,
  120, 'ok', $2::uuid, 'a-model', 10, 5) AS id`;

const PROPOSE = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A runner door test"}'::jsonb, ARRAY['doc_8f2a41']::text[],
  NULL, NULL, '{}', NULL, false, $1::uuid, $2::text) AS id`;

const propose = async (
  ask: Ask,
  role: string,
  call: string | null,
  key: string | null,
): Promise<string> => {
  const [row] = await as(ask, role, async () => ids.parse(await ask(PROPOSE, [call, key])));
  if (row === undefined) throw new Error('no row came back');
  return row.id;
};

const callOf = async (ask: Ask, job: string): Promise<string> => {
  const [row] = await as(ask, 'gabriel_agent', async () =>
    ids.parse(await ask(CALL, [CALL_DIGEST, job])),
  );
  if (row === undefined) throw new Error('no call came back');
  return row.id;
};

const COUNT = 'SELECT count(*)::int AS n FROM public.proposals WHERE idempotency_key = $1';
const counted = z.array(z.object({ n: z.number().int() }));

test('one key stores one proposal, and a second write with that key returns the first', async () => {
  const held = await inside(async (ask) => {
    const job = await running(ask);
    const first = await propose(ask, 'gabriel_agent', await callOf(ask, job), KEY_A);
    const again = await propose(ask, 'gabriel_agent', await callOf(ask, job), KEY_A);
    return { first, again, rows: counted.parse(await ask(COUNT, [KEY_A])) };
  });
  expect(held.again).toBe(held.first);
  expect(held.rows).toStrictEqual([{ n: 1 }]);
});

test('two keys store two proposals', async () => {
  const held = await inside(async (ask) => {
    const job = await running(ask);
    const first = await propose(ask, 'gabriel_agent', await callOf(ask, job), KEY_A);
    const second = await propose(ask, 'gabriel_agent', await callOf(ask, job), KEY_B);
    return { first, second };
  });
  expect(held.second).not.toBe(held.first);
});

test('a key that is not a digest of 64 hexadecimal characters is refused', async () => {
  await expect(
    inside(async (ask) => {
      const job = await running(ask);
      return propose(ask, 'gabriel_agent', await callOf(ask, job), 'not a digest');
    }),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_key_is_digest' });
});

test('a proposal of the operator carries no key', async () => {
  await expect(
    inside(async (ask) => {
      return propose(ask, 'gabriel_app', null, KEY_A);
    }),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_key_is_machine' });
});
