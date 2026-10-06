import { createHash } from 'node:crypto';

import type { Message } from '@gab/model';

/** The six facts that make two writes one act. */
export interface KeyParts {
  readonly documentId: string;
  readonly chunkHash: string;
  readonly readerId: string;
  readonly servedModel: string;
  readonly inputForm: string;
  readonly promptHash: string;
}

// The order is part of the digest. A change of it, or of a part, moves every key in the table, so
// a requeued job after the change would write its proposals a second time.
const ORDER = [
  'documentId',
  'chunkHash',
  'readerId',
  'servedModel',
  'inputForm',
  'promptHash',
] as const satisfies readonly (keyof KeyParts)[];

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

/** The key of one act: one document, one chunk, one reader, one served model, one form of input
 * and one prompt. A second reader of the same chunk has another reader id, so its key differs and
 * its proposal stands beside the first. The key is a digest and the table never reads its parts. */
export const idempotencyKey = (parts: KeyParts): string => {
  for (const name of ORDER)
    if (parts[name].trim() === '')
      throw new Error(`the idempotency key needs a ${name}, and this one is empty`);
  // A JSON array holds each part apart, so 'a' + 'bc' and 'ab' + 'c' are two keys.
  return sha256(JSON.stringify(ORDER.map((name) => parts[name])));
};

/** The digest of what the model was asked. The record of the call holds it and never the prompt,
 * which can quote an untrusted document. */
export const promptDigest = (messages: readonly Message[]): string =>
  sha256(JSON.stringify(messages));
