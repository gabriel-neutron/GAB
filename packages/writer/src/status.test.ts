import { expect, test } from 'vitest';

import { faultyPool } from './faulty-pool.ts';
import { TEST_OPERATOR_KEY } from './operator-fixture.ts';
import { writeRoutes } from './routes.ts';

const NO_STORE = { put: () => Promise.reject(new Error('the status reads no store')) };
const NO_READ = { read: () => Promise.reject(new Error('the status reads no store')) };

test('the public status says the writer is online and asks for no key', async () => {
  const { pool } = faultyPool([]);
  const routes = writeRoutes(pool, NO_STORE, NO_READ, TEST_OPERATOR_KEY);
  const answer = await routes.request('/write/status', { headers: { host: '127.0.0.1:5177' } });
  expect(answer.status).toBe(200);
  expect(await answer.json()).toEqual({ online: true });
});
