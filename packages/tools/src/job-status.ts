import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// A job that can still run comes first, then the newest ending.
const STATUS = `SELECT id::text AS id, status, attempts::int AS attempts, failure_reason,
         finished_at::text AS finished_at
  FROM api.job WHERE document_id = $1::text
  ORDER BY finished_at DESC NULLS FIRST, id`;

const row = z.strictObject({
  id: z.uuid(),
  status: z.string(),
  attempts: z.number().int(),
  failure_reason: z.string().nullable(),
  finished_at: z.string().nullable(),
});

export const jobStatus = defineTool({
  name: 'job_status',
  description:
    'Lists the jobs of one document with their status, the number of attempts, the reason of a ' +
    'failure and the time they ended. A document that entered by a hand entry has no job.',
  input: z.strictObject({ document: documentId }),
  output: z.strictObject({
    document: z.string(),
    jobs: z.array(
      z.strictObject({
        id: z.uuid(),
        status: z.string(),
        attempts: z.number().int(),
        failureReason: z.string().nullable(),
        finishedAt: z.string().nullable(),
      }),
    ),
  }),
  async run(session, input) {
    const found = await rowsOf(session, row, STATUS, [input.document]);
    return {
      document: input.document,
      jobs: found.map((job) => ({
        id: job.id,
        status: job.status,
        attempts: job.attempts,
        failureReason: job.failure_reason,
        finishedAt: job.finished_at,
      })),
    };
  },
});
