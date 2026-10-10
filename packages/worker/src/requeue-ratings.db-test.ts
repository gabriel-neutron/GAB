import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from './address.ts';
import type { Queryable } from './queryable.ts';
import { requeuedLine, requeueFailedRatings } from './requeue-ratings.ts';

// Departure: each test runs in one transaction that rolls back. The superuser writes the jobs in
// each state, and the command signs as the operator role.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 1 });

afterAll(async () => {
  await pool.end();
});

type Row = Record<string, unknown>;

const inTransaction = async (
  work: (held: {
    as: (role: string) => Queryable;
    ask: (text: string, values?: unknown[]) => Promise<Row[]>;
  }) => Promise<void>,
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await work({
      as: (role) => ({
        query: async (text, values) => {
          await client.query(`SET LOCAL SESSION AUTHORIZATION ${role}`);
          try {
            return await client.query(text, values);
          } finally {
            await client.query('RESET SESSION AUTHORIZATION');
          }
        },
      }),
      ask: async (text, values) => (await client.query<Row>(text, values)).rows,
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const ENDED = `INSERT INTO public.jobs (kind, author, status, failure_reason, refusal, refused_parts,
                                       claimed_by, claimed_at, finished_at, created_at)
               VALUES ('rate_author', $1, $2, $3, $4, $5, 'gabriel_agent', now(),
                       CASE WHEN $2 IN ('done','failed') THEN now() END, $6)`;

const jobOf = (ask: (text: string, values?: unknown[]) => Promise<Row[]>, author: string) =>
  ask(
    `SELECT status, failure_reason, refusal, refused_parts, claimed_by, claimed_at, finished_at
       FROM public.jobs WHERE kind = 'rate_author' AND author = $1 ORDER BY created_at`,
    [author],
  );

test('a failed rating goes back to the queue with no attempt, and an open or done job stays', async () => {
  await inTransaction(async ({ as, ask }) => {
    const at = '2026-01-01';
    await ask(ENDED, ['fault name', 'failed', 'the service did not answer', null, 0, at]);
    await ask(ENDED, ['refused name', 'failed', '1 of 1 parts refused', 'no reason', 1, at]);
    await ask(ENDED, ['done name', 'done', null, null, 0, at]);
    await ask(ENDED, ['running name', 'running', null, null, 0, at]);

    const requeued = await requeueFailedRatings(as('gabriel_app'));

    // The job row starts again with no attempt, so the door gives the record of the earlier one.
    expect(requeued).toEqual([
      { author: 'fault name', failureReason: 'the service did not answer', refusal: null },
      { author: 'refused name', failureReason: '1 of 1 parts refused', refusal: 'no reason' },
    ]);
    expect(requeued.map(requeuedLine)).toEqual([
      'fault name | earlier reason: the service did not answer',
      'refused name | earlier reason: 1 of 1 parts refused | earlier refusal: no reason',
    ]);
    const fresh = {
      status: 'queued',
      failure_reason: null,
      refusal: null,
      refused_parts: 0,
      claimed_by: null,
      claimed_at: null,
      finished_at: null,
    };
    expect(await jobOf(ask, 'fault name')).toEqual([fresh]);
    expect(await jobOf(ask, 'refused name')).toEqual([fresh]);
    expect((await jobOf(ask, 'done name'))[0]).toMatchObject({ status: 'done' });
    expect((await jobOf(ask, 'running name'))[0]).toMatchObject({ status: 'running' });
  });
});

test('a name with a job that waits keeps its old failed job as it is', async () => {
  await inTransaction(async ({ as, ask }) => {
    await ask(ENDED, ['twice', 'failed', 'the first fault', null, 0, '2026-01-01']);
    await ask(ENDED, ['twice', 'failed', 'the second fault', null, 0, '2026-01-02']);
    await ask(`INSERT INTO public.jobs (kind, author) VALUES ('rate_author', 'waits')`);
    await ask(ENDED, ['waits', 'failed', 'an old fault', null, 0, '2026-01-01']);

    expect(await requeueFailedRatings(as('gabriel_app'))).toEqual([
      { author: 'twice', failureReason: 'the second fault', refusal: null },
    ]);
    expect((await jobOf(ask, 'twice')).map((one) => one['status'])).toEqual(['failed', 'queued']);
    expect((await jobOf(ask, 'waits')).map((one) => one['status']).sort()).toEqual([
      'failed',
      'queued',
    ]);
  });
});

test('a name with a done job and an older failed job is skipped', async () => {
  await inTransaction(async ({ as, ask }) => {
    await ask(ENDED, ['rated', 'failed', 'an old fault', null, 0, '2026-01-01']);
    await ask(ENDED, ['rated', 'done', null, null, 0, '2026-01-02']);

    expect(await requeueFailedRatings(as('gabriel_app'))).toEqual([]);
    expect((await jobOf(ask, 'rated')).map((one) => one['status'])).toEqual(['failed', 'done']);
  });
});

test('the worker role cannot put a rating back in the queue', async () => {
  await inTransaction(async ({ ask }) => {
    // The refusal ends the transaction, so the role stays set until the roll back.
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
    await expect(
      requeueFailedRatings({ query: async (text) => ({ rows: await ask(text) }) }),
    ).rejects.toThrow(/permission denied/u);
  });
});
