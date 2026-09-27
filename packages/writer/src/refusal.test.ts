import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { failureFrom, refusalFrom } from './refusal.ts';

const GENERIC = 'the database refused the act';
const UNREACHABLE = 'the database did not answer, and nothing was written';
const DOUBT = 'the record gave no answer to read, and the act may have run whole';

// Departure: each failure is logged whole for the operator, and the log is not under test.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test.each([
  ['23505', 'the act repeats a value that must stay unique'],
  ['23503', 'the act names a document or an element that does not exist'],
  ['23514', 'the act breaks a rule the record holds on its shape'],
  ['22P02', 'a value in the act has the wrong type'],
  ['42501', 'the writer may not sign this act'],
  ['57014', 'the database took too long, and nothing was written'],
  ['57P01', UNREACHABLE],
  ['08006', UNREACHABLE],
  ['08003', UNREACHABLE],
  ['08001', UNREACHABLE],
  ['ECONNREFUSED', UNREACHABLE],
  ['ETIMEDOUT', UNREACHABLE],
  ['ENOTFOUND', UNREACHABLE],
])('the code %s gives its own sentence, and never the text of the server', (code, sentence) => {
  expect(refusalFrom({ code, message: 'a text of the server at 10.0.0.1' })).toBe(sentence);
});

test.each([
  [
    'value coal_stock_t drops a document from the sources of that value',
    'the act keeps the value, so it must keep every document that value already cites',
  ],
  [
    'the entity is an endpoint of a relation',
    'the target is an endpoint of a relation, and it stays',
  ],
  [
    'the target no longer exists, and nothing was applied',
    'the target no longer exists, and nothing was applied',
  ],
  [
    'the act changes neither the name nor the type',
    'the act changes neither the name nor the type of the entity',
  ],
  [
    'proposal 1 is accepted, and only a pending proposal is applied',
    'the act is decided already, and a decided act is frozen',
  ],
  ['a decided act is frozen', 'the act is decided already, and a decided act is frozen'],
  ['the op merge has no write path yet', 'the writer has no path for this act'],
  ['proposal 1f2e does not exist', 'the record holds no act under that name'],
])('the message "%s" gives its own sentence', (message, sentence) => {
  expect(refusalFrom({ code: 'P0001', message })).toBe(sentence);
});

test('a code the map knows wins over a message that a shape reads', () => {
  expect(
    refusalFrom({
      code: '23503',
      message: 'the proposal cites a document that does not exist: doc_1',
    }),
  ).toBe('the act names a document or an element that does not exist');
  expect(refusalFrom({ code: '23505', message: 'proposal 1 does not exist' })).toBe(
    'the act repeats a value that must stay unique',
  );
});

test('a message split over lines is read as one line', () => {
  expect(refusalFrom({ code: 'P0001', message: 'proposal\n  1f2e   does not exist ' })).toBe(
    'the record holds no act under that name',
  );
});

test('a failure the map does not know names the act that stays pending', () => {
  expect(refusalFrom({ code: 'XX000', message: 'an internal fault' }, 'p-1')).toBe(
    `${GENERIC}, and the act stays pending as p-1`,
  );
  expect(refusalFrom({ code: 'XX000', message: 'an internal fault' })).toBe(GENERIC);
});

test('a known sentence never names the act that stays pending', () => {
  expect(refusalFrom({ code: '23505', message: 'a duplicate' }, 'p-1')).toBe(
    'the act repeats a value that must stay unique',
  );
});

// Departure: the two answers are parted by the state PostgreSQL writes on every error it raises.
// A failure that carries none reached no statement, and the act may stand in the record.
test('a failure with no code is a doubt, and a raised failure keeps its refusal', () => {
  const frozen = Object.assign(
    new Error('proposal 1 is accepted, and only a pending proposal is applied'),
    { code: 'P0001' },
  );

  expect(failureFrom(frozen)).toStrictEqual({
    raised: true,
    refusal: 'the act is decided already, and a decided act is frozen',
  });
  expect(failureFrom(new Error('the connection was dropped'))).toStrictEqual({
    raised: false,
    doubt: DOUBT,
  });
});

// Departure: a socket that dies after the commit names a code, and the promotion stands in the
// record. A code that reads as a refusal there tells the analyst that nothing was written.
test('a lost socket and a stopped server are doubts, whatever code they name', () => {
  for (const code of ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', '08006', '57P01', '57P02', '57P03']) {
    expect({ code, ...failureFrom({ code, message: 'the connection was lost' }) }).toStrictEqual({
      code,
      raised: false,
      doubt: DOUBT,
    });
  }
});

// Departure: a missing table and a missing function say `does not exist` too, and they are a
// fault of the writer and not of the act.
test('a schema that is missing never reads as an act the record does not hold', () => {
  for (const shape of [
    { code: '42P01', message: 'relation "public.proposals" does not exist' },
    { code: '42883', message: 'function public.promote_proposal(uuid) does not exist' },
  ]) {
    expect(failureFrom(shape)).toStrictEqual({ raised: true, refusal: GENERIC });
  }
});
