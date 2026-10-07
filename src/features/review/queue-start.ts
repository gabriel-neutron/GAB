import { filterWithinChoices } from './filter-choices';
import { patchReviewWorkspace, readReviewWorkspace, type QueueFilter } from './review-workspace';
import { readUnits, type UnitsRead } from './units';

/** The first page that the screen shows, and the filter that it was read with. */
export interface QueueStart {
  readonly first: UnitsRead;
  readonly filter: QueueFilter;
}

/** Reads the first page with the filter and from the place that the workspace holds. A place that
 * the writer refuses is dropped, and the queue is read from its first unit. A group or a document
 * that the queue no longer offers is dropped from the filter. */
export async function openQueue(): Promise<QueueStart> {
  const { filter, from } = readReviewWorkspace();
  const first = await readUnits(from, filter);
  if (first.state !== 'held') {
    if (from === null) return { first, filter };
    patchReviewWorkspace({ from: null });
    return { first: await readUnits(null, filter), filter };
  }
  const kept = filterWithinChoices(filter, first.page.choices);
  if (kept === filter) return { first, filter };
  patchReviewWorkspace({ filter: kept, from: null });
  return { first: await readUnits(null, kept), filter: kept };
}
