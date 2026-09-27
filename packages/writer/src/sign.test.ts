import { DatabaseError } from 'pg';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { faultyPool, unreachablePool } from './faulty-pool.ts';
import { sign } from './sign.ts';

const DOUBT = 'the record gave no answer to read, and the act may have run whole';
const ENTITY = JSON.stringify({ type: 'vessel', label: 'MV Northern Ledger' });

const lostSocket = (): Error => Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });

const deadClient = (): Error =>
  new Error('Client has encountered a connection error and is not queryable');

const raised = (code: string, message: string): DatabaseError => {
  const cause = new DatabaseError(message, message.length, 'error');
  cause.code = code;
  return cause;
};

// Departure: each failure is logged whole for the operator, and the log is not under test.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('a lost answer to the commit of the proposal is a doubt that names the act', async () => {
  const held = faultyPool([
    { on: 'COMMIT', cause: lostSocket() },
    { on: 'ROLLBACK', cause: deadClient() },
  ]);

  expect(await sign(held.pool, 'create_entity', ENTITY)).toStrictEqual({
    outcome: 'undecided',
    reply: { doubt: DOUBT, proposalId: held.proposalId },
  });
  expect(held.releases()).toBe(1);
});

test('a lost answer to the proposal statement is a doubt, and it names no act', async () => {
  const held = faultyPool([{ on: 'propose_change', cause: lostSocket() }]);

  expect(await sign(held.pool, 'create_entity', ENTITY)).toStrictEqual({
    outcome: 'undecided',
    reply: { doubt: DOUBT },
  });
});

test('a lost answer to the commit of the promotion is a doubt, and never a refusal', async () => {
  const held = faultyPool([
    { on: 'COMMIT', time: 2, cause: lostSocket() },
    { on: 'ROLLBACK', cause: deadClient() },
  ]);

  expect(await sign(held.pool, 'create_entity', ENTITY)).toStrictEqual({
    outcome: 'undecided',
    reply: { doubt: DOUBT, proposalId: held.proposalId },
  });
});

test('a stopped server during the promotion is a doubt, and never says nothing was written', async () => {
  const held = faultyPool([
    { on: 'promote_proposal', cause: raised('57P01', 'terminating connection') },
  ]);

  expect(await sign(held.pool, 'create_entity', ENTITY)).toStrictEqual({
    outcome: 'undecided',
    reply: { doubt: DOUBT, proposalId: held.proposalId },
  });
});

test('a proposal the record raised against is a refusal, and a failed rollback keeps its cause', async () => {
  const held = faultyPool([
    { on: 'propose_change', cause: raised('23503', 'the proposal cites a document') },
    { on: 'ROLLBACK', cause: deadClient() },
  ]);

  expect(await sign(held.pool, 'create_entity', ENTITY)).toStrictEqual({
    outcome: 'refused',
    reply: { refusal: 'the act names a document or an element that does not exist' },
  });
});

test('a promotion the record raised against leaves the act pending, and names it', async () => {
  const held = faultyPool([
    { on: 'promote_proposal', cause: raised('P0001', 'the entity is an endpoint of a relation') },
  ]);

  expect(await sign(held.pool, 'create_entity', ENTITY)).toStrictEqual({
    outcome: 'undecided',
    reply: {
      refusal: 'the target is an endpoint of a relation, and it stays',
      proposalId: held.proposalId,
    },
  });
});

test('a pool that gives no client is unavailable, and the sentence names no server', async () => {
  expect(await sign(unreachablePool(), 'create_entity', ENTITY)).toStrictEqual({
    outcome: 'unavailable',
    reply: { refusal: 'the database did not answer, and nothing was written' },
  });
});
