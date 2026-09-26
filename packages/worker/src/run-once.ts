import type { RawStore } from '@gab/store/bucket';
import type { Pool } from 'pg';
import { z } from 'zod';

import { backoffMs } from './backoff.ts';
import { claimJob } from './claim.ts';
import { runLayout } from './layout-job.ts';
import { reconcileCorpus } from './reconcile.ts';

// The job row carries no kind column, so the worker process is told which kind it runs, on the
// command line, one process per kind.
export const JOB_KIND = z.enum(['layout', 'reconcile']);
export type JobKind = z.infer<typeof JOB_KIND>;

type Queryable = Pick<Pool, 'query'>;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Claims one job and runs it as the given kind. Answers a line to report, or null when the
 * queue held no job to claim. The store is opened only when the kind needs it. */
export const runOnce = async (
  kind: JobKind,
  on: Queryable,
  openRawStore: () => RawStore,
): Promise<string | null> => {
  const job = await claimJob(on);
  if (job === null) return null;

  await wait(backoffMs(job.attempt));

  if (kind === 'layout') {
    const placed = await runLayout(on);
    return `The layout run placed ${String(placed)} entities.`;
  }

  const found = await reconcileCorpus(on, openRawStore());
  const total = found.objectsWithNoRow.length + found.rowsWithNoObject.length;
  return total === 0
    ? 'The bucket and the index agree.'
    : `The bucket and the index disagree on ${String(total)} names.`;
};
