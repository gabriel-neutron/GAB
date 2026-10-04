import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// The door refuses a document that does not exist, a document with no bytes and a second open
// job of the same kind for one document, and each refusal reaches the caller as it is raised.
const ENQUEUE = "SELECT public.enqueue_job($1::text, 'extract_text')::text AS id";

const row = z.strictObject({ id: z.uuid() });

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
