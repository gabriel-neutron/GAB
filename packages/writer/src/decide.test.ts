import { DatabaseError } from 'pg';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { decide } from './decide.ts';
import { faultyPool, unreachablePool } from './faulty-pool.ts';

const DOUBT = 'the record gave no answer to read, and the act may have run whole';

const lostSocket = (): Error => Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });

// Departure: each failure is logged whole for the operator, and the log is not under test.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('a lost answer to a promotion is a doubt that names the act again', async () => {
  const held = faultyPool([{ on: 'promote_proposal', cause: lostSocket() }]);
  const body = JSON.stringify({ proposalId: held.proposalId });

  expect(await decide(held.pool, 'promote_proposal', body)).toStrictEqual({
    outcome: 'undecided',
    reply: { doubt: DOUBT, proposalId: held.proposalId },
  });
  expect(held.releases()).toBe(1);
});

test('a promotion the record raised against is blocked, and it names no act', async () => {
  const frozen = new DatabaseError('only a pending proposal is applied', 34, 'error');
  frozen.code = 'P0001';
  const held = faultyPool([{ on: 'promote_proposal', cause: frozen }]);
  const body = JSON.stringify({ proposalId: held.proposalId });

  expect(await decide(held.pool, 'promote_proposal', body)).toStrictEqual({
    outcome: 'blocked',
    reply: { refusal: 'the act is decided already, and a decided act is frozen' },
  });
});

test('a pool that gives no client is unavailable, and the sentence names no server', async () => {
  const body = JSON.stringify({ proposalId: 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12' });

  expect(await decide(unreachablePool(), 'reject_proposal', body)).toStrictEqual({
    outcome: 'unavailable',
    reply: { refusal: 'the database did not answer, and nothing was written' },
  });
});
