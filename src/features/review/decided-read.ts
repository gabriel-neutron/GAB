import { z } from 'zod';

import { askWriter } from '@/shared/write/door';

import { decidedAct, decidedRows, type DecidedRow } from './decided';

/** The key of the last act of a page, which the next page starts after. */
export interface DecidedKey {
  readonly decidedAt: string;
  readonly id: string;
}

/** One page of the decided acts, the count of the acts of the page that this page cannot read,
 * and the key of the next page, or the sentence that says why the page holds none. */
export type DecidedRead =
  | {
      readonly state: 'held';
      readonly rows: readonly DecidedRow[];
      readonly unread: number;
      readonly next: DecidedKey | null;
    }
  | { readonly state: 'private'; readonly why: string };

// Origin: decided, not calibrated. One page fills the table of a large screen about four times.
const PAGE_SIZE = 100;

const NO_WRITER =
  'The decided acts are private, because a rejection keeps its reason, and the write service on ' +
  'this machine did not give them. Start the write service, then open this page again.';

// Each act is read on its own, so one act of an unknown shape does not hide the others.
const page = z
  .object({
    acts: z.array(z.unknown()),
    next: z.object({ decidedAt: z.string(), id: z.string() }).nullable(),
  })
  .transform((read) => {
    const acts = read.acts.flatMap((raw) => {
      const held = decidedAct.safeParse(raw);
      return held.success ? [held.data] : [];
    });
    return { rows: decidedRows(acts), unread: read.acts.length - acts.length, next: read.next };
  });

/** Reads the page of the decided acts after the key, or the first page. It raises nothing. */
export async function readDecidedPage(after: DecidedKey | null): Promise<DecidedRead> {
  const read = await askWriter('/private/review-decided', { after, size: PAGE_SIZE }, page);
  switch (read.step) {
    case 'done':
      return { state: 'held', rows: read.rows, unread: read.unread, next: read.next };
    case 'refused':
      return { state: 'private', why: `The decided acts cannot be read: ${read.refusal}` };
    case 'unknown':
      return {
        state: 'private',
        why: read.doubt.includes('cannot read')
          ? `The decided acts cannot be read. ${read.doubt}`
          : NO_WRITER,
      };
  }
}
