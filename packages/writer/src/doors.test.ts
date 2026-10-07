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
  targetId: z.string().optional(),
  state: z.string().optional(),
});

// An act door never reaches the raw store, so these two doors refuse every object.
const NO_STORE = { put: () => Promise.reject(new Error('no act door reaches the raw store')) };
const NO_READ = { read: () => Promise.reject(new Error('no act door reads the raw store')) };

const lostSocket = (): Error => Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });

const postText = async (
  pool: Sessions,
  door: string,
  text: string,
): Promise<[number, z.infer<typeof replyShape>]> => {
  const answer = await writeRoutes(pool, NO_STORE, NO_READ).request(`/write/${door}`, {
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

const privateRead = async (
  pool: Sessions,
  door: string,
  body: unknown,
): Promise<[number, unknown]> => {
  const answer = await writeRoutes(pool, NO_STORE, NO_READ).request(door, {
    method: 'POST',
    headers: { host: '127.0.0.1:5177', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return [answer.status, await answer.json()];
};

const DOCUMENT = { documentId: 'doc_0123456789ab' };

const ENTITY = { type: 'vessel', label: 'MV Northern Ledger' };

// Departure: each failure is logged whole for the operator, and the log is not under test.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// The act and its promotion run in one statement, so a lost answer names no act: the browser
// reads the record again before the operator acts.
test('a lost answer to a signed act is a doubt, and never a 422 refusal', async () => {
  const held = faultyPool([{ on: 'sign_change', cause: lostSocket() }]);

  expect(await post(held.pool, 'create-entity', ENTITY)).toStrictEqual([502, { doubt: DOUBT }]);
  expect(held.releases()).toBe(1);
});

test('a lost decision is a doubt, and never a 422 refusal', async () => {
  const held = faultyPool([{ on: 'promote_proposal', cause: lostSocket() }]);

  expect(await post(held.pool, 'promote-proposal', { proposalId: held.proposalId })).toStrictEqual([
    502,
    { doubt: DOUBT },
  ]);
});

test('a signed act answers the proposal and the row it wrote', async () => {
  const held = faultyPool([]);

  expect(await post(held.pool, 'create-entity', ENTITY)).toStrictEqual([
    200,
    { proposalId: held.proposalId, targetId: held.targetId, state: 'signed' },
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

// A lost answer of a queue door may stand as a job, so it is a doubt on every door.
test.each([
  ['/write/queue-extraction', 'enqueue_job', DOCUMENT],
  ['/write/document-jobs', 'document_jobs', DOCUMENT],
  ['/write/start-lead', 'start_lead', { lead: 'a company and its vessels' }],
  ['/private/leads', 'lead_jobs', {}],
  ['/private/passages', 'citation', { proposalIds: [] }],
])('a lost answer on %s is a doubt, and the client goes back', async (door, on, body) => {
  const held = faultyPool([{ on, cause: lostSocket() }]);

  expect(await privateRead(held.pool, door, body)).toStrictEqual([502, { doubt: DOUBT }]);
  expect(held.releases()).toBe(1);
});

test.each([
  ['/write/queue-extraction', DOCUMENT],
  ['/write/start-lead', { lead: 'a company and its vessels' }],
  ['/private/passages', { proposalIds: [] }],
])('a pool that gives no client answers 503 on %s', async (door, body) => {
  expect(await privateRead(unreachablePool(), door, body)).toStrictEqual([
    503,
    { refusal: UNREACHABLE },
  ]);
});
