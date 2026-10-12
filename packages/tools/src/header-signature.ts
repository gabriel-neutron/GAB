import { createHash } from 'node:crypto';

/** The signature of a header: the digest of its column names, in their order. Two files with the
 * same signature have the same columns in the same order. */
export const headerSignature = (header: readonly string[]): string =>
  createHash('sha256').update(JSON.stringify(header)).digest('hex');
