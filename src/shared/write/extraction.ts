// Departure: two exports, one job. The operator asks the writer for an extraction and reads where
// it stands. The addresses and the shape of each answer stay inside.

import { z } from 'zod';

/** The newest extraction of one document. A job that did not fail has no reason. */
export interface Extraction {
  readonly status: 'queued' | 'running' | 'done' | 'failed';
  readonly reason: string | null;
  readonly proposals: number;
}

interface Refused {
  readonly state: 'refused';
  readonly refusal: string;
}

/** What one read became. `latest` is null when no extraction ran for the document. */
export type StatusOutcome =
  { readonly state: 'read'; readonly latest: Extraction | null } | Refused;

// The development server proxies this path to the writer, so the browser stays same-origin.
const QUEUE_DOOR = '/write/queue-extraction';
const READ_DOOR = '/write/document-jobs';

const EXTRACTION = 'extract_text';

const NO_ANSWER = 'the write service did not answer. Read the status again';

const queued = z.object({ jobId: z.string() });
const refused = z.object({ refusal: z.string() });
const jobs = z.object({
  jobs: z.array(
    z.object({
      kind: z.string(),
      status: z.enum(['queued', 'running', 'done', 'failed']),
      reason: z.string().nullable(),
      proposals: z.number(),
    }),
  ),
});

const knock = async (address: string, documentId: string): Promise<unknown> => {
  try {
    const answer = await fetch(address, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    });
    return await answer.json();
  } catch {
    return undefined;
  }
};

const refusalOf = (body: unknown): Refused => {
  const sentence = refused.safeParse(body);
  return { state: 'refused', refusal: sentence.success ? sentence.data.refusal : NO_ANSWER };
};

/** Ask for the extraction of one stored document. A failed one is asked for again this way. */
export async function queueExtraction(
  documentId: string,
): Promise<{ readonly state: 'queued' } | Refused> {
  const body = await knock(QUEUE_DOOR, documentId);
  return queued.safeParse(body).success ? { state: 'queued' } : refusalOf(body);
}

/** Read the newest extraction of one document. The writer answers the newest job first. */
export async function readExtraction(documentId: string): Promise<StatusOutcome> {
  const body = await knock(READ_DOOR, documentId);
  const held = jobs.safeParse(body);
  if (!held.success) return refusalOf(body);
  const latest = held.data.jobs.find((job) => job.kind === EXTRACTION);
  return {
    state: 'read',
    latest:
      latest === undefined
        ? null
        : { status: latest.status, reason: latest.reason, proposals: latest.proposals },
  };
}
