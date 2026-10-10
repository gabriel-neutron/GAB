import { z } from 'zod';

import { askWriter } from '@/shared/write/door';
import type { WriteResult } from '@/shared/write/write-state';

// Departure: two exports, one job. The operator reads the pairs with one IMO number and merges
// each one. The read is private, so both go through the writer.

/** One vessel of a pair: its identifier and its name. */
export interface PairedVessel {
  readonly id: string;
  readonly label: string;
}

/** Two vessels of the record with one IMO number. */
export interface ImoPair {
  readonly imo: string;
  readonly first: PairedVessel;
  readonly second: PairedVessel;
}

/** The pairs, or the sentence that says why the page holds none. */
export type PairsRead =
  | { readonly state: 'held'; readonly pairs: readonly ImoPair[] }
  | { readonly state: 'private'; readonly why: string };

const NO_WRITER =
  'The pairs of vessels are private, and the write service on this machine did not give them. ' +
  'Start the write service, then open this page again.';

const vessel = z.object({ id: z.string(), label: z.string() });
const held = z.object({
  pairs: z.array(z.object({ imo: z.string(), first: vessel, second: vessel })),
});

/** Reads the pairs of vessels of the record with one IMO number. It raises nothing. */
export async function readImoPairs(): Promise<PairsRead> {
  const read = await askWriter('/private/imo-pairs', {}, held);
  switch (read.step) {
    case 'done':
      return { state: 'held', pairs: read.pairs };
    case 'refused':
      return { state: 'private', why: `The pairs cannot be read: ${read.refusal}` };
    case 'unknown':
      return { state: 'private', why: NO_WRITER };
  }
}

/** Merge the absorbed vessel into the survivor, and keep the absorbed name as a former name of
 * the survivor. A lost answer is a doubt: the merge may stand. */
export async function mergeImoPair(
  survivorId: string,
  absorbedId: string,
): Promise<WriteResult<{ readonly proposalId: string }>> {
  const result = await askWriter(
    '/write/merge-entities',
    { survivorId, absorbedId, keepName: true },
    z.object({ proposalId: z.string() }),
  );
  // The writer starts a refusal with the field of the body to correct. The page sends the body
  // itself, so the operator has no field to correct and reads the sentence alone.
  return result.step === 'refused'
    ? { ...result, refusal: result.refusal.replace(/^(?:survivorId|absorbedId): /u, '') }
    : result;
}
