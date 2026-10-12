import { z } from 'zod';

import type { Queryable } from './queryable.ts';

const requeuedRow = z.object({
  author: z.string(),
  failure_reason: z.string().nullable(),
});

/** A name whose failed rating job is back in the queue, with the reason of the earlier attempt.
 * The job row keeps no record of it. */
export interface Requeued {
  readonly author: string;
  readonly failureReason: string | null;
}

/** Puts each rating job that failed by a fault back in the queue with no attempt, and gives the
 * names, sorted, with the reason of the earlier attempt. A job that the model refused stays failed. */
export const requeueFailedRatings = async (db: Queryable): Promise<readonly Requeued[]> => {
  const { rows } = await db.query(
    'SELECT author, failure_reason FROM public.requeue_failed_ratings()',
  );
  return z
    .array(requeuedRow)
    .parse(rows)
    .map((one) => ({ author: one.author, failureReason: one.failure_reason }))
    .sort((a, b) => (a.author < b.author ? -1 : a.author > b.author ? 1 : 0));
};

/** The line that the command prints for one name. */
export const requeuedLine = (one: Requeued): string =>
  `${one.author} | earlier reason: ${one.failureReason ?? 'none'}`;
