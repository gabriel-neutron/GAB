import { z } from 'zod';

import { askWriter } from '@/shared/write/door';

import { unitPageOf, type UnitPage } from './unit-page';

/** One page of the queue, or the sentence that says why this page holds none. */
export type UnitsRead =
  | { readonly state: 'held'; readonly page: UnitPage }
  | { readonly state: 'private'; readonly why: string };

const DOOR = '/private/review-units';

// Origin: decided, not calibrated. One page fills the left column of a large screen about three
// times, and the writer reads it in about a tenth of a second on the v1 import.
const PAGE_SIZE = 50;

const NO_WRITER =
  'The queue is private, and the write service on this machine did not give it. Start the ' +
  'write service, then open this page again.';

const page = z.unknown().transform((raw, context) => {
  const held = unitPageOf(raw);
  if (held === null) {
    context.addIssue({ code: 'custom', message: 'the answer is not a page of the queue' });
    return z.NEVER;
  }
  return { page: held };
});

/** Reads the page of the queue that starts after the key of the last unit read, or the first
 * page. It raises nothing: the public page has no writer. */
export async function readUnits(after: readonly string[] | null): Promise<UnitsRead> {
  const read = await askWriter(DOOR, { after, size: PAGE_SIZE }, page);
  return read.step === 'done'
    ? { state: 'held', page: read.page }
    : { state: 'private', why: NO_WRITER };
}
