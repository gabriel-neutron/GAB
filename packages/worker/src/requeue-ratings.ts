import { z } from 'zod';

import type { Queryable } from './queryable.ts';

const requeuedRow = z.object({
  author: z.string(),
  failure_reason: z.string().nullable(),
  refusal: z.string().nullable(),
});

/** A name whose failed rating job is back in the queue, with the record of the earlier attempt.
 * The job row keeps no record of it. */
export interface Requeued {
  readonly author: string;
  readonly failureReason: string | null;
  readonly refusal: string | null;
}

/** Puts each failed rating job back in the queue with no attempt, and gives the names, sorted, with
 * the reason and the refusal of the earlier attempt. */
export const requeueFailedRatings = async (db: Queryable): Promise<readonly Requeued[]> => {
  const { rows } = await db.query(
    'SELECT author, failure_reason, refusal FROM public.requeue_failed_ratings()',
  );
  return z
    .array(requeuedRow)
    .parse(rows)
    .map((one) => ({ author: one.author, failureReason: one.failure_reason, refusal: one.refusal }))
    .sort((a, b) => (a.author < b.author ? -1 : a.author > b.author ? 1 : 0));
};

/** The line that the command prints for one name. */
export const requeuedLine = (one: Requeued): string =>
  [
    one.author,
    `earlier reason: ${one.failureReason ?? 'none'}`,
    ...(one.refusal === null ? [] : [`earlier refusal: ${one.refusal}`]),
  ].join(' | ');
