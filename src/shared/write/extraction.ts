// Departure: two exports, one job. The operator asks the writer for an extraction and reads where
// it stands. The addresses and the shape of each answer stay inside.

import { z } from 'zod';

import { askWriter } from './door';
import type { WriteResult } from './write-state';

const status = z.enum(['queued', 'running', 'done', 'failed']);

/** The newest extraction of one document. A job that did not fail has no reason, and a job of
 * which the propose door refused no part has no refused words. */
export interface Extraction {
  readonly status: z.output<typeof status>;
  readonly reason: string | null;
  readonly refused: string | null;
  readonly proposals: number;
}

const QUEUE_DOOR = '/write/queue-extraction';
const READ_DOOR = '/write/document-jobs';

const EXTRACTION = 'extract_text';

// The screen reads the status again after a queue, so the done step carries nothing.
const queued = z.object({ jobId: z.string() }).transform(() => ({}));

// The writer answers the newest job first. `latest` is null when no extraction ran.
const jobs = z
  .object({
    jobs: z.array(
      z.object({
        kind: z.string(),
        status,
        reason: z.string().nullable(),
        refused: z.string().nullable(),
        proposals: z.number(),
      }),
    ),
  })
  .transform(({ jobs: all }): { readonly latest: Extraction | null } => {
    const latest = all.find((job) => job.kind === EXTRACTION);
    return {
      latest:
        latest === undefined
          ? null
          : {
              status: latest.status,
              reason: latest.reason,
              refused: latest.refused,
              proposals: latest.proposals,
            },
    };
  });

/** Ask for the extraction of one stored document. A failed one is asked for again this way. */
export const queueExtraction = (documentId: string): Promise<WriteResult> =>
  askWriter(QUEUE_DOOR, { documentId }, queued);

/** Read the newest extraction of one document. */
export const readExtraction = (
  documentId: string,
): Promise<WriteResult<{ readonly latest: Extraction | null }>> =>
  askWriter(READ_DOOR, { documentId }, jobs);
