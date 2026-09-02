import type { Pool } from 'pg';

import { claimJob } from './claim.ts';
import { ingestDocument } from './ingest-document.ts';

// An empty queue is the ordinary state of a small corpus, and a job arrives only when a
// document enters the door. Two seconds keeps an idle worker at one query every two seconds.
const EMPTY_QUEUE_MS = 2_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// Claims one job at a time and hands each one to the work behind the ingestion door. IT STOPS
// AT THE FIRST HAND-OFF THAT FAILS: nothing marks a job failed today, so a loop that carried on
// would take every queued row into `running` and leave none of them a way out.
export const runClaimLoop = async (pool: Pool, worker: string): Promise<never> => {
  for (;;) {
    const job = await claimJob(pool, worker);
    if (job === null) {
      await sleep(EMPTY_QUEUE_MS);
      continue;
    }
    console.log(`claim ${job.id}  document ${job.documentId}  attempt ${job.attempt}`);
    await ingestDocument(job);
  }
};
