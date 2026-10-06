// The doors that the runner needs: the requeue of the jobs that a crash left running, the wait of
// the runner as one strict read, and a proposal that carries its idempotency key. Each gesture
// runs inside a transaction that rolls back, so the census tests count the same rows before and
// after.

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
    claimed_at: z.date().nullable(),
    claimed_by: z.string().nullable(),
  }),
);
const READ_JOB = 'SELECT status, claimed_at, claimed_by FROM public.jobs WHERE id = $1';

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

const jobOf = async (ask: Ask, id: string): Promise<z.infer<typeof jobs>[number]> => {
  const [job] = jobs.parse(await ask(READ_JOB, [id]));
  if (job === undefined) throw new Error('The job row is absent.');
  return job;
};

const OTHER = 'doc_runner_doors_other';

test('the requeue returns the running jobs of its caller, and leaves the job of another role', async () => {
  const held = await inside(async (ask) => {
    const mine = await running(ask);
    await ask(PUT.replace('runner-doors.pdf', 'runner-doors-other.pdf'), [OTHER]);
    const [other] = ids.parse(
      await ask('SELECT public.enqueue_job($1, $2) AS id', [OTHER, 'extract_text']),
    );
    if (other === undefined) throw new Error('The seed queued no job.');
    await ask("UPDATE public.jobs SET status = 'running', claimed_at = now() WHERE id = $1", [
      other.id,
    ]);
    const [count] = await as(ask, 'gabriel_agent', () =>
      ask('SELECT public.requeue_running_jobs() AS n'),
    );
    return { count, mine: await jobOf(ask, mine), other: await jobOf(ask, other.id) };
  });
  expect(held.count).toStrictEqual({ n: 1 });
  expect(held.mine).toStrictEqual({ status: 'queued', claimed_at: null, claimed_by: null });
  expect(held.other).toMatchObject({ status: 'running', claimed_by: 'gabriel' });
});

const settings = z.array(z.object({ empty_wait_seconds: z.number() }));

test('the runner reads its wait on an empty queue, as a number above zero', async () => {
  const rows = await inside((ask) =>
    as(ask, 'gabriel_agent', async () =>
      settings.parse(await ask('SELECT * FROM public.runner_settings()')),
    ),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]?.empty_wait_seconds).toBeGreaterThan(0);
});

test('an absent row of the runner stops the read and gives no default', async () => {
  await expect(
    inside(async (ask) => {
      await ask("DELETE FROM public.parameter WHERE key = 'runner_empty_wait_seconds'");
      return as(ask, 'gabriel_agent', () => ask('SELECT * FROM public.runner_settings()'));
    }),
  ).rejects.toThrow(/runner_empty_wait_seconds/);
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
