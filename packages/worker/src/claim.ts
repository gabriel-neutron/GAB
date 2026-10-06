import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// The door takes the oldest queued row of a work kind and marks it running in one transaction of
// its own. The lock that keeps two claims off one row is inside it, because no role may write
// the table.
const CLAIM = 'SELECT job_id, job_document, job_kind FROM public.claim_job()';

const claimed = z
  .array(
    z.object({
      job_id: z.uuid(),
      job_document: z.string().min(1),
      job_kind: z.enum(['extract_text', 'map_structured', 'second_read']),
    }),
  )
  .max(1);

/** One unit of work, held by this worker and already marked as running. */
export interface ClaimedJob {
  readonly id: string;
  readonly documentId: string;
  readonly kind: 'extract_text' | 'map_structured' | 'second_read';
}

/** Takes one job for this connection, or answers null when no queued job is free to take. The
 * taker is the role of the connection: the door reads it and takes no name. */
export const claimJob = async (on: Queryable): Promise<ClaimedJob | null> => {
  const found = claimed.parse((await on.query(CLAIM)).rows);
  const row = found[0];
  if (row === undefined) return null;
  return {
    id: row.job_id,
    documentId: row.job_document,
    kind: row.job_kind,
  };
};
