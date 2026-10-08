import { z } from 'zod';

import { askWriter } from '@/shared/write/door';

import { decidedAct, decidedRows, type DecidedRow } from './decided';

/** The key of the last act of a page, which the next page starts after. */
export interface DecidedKey {
  readonly decidedAt: string;
  readonly id: string;
}

/** One page of the decided acts, and the key of the next page, or the sentence that says why the
 * page holds none. */
export type DecidedRead =
  | {
      readonly state: 'held';
      readonly rows: readonly DecidedRow[];
      readonly next: DecidedKey | null;
    }
  | { readonly state: 'private'; readonly why: string };

// Origin: decided, not calibrated. One page fills the table of a large screen about four times.
const PAGE_SIZE = 100;

const NO_WRITER =
  'The decided acts are private, because a rejection keeps its reason, and the write service on ' +
  'this machine did not give them. Start the write service, then open this page again.';

const page = z
  .object({
    acts: z.array(decidedAct),
    next: z.object({ decidedAt: z.string(), id: z.string() }).nullable(),
  })
  .transform((read) => ({ rows: decidedRows(read.acts), next: read.next }));

/** Reads the page of the decided acts after the key, or the first page. It raises nothing. */
export async function readDecidedPage(after: DecidedKey | null): Promise<DecidedRead> {
  const read = await askWriter('/private/review-decided', { after, size: PAGE_SIZE }, page);
  return read.step === 'done'
    ? { state: 'held', rows: read.rows, next: read.next }
    : { state: 'private', why: NO_WRITER };
}
