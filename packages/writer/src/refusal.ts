// Two exports, one job: this file owns every word that a failure becomes, and it owns the one
// test that parts a refusal from a doubt. No other file reads the shape of a raised error.

const GENERIC = 'the database refused the act';
const UNREACHABLE = 'the database did not answer, and nothing was written';
const SLOW = 'the database took too long, and nothing was written';
const DOUBT = 'the record gave no answer to read, and the act may have run whole';

// Every sentence the caller reads is owned here. A message that PostgreSQL composes carries a
// ticket number, a path in this repository and the address of the server, and none of those
// three may reach a screen.
const BY_CODE = new Map<string, string>([
  ['23505', 'the act repeats a value that must stay unique'],
  ['23503', 'the act names a document or an element that does not exist'],
  ['23514', 'an attribute value does not agree with the kind or the format its key declares'],
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

const BY_SHAPE: readonly (readonly [string | RegExp, string])[] = [
  ['drops a document from the sources', 'the act must keep every document the key already cites'],
  ['is an endpoint of a relation', 'the target is an endpoint of a relation, and it stays'],
  [
    'no longer exists, and nothing was applied',
    'the target no longer exists, and nothing was applied',
  ],
  ['only a pending proposal is applied', 'the act is decided already, and a decided act is frozen'],
  ['a decided act is frozen', 'the act is decided already, and a decided act is frozen'],
  ['has no write path yet', 'the writer has no path for this act'],
  ['may not write a proposal', 'the writer may not sign this act'],
  ['cites a document that does not exist', 'the act cites a document the archive does not hold'],
  // Last, and the widest shape of the list: a more exact sentence above must win first. It is
  // held to the sentence the record raises, because `does not exist` alone also reads a missing
  // table or a missing function, and those two are a fault of the writer and not of the act.
  [/^proposal \S+ does not exist$/u, 'the record holds no act under that name'],
];

const wordOf = (cause: unknown, key: 'code' | 'message'): string =>
  cause !== null && typeof cause === 'object' && key in cause
    ? String(Reflect.get(cause, key) ?? '')
    : '';

const reads = (shape: string | RegExp, message: string): boolean =>
  typeof shape === 'string' ? message.includes(shape) : shape.test(message);

const knownFrom = (code: string, message: string): string | undefined =>
  BY_CODE.get(code) ?? BY_SHAPE.find(([shape]) => reads(shape, message))?.[1];

const named = (sentence: string, proposalId: string | null): string =>
  proposalId === null ? sentence : `${sentence}, and the act stays pending as ${proposalId}`;

/** What the database raised, as one sentence this repository owns. It never carries a row. */
export const refusalFrom = (cause: unknown, proposalId: string | null = null): string => {
  const code = wordOf(cause, 'code');
  const message = wordOf(cause, 'message').replaceAll(/\s+/gu, ' ').trim();
  console.error('the database raised', { code, message, cause });
  const known = knownFrom(code, message);
  return known ?? named(GENERIC, proposalId);
};

/** What one failure is. A refusal came from a statement, and nothing was written. A doubt came
 * from no statement, so the act may stand in the record. */
export type Failure =
  | { readonly raised: true; readonly refusal: string }
  | { readonly raised: false; readonly doubt: string };

// A socket that dies and a server that stops each name a code of their own, and neither one
// says the statement did not run. So a code alone cannot part a refusal from a doubt.
const DOUBTFUL = new Set([
  'EPIPE',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  '57P01',
  '57P02',
  '57P03',
]);

// The database names a five-character state on every error it raises while it reads a
// statement. The class 08 is the connection, and the answer of a lost connection is not known.
const STATE = /^[0-9A-Z]{5}$/u;

const raisedBy = (code: string): boolean =>
  STATE.test(code) && !code.startsWith('08') && !DOUBTFUL.has(code);

/** Read one failure. Only a state that the database raised while it read the statement is a
 * refusal. Every other failure is a doubt, and no caller may report one as a refusal. */
export const failureFrom = (cause: unknown): Failure => {
  if (raisedBy(wordOf(cause, 'code'))) return { raised: true, refusal: refusalFrom(cause) };
  console.error('the writer lost the answer', { cause });
  return { raised: false, doubt: DOUBT };
};
