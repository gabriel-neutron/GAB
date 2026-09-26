import { openStore } from '@gab/store/bucket';
import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { claimJob } from './claim.ts';
import { runLayout } from './layout-job.ts';
import { reconcileCorpus } from './reconcile.ts';

// THIS SUITE CALLS THE DOOR AS THE OWNER OF THE DATABASE, because it reads the row it claimed to
// check the mark. What it measures is the lock and the mark, and neither one is a grant: a
// perimeter test holds who may call the door and who may not.
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

// Every claim below runs inside a transaction that rolls back, so the queue this suite met is
// the queue it leaves. The fixture queues one job per document and no path empties the queue, so
// a bound this far above that count means a loop that never ends fails as a test.
const BOUND = 1000;

afterAll(async () => {
  await pool.end();
});

const held = async (work: (client: PoolClient) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  // The release is nested inside its own guard. A ROLLBACK that throws on a dead connection
  // would otherwise keep the client checked out, and the run then waits on the pool for ever
  // instead of reporting the failure that caused it.
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
      expect(taken, 'the queue of the loaded fixture holds a job').not.toBeNull();
      expect(alsoTaken, 'the second worker steps over the locked row').not.toBeNull();
      expect(taken?.id).not.toBe(alsoTaken?.id);
    });
  });
});

const marks = z.array(
  z.object({ status: z.string(), attempts: z.number().int(), claimed_by: z.string() }),
);

const MARK = 'SELECT status, attempts, claimed_by FROM public.jobs WHERE id = $1::uuid';
const SESSION = z.array(z.object({ session_user: z.string() }));

test('a claim marks the row running, stamps the role and counts the attempt', async () => {
  await held(async (client) => {
    const taken = await claimJob(client);
    expect(taken).not.toBeNull();
    const [session] = SESSION.parse((await client.query('SELECT session_user')).rows);
    const found = marks.parse((await client.query(MARK, [taken?.id])).rows);
    expect(found).toStrictEqual([
      { status: 'running', attempts: 1, claimed_by: session?.session_user },
    ]);
  });
});

const queue = z.array(z.object({ id: z.uuid(), status: z.string(), attempts: z.number().int() }));
const QUEUE = 'SELECT id, status, attempts FROM public.jobs ORDER BY id';

test('a layout run and a reconcile run leave every job as they met it', async () => {
  await held(async (client) => {
    const before = queue.parse((await client.query(QUEUE)).rows);
    await runLayout(client);
    await reconcileCorpus(client, openStore());
    const after = queue.parse((await client.query(QUEUE)).rows);
    expect(before.some((job) => job.status === 'queued' && job.attempts === 0)).toBe(true);
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
