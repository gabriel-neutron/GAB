import type { Pool } from 'pg';
import { z } from 'zod';

// The door takes the oldest queued row and marks it running in one transaction of its own. The
// lock that keeps two workers off one row is inside it, because no role may write the table.
const CLAIM = 'SELECT job_id, job_document, job_attempts FROM public.claim_job($1)';

const claimed = z
  .array(
    z.object({
      job_id: z.uuid(),
      job_document: z.string().min(1),
      job_attempts: z.number().int().positive(),
    }),
  )
  .max(1);

// A pool and one client of it both answer here. The lock a claim takes lasts as long as the
// transaction of the connection that took it, so which connection asks is the whole question.
type Queryable = Pick<Pool, 'query'>;

/** One unit of work, held by this worker and already marked as running. */
export interface ClaimedJob {
  readonly id: string;
  readonly documentId: string;
  readonly attempt: number;
}

/** Takes one job for `worker`, or answers null when no queued job is free to take. */
export const claimJob = async (on: Queryable, worker: string): Promise<ClaimedJob | null> => {
  const found = claimed.parse((await on.query(CLAIM, [worker])).rows);
  const row = found[0];
  if (row === undefined) return null;
  return { id: row.job_id, documentId: row.job_document, attempt: row.job_attempts };
};
