import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// The door counts the proposals of each job through the model calls that it recorded, and it
// returns no row of a call. The newest job comes first.
const STATUS = `SELECT job_id::text AS id, job_kind AS kind, job_status AS status,
         job_reason AS reason, proposal_count::int AS proposals
    FROM public.document_jobs($1::text)`;

const row = z.strictObject({
  id: z.uuid(),
  kind: z.string(),
  status: z.string(),
  reason: z.string().nullable(),
  proposals: z.number().int(),
});

export const jobStatus = defineTool({
  name: 'job_status',
  description:
    'Lists the jobs of one document, newest first, with the kind of work, the status (queued, ' +
    'running, done or failed), the reason of a failure and the number of proposals that the ' +
    'job made. When the extraction is done, list_proposals with the document gives its ' +
    'proposals. A failed job does not run again: queue the document again. A document that ' +
    'entered by a hand entry has no job.',
  input: z.strictObject({ document: documentId }),
  output: z.strictObject({
    document: z.string(),
    jobs: z.array(
      z.strictObject({
        id: z.uuid(),
        kind: z.string(),
        status: z.string(),
        failureReason: z.string().nullable(),
        proposals: z.number().int(),
      }),
    ),
  }),
  async run(session, input) {
    const found = await rowsOf(session, row, STATUS, [input.document]);
    return {
      document: input.document,
      jobs: found.map((job) => ({
        id: job.id,
        kind: job.kind,
        status: job.status,
        failureReason: job.reason,
        proposals: job.proposals,
      })),
    };
  },
});
