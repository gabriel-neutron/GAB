// The writer suite writes acts the append-only ledger keeps for ever, and the ledger is
// published. The pool of a test run must therefore reach the test database, and never the record.

import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';

const pool = openPool();

afterAll(async () => {
  await pool.end();
});

const reached = z.array(z.object({ name: z.string() })).length(1);

test('the pool of a test run reaches the test database', async () => {
  const found = await pool.query('SELECT current_database() AS name');
  expect(reached.parse(found.rows)).toStrictEqual([{ name: 'gabriel_test' }]);
});
