import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { runStatement, type DoorAct } from './statement.ts';

// Departure: two exports, one job. The operator asks for the extraction of one document and reads
// where that work stands, and both answers read one body.

const body = z.object({ documentId: z.string().trim().min(1) });

const NO_DOCUMENT = 'the body names no document';

const QUEUE = "SELECT public.enqueue_job($1, 'extract_text')::text AS id";
const READ = 'SELECT * FROM public.document_jobs($1)';

const queuedRow = z.object({ id: z.uuid() });
const jobRow = z.object({
  job_id: z.uuid(),
  job_kind: z.string(),
  job_status: z.enum(['queued', 'running', 'done', 'failed']),
  job_reason: z.string().nullable(),
  job_refused: z.string().nullable(),
  proposal_count: z.coerce.number().int(),
});

/** One job of one document, as the operator reads it. A job that did not fail has no reason, and
 * a job of which the propose door refused no part has no refused words. */
interface JobLine {
  readonly id: string;
  readonly kind: string;
  readonly status: z.output<typeof jobRow>['job_status'];
  readonly reason: string | null;
  readonly refused: string | null;
  readonly proposals: number;
}

/** Ask the worker to extract the claims of one stored document. A failed extraction is asked
 * for again the same way. The record refuses a second open job, and says so. */
export const queueExtraction = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<{ readonly jobId: string }>> => {
  const given = readBody(raw, body, NO_DOCUMENT);
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, QUEUE, [given.body.documentId]);
  if (answer.outcome !== 'answered') return answer;
  return { outcome: 'done', reply: { jobId: queuedRow.parse(answer.rows[0]).id } };
};

/** The jobs of one document, the newest first. */
export const documentJobs = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<{ readonly jobs: readonly JobLine[] }>> => {
  const given = readBody(raw, body, NO_DOCUMENT);
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, READ, [given.body.documentId]);
  if (answer.outcome !== 'answered') return answer;
  return {
    outcome: 'done',
    reply: {
      jobs: answer.rows.map((row) => {
        const job = jobRow.parse(row);
        return {
          id: job.job_id,
          kind: job.job_kind,
          status: job.job_status,
          reason: job.job_reason,
          refused: job.job_refused,
          proposals: job.proposal_count,
        };
      }),
    },
  };
};
