import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// The door refuses a document that does not exist, a document with no bytes and a second open
// job of one kind for one document. One statement queues every job, so a refusal queues none. The
// OCR text is the second reading of an image, so an image gets no second model reading.
const ENQUEUE = `SELECT public.enqueue_job($1::text, 'extract_text')::text AS id,
  CASE WHEN lower(coalesce((SELECT d.mime FROM public.documents d WHERE d.id = $1::text), ''))
            LIKE 'image/%'
       THEN NULL
       ELSE public.enqueue_job($1::text, 'second_read')::text END AS second_id,
  public.enqueue_job($1::text, 'evidence_check')::text AS evidence_id`;

const row = z.strictObject({ id: z.uuid(), second_id: z.uuid().nullable(), evidence_id: z.uuid() });

export const enqueueExtract = defineTool({
  name: 'enqueue_extract',
  description:
    'Asks the worker to extract the text of one stored document. The job runs later: call ' +
    'job_status to see where it stands.',
  input: z.strictObject({ document: documentId }),
  output: z.strictObject({ jobId: z.uuid() }),
  async run(session, input) {
    const [queued] = await rowsOf(session, row, ENQUEUE, [input.document]);
    if (queued === undefined) throw new Error('the door queued a job and returned no identifier');
    return { jobId: queued.id };
  },
});
