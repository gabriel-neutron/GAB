import { z } from 'zod';

import { askWriter } from '@/shared/write/door';

import type { QueueFilter } from './review-workspace';
import { unitPageOf, type Unit, type UnitPage } from './unit-page';

// Departure: two reads, one job. Both read the queue through one door: a page of it, and one unit
// that the address names.

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

const pageAfter = (after: readonly string[] | null) =>
  z.unknown().transform((raw, context) => {
    const held = unitPageOf(raw, after);
    if (held === null) {
      context.addIssue({ code: 'custom', message: 'the answer is not a page of the queue' });
      return z.NEVER;
    }
    return { page: held };
  });

// The writer reads an absent filter as "every unit", so only the filters that are on are sent.
const sentFilter = (filter: QueueFilter) => ({
  ...(filter.group === null ? {} : { group: filter.group }),
  ...(filter.proposer === null ? {} : { proposer: filter.proposer }),
  ...(filter.fault === null ? {} : { fault: filter.fault }),
  ...(filter.document === null ? {} : { document: filter.document }),
  ...(filter.name.trim() === '' ? {} : { name: filter.name.trim() }),
});

/** Reads the page of the queue that the filter keeps after the key of the last unit read, or the
 * first page. It raises nothing: the public page has no writer. */
export async function readUnits(
  after: readonly string[] | null,
  filter: QueueFilter,
): Promise<UnitsRead> {
  const read = await askWriter(
    DOOR,
    { after, size: PAGE_SIZE, filter: sentFilter(filter) },
    pageAfter(after),
  );
  return read.step === 'done'
    ? { state: 'held', page: read.page }
    : { state: 'private', why: NO_WRITER };
}

/** One unit that waits, read by its identifier, or null where it waits no more. A unit that the
 * page cannot read is null too: the queue then says why. It raises nothing. */
export async function readUnit(unitId: string): Promise<Unit | null> {
  const read = await askWriter(
    DOOR,
    { after: null, size: 1, filter: { unit: unitId } },
    pageAfter(null),
  );
  return read.step === 'done' ? (read.page.units[0] ?? null) : null;
}
