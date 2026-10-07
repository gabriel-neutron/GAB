// Migration 0056 gives a claim key to each act that the database already holds, pending and
// decided. The case puts the test database back in the state before 0056, inside a transaction
// that always rolls back, and runs the file.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const MIGRATION = join(import.meta.dirname, '..', 'db', 'migrations', '0056_claim_key.sql');

const BEFORE_0056 = `
  SET LOCAL ROLE gabriel_owner;
  ALTER TABLE proposals DROP COLUMN claim_key;
  RESET ROLE`;

// Departure: the files of this project run at the same time, and the migration changes a table
// that they write. The test takes its lock first, with a short wait, and a wait that ends runs
// the case again.
const LOCK_TIMEOUT = '55P03';

const alone = async <T>(work: (ask: Ask) => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await rolledBack('superuser', async (ask) => {
        await ask("SET LOCAL lock_timeout = '200ms'");
        await ask('LOCK TABLE public.proposals IN ACCESS EXCLUSIVE MODE');
        await ask('SET LOCAL lock_timeout = 0');
        return work(ask);
      });
    } catch (cause) {
      const waited = cause instanceof Error && 'code' in cause && cause.code === LOCK_TIMEOUT;
      if (!waited || attempt === 50) throw cause;
    }
  }
};

const made = z.array(z.object({ id: z.uuid() }));

const proposed = async (ask: Ask, op: string, payload: object): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(
    await ask(`SELECT public.propose_change($1, $2::jsonb, ARRAY['doc_8f2a41']::text[]) AS id`, [
      op,
      JSON.stringify(payload),
    ]),
  );
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('no act came back');
  return row.id;
};

const pair = async (ask: Ask, label: string) => {
  const army = await proposed(ask, 'create_entity', { type: 'military_unit', label });
  const brigade = await proposed(ask, 'create_entity', {
    type: 'military_unit',
    label: `${label} brigade`,
  });
  const link = await proposed(ask, 'create_relation', {
    type: 'subordinate_to',
    src_id: brigade,
    dst_id: army,
  });
  return [army, brigade, link] as const;
};

const keys = z.array(z.object({ id: z.uuid(), claim_key: z.string().nullable() }));

test('each act already held gets the key that a new proposal of the same claim gets', async () => {
  const read = await alone(async (ask) => {
    const rejected = await pair(ask, 'Migration Army');
    const waiting = await pair(ask, 'Waiting Army');
    await ask("SELECT public.reject_unit($1::uuid, 'wrong_value', NULL, 'a test')", [rejected[1]]);
    await ask(BEFORE_0056);
    await ask(await readFile(MIGRATION, 'utf8'));
    await ask('RESET ROLE');
    const again = await pair(ask, ' migration  ARMY');
    const ids = [...rejected, ...waiting, ...again];
    const held = keys.parse(
      await ask('SELECT id, claim_key FROM public.proposals WHERE id = ANY ($1::uuid[])', [ids]),
    );
    const keyOf = (id: string) => held.find((row) => row.id === id)?.claim_key;
    return {
      unkeyed: keys.parse(
        await ask('SELECT id, claim_key FROM public.proposals WHERE claim_key IS NULL'),
      ),
      rejected: rejected.map(keyOf),
      waiting: waiting.map(keyOf),
      again: again.map(keyOf),
    };
  });
  expect(read.unkeyed).toStrictEqual([]);
  expect(read.again).toStrictEqual(read.rejected);
  expect(read.waiting).not.toStrictEqual(read.rejected);
  expect(new Set(read.rejected).size).toBe(3);
});
