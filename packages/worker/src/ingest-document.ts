import type { ClaimedJob } from './claim.ts';

const NOT_BUILT = 'the work behind the ingestion door is not built: no agent reads a document yet';

/** The work of one claimed job: fetch the document, extract it, and run the agents. */
export const ingestDocument = (job: ClaimedJob): Promise<void> =>
  Promise.reject(new Error(`${NOT_BUILT}. The job ${job.id} names ${job.documentId}`));
