import { z } from 'zod';

import type { Queryable } from './queryable.ts';

const names = z.array(z.object({ author: z.string() }));

/** Puts each failed rating job back in the queue with no attempt, and gives the names, sorted. */
export const requeueFailedRatings = async (db: Queryable): Promise<readonly string[]> => {
  const { rows } = await db.query('SELECT author FROM public.requeue_failed_ratings()');
  return names
    .parse(rows)
    .map((one) => one.author)
    .sort();
};
