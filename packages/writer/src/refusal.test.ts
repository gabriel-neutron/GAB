import { DatabaseError } from 'pg';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { failureFrom, refusalFrom } from './refusal.ts';

const GENERIC = 'the database refused the act';
const UNREACHABLE = 'the database did not answer, and nothing was written';
const DOUBT = 'the record gave no answer to read, and the act may have run whole';

const raisedError = (code: string, message: string): DatabaseError => {
  const raised = new DatabaseError(message, message.length, 'error');
  raised.code = code;
  return raised;
};

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

const doorRaised = (message: string, rule: string, field?: string): DatabaseError => {
  const raised = raisedError('P0001', message);
  raised.constraint = rule;
  raised.hint = field;
  return raised;
};

test('a door gives its own sentence, and the field it names leads', () => {
  expect(
    refusalFrom(
      doorRaised('an interval starts on or before the day it ends', 'rel_dates_order', 'validFrom'),
    ),
  ).toBe('validFrom: an interval starts on or before the day it ends');
  expect(refusalFrom(doorRaised('a decision names who took it', 'decision_named'))).toBe(
    'a decision names who took it',
  );
});

test('a rule that PostgreSQL checks itself names its table, and gives the sentence of its code', () => {
  const composed = raisedError(
    '23514',
    'new row for relation "relations" violates check constraint "rel_dates_order"',
  );
  composed.constraint = 'rel_dates_order';
  composed.table = 'relations';
  expect(refusalFrom(composed)).toBe('the act breaks a rule the record holds on its shape');
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

test('a rule of a type that PostgreSQL checks itself gives the sentence of its code', () => {
  const composed = raisedError(
    '23514',
    'value for domain doc_id violates check constraint "doc_id_check"',
  );
  composed.constraint = 'doc_id_check';
  composed.dataType = 'doc_id';
  expect(refusalFrom(composed)).toBe('the act breaks a rule the record holds on its shape');
});

// Departure: the two answers are parted by the error that PostgreSQL itself raises. Any other
// failure reached no statement that answered, and the act may stand in the record.
test('a failure with no code is a doubt, and a raised failure keeps its refusal', () => {
  const frozen = doorRaised(
    'the act 1 is accepted already, and a decided act is frozen',
    'proposal_pending',
  );

  expect(failureFrom(frozen)).toStrictEqual({
    raised: true,
    refusal: 'the act 1 is accepted already, and a decided act is frozen',
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
    raisedError('42P01', 'relation "public.proposals" does not exist'),
    raisedError('42883', 'function public.promote_unit(uuid) does not exist'),
  ]) {
    expect(failureFrom(shape)).toStrictEqual({ raised: true, refusal: GENERIC });
  }
});

// Departure: a Node errno can take five capitals too, and a socket that fails after the commit
// names one. Only the database builds its own error, so a code alone never makes a refusal.
test('a code that looks like a state is a doubt when the database did not raise it', () => {
  for (const code of ['EBADF', 'EINTR', 'EPERM']) {
    expect(failureFrom(Object.assign(new Error('x'), { code }))).toStrictEqual({
      raised: false,
      doubt: DOUBT,
    });
  }
  expect(failureFrom({ code: '23505', message: 'a duplicate' })).toStrictEqual({
    raised: false,
    doubt: DOUBT,
  });
  expect(failureFrom(raisedError('23505', 'a duplicate'))).toStrictEqual({
    raised: true,
    refusal: 'the act repeats a value that must stay unique',
  });
});

test('a state of the connection is a doubt even when the database raised it', () => {
  for (const code of ['08006', '57P01', '57P02', '57P03']) {
    expect(failureFrom(raisedError(code, 'the connection was lost'))).toStrictEqual({
      raised: false,
      doubt: DOUBT,
    });
  }
});
