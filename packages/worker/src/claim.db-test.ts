import { openStore } from '@gab/store/bucket';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { claimJob } from './claim.ts';
import { runLayout } from './layout-job.ts';
import { reconcileCorpus } from './reconcile.ts';

// Departure: the suite calls the door as the owner of the database, because it reads the row it
// claimed to check the mark. It measures the lock and the mark, and neither one is a grant.
const secrets = z.object({
  POSTGRES_PASSWORD: z.string().min(1),
  GABRIEL_DATABASE: z.literal('gabriel_test'),
});

const ownerPool = (): Pool => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error(
      'POSTGRES_PASSWORD is empty or absent, or GABRIEL_DATABASE is not gabriel_test. Run the ' +
        'suite through its configuration.',
    );
  const password = encodeURIComponent(held.data.POSTGRES_PASSWORD);
  const database = held.data.GABRIEL_DATABASE;
  return new Pool({
    connectionString: `postgresql://gabriel:${password}@127.0.0.1:5432/${database}`,
  });
};

const pool = ownerPool();

// Origin: the queue holds a few fixture jobs and the seeded jobs, and each claim rolls back. A
// bound this far above that count makes a loop that never ends fail as a test.
const BOUND = 1000;

// Departure: the suite queues its own jobs, because a committed claim removes a fixture job for
// ever. Two, because the second worker must find a free row beside the locked one.
const SEEDED = ['doc_claim_suite_first', 'doc_claim_suite_second'];

// External constraint: enqueue_job is the one door that queues a job, and a job needs a document
// that holds bytes. The ledger keeps no act of either row, so the suite can delete both.
const PUT = `SELECT public.put_document(seeded.id, 'file', 'A test of the claim door',
  'raw/claim-suite.pdf', NULL, NULL, NULL, 'application/pdf', '2026-09-27'::date)
  FROM unnest($1::text[]) AS seeded(id)`;
const ENQUEUE = `SELECT public.enqueue_job(seeded.id, 'extract_text')
  FROM unnest($1::text[]) AS seeded(id)`;
const REMOVE_JOBS = 'DELETE FROM public.jobs WHERE document_id = ANY($1::text[])';
const REMOVE_DOCUMENTS = 'DELETE FROM public.documents WHERE id = ANY($1::text[])';

// Departure: the seeded rows are committed, because a second session sees no uncommitted row.
const committed = async (statements: readonly string[]): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of statements) await client.query(statement, [SEEDED]);
    await client.query('COMMIT');
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Departure: the seed first removes the rows of a run that stopped before its cleanup.
beforeAll(async () => {
  await committed([REMOVE_JOBS, REMOVE_DOCUMENTS, PUT, ENQUEUE]);
});

afterAll(async () => {
  try {
    await committed([REMOVE_JOBS, REMOVE_DOCUMENTS]);
  } finally {
    await pool.end();
  }
});

const held = async (work: (client: PoolClient) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  // Departure: a ROLLBACK that throws on a dead connection would keep the client checked out,
  // and the run would wait on the pool for ever instead of reporting the failure.
  try {
    try {
      await client.query('BEGIN');
      await work(client);
    } finally {
      await client.query('ROLLBACK');
    }
  } finally {
    client.release();
  }
};

test('two workers claim at the same time and never take the same row', async () => {
  await held(async (first) => {
    await held(async (second) => {
      const taken = await claimJob(first);
      const alsoTaken = await claimJob(second);
      expect(taken, 'the queue holds the seeded jobs').not.toBeNull();
      expect(alsoTaken, 'the second worker steps over the locked row').not.toBeNull();
      expect(taken?.id).not.toBe(alsoTaken?.id);
    });
  });
});

const marks = z.array(z.object({ status: z.string(), claimed_by: z.string() }));

const MARK = 'SELECT status, claimed_by FROM public.jobs WHERE id = $1::uuid';
const SESSION = z.array(z.object({ session_user: z.string() }));

test('a claim marks the row running and stamps the role', async () => {
  await held(async (client) => {
    const taken = await claimJob(client);
    expect(taken).not.toBeNull();
    const [session] = SESSION.parse((await client.query('SELECT session_user')).rows);
    const found = marks.parse((await client.query(MARK, [taken?.id])).rows);
    expect(found).toStrictEqual([{ status: 'running', claimed_by: session?.session_user }]);
  });
});

const queue = z.array(z.object({ id: z.uuid(), status: z.string() }));
// Departure: the query reads the jobs that this suite queued and no other. Other test files of the
// same run commit and remove jobs of their own in public.jobs at the same time.
const QUEUE = 'SELECT id, status FROM public.jobs WHERE document_id = ANY($1::text[]) ORDER BY id';

test('a layout run and a reconcile run leave every job as they met it', async () => {
  await held(async (client) => {
    const before = queue.parse((await client.query(QUEUE, [SEEDED])).rows);
    await runLayout(client);
    await reconcileCorpus(client, openStore());
    const after = queue.parse((await client.query(QUEUE, [SEEDED])).rows);
    expect(before.some((job) => job.status === 'queued')).toBe(true);
    expect(after).toStrictEqual(before);
  });
});

test('a worker that has claimed every queued job then gets no row', async () => {
  await held(async (client) => {
    const taken: string[] = [];
    for (let round = 0; round < BOUND; round += 1) {
      const job = await claimJob(client);
      if (job === null) break;
      taken.push(job.id);
    }
    expect(taken.length).toBeGreaterThan(0);
    expect(taken.length).toBeLessThan(BOUND);
    expect(new Set(taken).size, 'no row was claimed twice').toBe(taken.length);
  });
});
