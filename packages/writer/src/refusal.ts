const GENERIC = 'the database refused the act';
const UNREACHABLE = 'the database did not answer, and nothing was written';
const SLOW = 'the database took too long, and nothing was written';

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

const BY_SHAPE: readonly (readonly [string, string])[] = [
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
];

const wordOf = (cause: unknown, key: 'code' | 'message'): string =>
  cause !== null && typeof cause === 'object' && key in cause
    ? String(Reflect.get(cause, key) ?? '')
    : '';

const knownFrom = (code: string, message: string): string | undefined =>
  BY_CODE.get(code) ?? BY_SHAPE.find(([shape]) => message.includes(shape))?.[1];

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
