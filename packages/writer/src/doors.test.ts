import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { faultyPool, unreachablePool } from './faulty-pool.ts';
import type { Sessions } from './pool.ts';
import { writeRoutes } from './routes.ts';

const DOUBT = 'the record gave no answer to read, and the act may have run whole';
const UNREACHABLE = 'the database did not answer, and nothing was written';

const replyShape = z.strictObject({
  refusal: z.string().optional(),
  doubt: z.string().optional(),
  proposalId: z.string().optional(),
});

// An act door never reaches the raw store, so this one refuses every object.
const NO_STORE = { put: () => Promise.reject(new Error('no act door reaches the raw store')) };

const lostSocket = (): Error => Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });

const postText = async (
  pool: Sessions,
  door: string,
  text: string,
): Promise<[number, z.infer<typeof replyShape>]> => {
  const answer = await writeRoutes(pool, NO_STORE).request(`/write/${door}`, {
    method: 'POST',
    headers: { host: '127.0.0.1:5177', 'content-type': 'application/json' },
    body: text,
  });
  return [answer.status, replyShape.parse(await answer.json())];
};

const post = (
  pool: Sessions,
  door: string,
  body: unknown,
): Promise<[number, z.infer<typeof replyShape>]> => postText(pool, door, JSON.stringify(body));

const ENTITY = { type: 'vessel', label: 'MV Northern Ledger' };

// Departure: each failure is logged whole for the operator, and the log is not under test.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('a lost promotion of a signed act answers 409, the doubt and the name of the act', async () => {
  const held = faultyPool([{ on: 'promote_proposal', cause: lostSocket() }]);

  expect(await post(held.pool, 'create-entity', ENTITY)).toStrictEqual([
    409,
    { doubt: DOUBT, proposalId: held.proposalId },
  ]);
});

test('a lost commit of the proposal answers a doubt, and never a 422 refusal', async () => {
  const held = faultyPool([{ on: 'COMMIT', cause: lostSocket() }]);

  expect(await post(held.pool, 'create-entity', ENTITY)).toStrictEqual([
    409,
    { doubt: DOUBT, proposalId: held.proposalId },
  ]);
});

test('a lost decision answers 409, the doubt and the name of the act', async () => {
  const held = faultyPool([{ on: 'promote_proposal', cause: lostSocket() }]);

  expect(await post(held.pool, 'promote-proposal', { proposalId: held.proposalId })).toStrictEqual([
    409,
    { doubt: DOUBT, proposalId: held.proposalId },
  ]);
});

test('a pool that gives no client answers 503 on both doors', async () => {
  expect(await post(unreachablePool(), 'create-entity', ENTITY)).toStrictEqual([
    503,
    { refusal: UNREACHABLE },
  ]);
  expect(
    await post(unreachablePool(), 'reject-proposal', {
      proposalId: 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12',
    }),
  ).toStrictEqual([503, { refusal: UNREACHABLE }]);
});

test.each(['x', '[]', 'null', '"x"'])(
  'a write door refuses the body %s with 422, before it asks the pool for a client',
  async (text) => {
    expect(await postText(unreachablePool(), 'create-entity', text)).toStrictEqual([
      422,
      { refusal: 'the body is not a JSON object' },
    ]);
  },
);

test('a decision door refuses a body that is not JSON with 422', async () => {
  expect(await postText(unreachablePool(), 'promote-proposal', 'x')).toStrictEqual([
    422,
    { refusal: 'the body is not a JSON object' },
  ]);
});

test.each(['[]', 'null', '"x"'])(
  'a decision door refuses the JSON body %s with 422, because it names no act',
  async (text) => {
    expect(await postText(unreachablePool(), 'reject-proposal', text)).toStrictEqual([
      422,
      { refusal: 'the body names no act' },
    ]);
  },
);
