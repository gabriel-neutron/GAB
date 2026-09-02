import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { claimJob } from './claim.ts';

// NO ROLE HOLDS THE CLAIM DOOR WHILE A CLAIM CANNOT BE RELEASED, so this suite calls it as the
// owner of the database. What it measures is the lock and the mark, and neither one is a grant:
// the grants file holds the grant, and a perimeter test holds the refusal of every role.
const secrets = z.object({ POSTGRES_PASSWORD: z.string().min(1) });

const ownerPool = (): Pool => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error('POSTGRES_PASSWORD is empty or absent. Set it in the environment file.');
  const password = encodeURIComponent(held.data.POSTGRES_PASSWORD);
  return new Pool({ connectionString: `postgresql://gabriel:${password}@127.0.0.1:5432/gabriel` });
};

const pool = ownerPool();

// Every claim below runs inside a transaction that rolls back, so the queue this suite met is
// the queue it leaves. A claim outside one would mark a row running with nothing to release it.
const FIRST = 'the first worker';
const SECOND = 'the second worker';

// The loaded fixture queues one job per document it puts through the door, and no path empties
// the queue, so a bound this far above four means a loop that never ends fails as a test.
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
      const taken = await claimJob(first, FIRST);
      const alsoTaken = await claimJob(second, SECOND);
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

test('a claim marks the row running, names the worker and counts the attempt', async () => {
  await held(async (client) => {
    const taken = await claimJob(client, FIRST);
    expect(taken).not.toBeNull();
    const found = marks.parse((await client.query(MARK, [taken?.id])).rows);
    expect(found).toStrictEqual([{ status: 'running', attempts: 1, claimed_by: FIRST }]);
  });
});

test('a worker that has claimed every queued job then gets no row', async () => {
  await held(async (client) => {
    const taken: string[] = [];
    for (let round = 0; round < BOUND; round += 1) {
      const job = await claimJob(client, FIRST);
      if (job === null) break;
      taken.push(job.id);
    }
    expect(taken.length).toBeGreaterThan(0);
    expect(taken.length).toBeLessThan(BOUND);
    expect(new Set(taken).size, 'no row was claimed twice').toBe(taken.length);
  });
});

test('a claim that names no worker is refused', async () => {
  await expect(
    held(async (client) => {
      await claimJob(client, '   ');
    }),
  ).rejects.toMatchObject({ message: 'a claim names the worker that took it' });
});
