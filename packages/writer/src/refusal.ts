import { DatabaseError } from 'pg';

// Departure: two exports, one job. This file owns the one test that parts a refusal from a doubt,
// and the one map from a failure to a sentence. No other file reads the shape of a raised error.

const GENERIC = 'the database refused the act';
const UNREACHABLE = 'the database did not answer, and nothing was written';
const SLOW = 'the database took too long, and nothing was written';
const DOUBT = 'the record gave no answer to read, and the act may have run whole';

// External constraint: a message that PostgreSQL composes carries a table name, a path in this
// repository or the address of the server, and none of those may reach a screen. So a failure
// that no door worded gets the sentence of its code, and never its own text.
const BY_CODE = new Map<string, string>([
  ['23505', 'the act repeats a value that must stay unique'],
  ['23503', 'the act names a document or an element that does not exist'],
  ['23514', 'the act breaks a rule the record holds on its shape'],
  ['22P02', 'a value in the act has the wrong type'],
  ['42501', 'the writer may not sign this act'],
  ['57014', SLOW],
  ['57P01', UNREACHABLE],
  ['08006', UNREACHABLE],
  ['08003', UNREACHABLE],
  ['08001', UNREACHABLE],
  ['ECONNREFUSED', UNREACHABLE],
  ['ETIMEDOUT', UNREACHABLE],
  ['ENOTFOUND', UNREACHABLE],
]);

const wordOf = (cause: unknown, key: 'code' | 'message'): string =>
  cause !== null && typeof cause === 'object' && key in cause
    ? String(Reflect.get(cause, key) ?? '')
    : '';

// External constraint: PostgreSQL names the table of each rule that it checks itself. A door
// names the rule it raises, and no table, so its message is a sentence it wrote for the caller.
// The hint is the field of the request that the caller corrects.
const doorSentence = (cause: unknown): string | undefined => {
  if (!(cause instanceof DatabaseError)) return undefined;
  if (cause.constraint === undefined || cause.table !== undefined) return undefined;
  const sentence = cause.message.replaceAll(/\s+/gu, ' ').trim();
  return cause.hint === undefined || cause.hint === '' ? sentence : `${cause.hint}: ${sentence}`;
};

/** What the database raised, as one sentence. A door states its own; every other failure gets
 * the sentence of its code. It never carries a row of the record. */
export const refusalFrom = (cause: unknown): string => {
  const code = wordOf(cause, 'code');
  console.error('the database raised', { code, cause });
  return doorSentence(cause) ?? BY_CODE.get(code) ?? GENERIC;
};

/** What one failure is. A refusal came from a statement, and nothing was written. A doubt came
 * from no statement, so the act may stand in the record. */
export type Failure =
  | { readonly raised: true; readonly refusal: string }
  | { readonly raised: false; readonly doubt: string };

// External constraint: the pool builds a DatabaseError only from an error message of the server,
// and a socket that dies builds none. Class 08 and these states still end the connection.
const DOUBTFUL = new Set(['57P01', '57P02', '57P03']);

const raisedBy = (cause: unknown): boolean =>
  cause instanceof DatabaseError &&
  !(cause.code ?? '').startsWith('08') &&
  !DOUBTFUL.has(cause.code ?? '');

/** Read one failure. Only an error that the database raised while it read the statement is a
 * refusal. Every other failure is a doubt, and no caller may report one as a refusal. */
export const failureFrom = (cause: unknown): Failure => {
  if (raisedBy(cause)) return { raised: true, refusal: refusalFrom(cause) };
  console.error('the writer lost the answer', { cause });
  return { raised: false, doubt: DOUBT };
};
