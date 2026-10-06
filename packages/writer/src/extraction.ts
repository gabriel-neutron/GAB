import { DatabaseError } from 'pg';
import { z } from 'zod';

import type { Sessions } from './pool.ts';
import { failureFrom, refusalFrom } from './refusal.ts';

// Departure: two exports, one job. The operator asks for the extraction of one document and reads
// where that work stands, and both answers read one body and one set of outcomes.

const DONE = 200;
const REFUSED = 422;
const OPEN = 409;
const UNAVAILABLE = 503;

/** One job of one document, as the operator reads it. A job that did not fail has no reason. */
export interface JobLine {
  readonly id: string;
  readonly kind: string;
  readonly status: 'queued' | 'running' | 'done' | 'failed';
  readonly reason: string | null;
  readonly proposals: number;
}

export type ExtractionReply =
  { readonly jobId: string } | { readonly jobs: readonly JobLine[] } | { readonly refusal: string };

export interface ExtractionAct {
  readonly status: typeof DONE | typeof REFUSED | typeof OPEN | typeof UNAVAILABLE;
  readonly reply: ExtractionReply;
}

const body = z.object({ documentId: z.string().trim().min(1) });

const QUEUE = "SELECT public.enqueue_job($1, 'extract_text')::text AS id";
const READ = 'SELECT * FROM public.document_jobs($1)';

const queuedRow = z.object({ id: z.uuid() });
const jobRow = z.object({
  job_id: z.uuid(),
  job_kind: z.string(),
  job_status: z.enum(['queued', 'running', 'done', 'failed']),
  job_reason: z.string().nullable(),
  proposal_count: z.coerce.number().int(),
});

// External constraint: the unique index of the table refuses a second open job of one kind for
// one document, and its name is the one witness of that rule.
const ONE_OPEN = 'jobs_one_open_per_kind';
const STILL_OPEN = 'an extraction of this document is queued or runs already';

const NO_DOCUMENT = 'the body names no document';

const documentOf = (raw: string): string | undefined => {
  try {
    const held = body.safeParse(JSON.parse(raw));
    return held.success ? held.data.documentId : undefined;
  } catch {
    return undefined;
  }
};

// A lost answer of the queue door may stand as a job. A second request then meets the open job
// and says so, so a new read of the status is the safe next step for both doors.
const LOST = 'the database did not answer. Read the status of the document again';

const failed = (cause: unknown): ExtractionAct => {
  if (cause instanceof DatabaseError && cause.constraint === ONE_OPEN)
    return { status: OPEN, reply: { refusal: STILL_OPEN } };
  const failure = failureFrom(cause);
  return failure.raised
    ? { status: REFUSED, reply: { refusal: failure.refusal } }
    : { status: UNAVAILABLE, reply: { refusal: LOST } };
};

const run = async (
  pool: Sessions,
  raw: string,
  work: (rows: Record<string, unknown>[]) => ExtractionReply,
  text: string,
): Promise<ExtractionAct> => {
  const documentId = documentOf(raw);
  if (documentId === undefined) return { status: REFUSED, reply: { refusal: NO_DOCUMENT } };

  let session;
  try {
    session = await pool.connect();
  } catch (cause) {
    return { status: UNAVAILABLE, reply: { refusal: refusalFrom(cause) } };
  }
  try {
    const found = await session.query(text, [documentId]);
    return { status: DONE, reply: work(found.rows) };
  } catch (cause) {
    return failed(cause);
  } finally {
    session.release();
  }
};

/** Ask the worker to extract the claims of one stored document. A failed extraction is asked
 * for again the same way. */
export const queueExtraction = (pool: Sessions, raw: string): Promise<ExtractionAct> =>
  run(pool, raw, (rows) => ({ jobId: queuedRow.parse(rows[0]).id }), QUEUE);

/** The jobs of one document, the newest first. */
export const documentJobs = (pool: Sessions, raw: string): Promise<ExtractionAct> =>
  run(
    pool,
    raw,
    (rows) => ({
      jobs: rows.map((row) => {
        const job = jobRow.parse(row);
        return {
          id: job.job_id,
          kind: job.job_kind,
          status: job.job_status,
          reason: job.job_reason,
          proposals: job.proposal_count,
        };
      }),
    }),
    READ,
  );
