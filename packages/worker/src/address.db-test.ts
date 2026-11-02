import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';

import { agentAddress } from './address.ts';

const pool = new Pool({ connectionString: agentAddress(), max: 1 });

afterAll(async () => {
  await pool.end();
});

test('a connection of the agent role runs with JIT off', async () => {
  const { rows } = await pool.query<{ jit: string }>('SHOW jit');
  expect(rows[0]?.jit).toBe('off');
});
