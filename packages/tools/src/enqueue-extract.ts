import { z } from 'zod';

import { documentId, isDoorRefusal, rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// The door refuses a document that does not exist, a document with no bytes and a second open
// job of one kind for one document.
const ENQUEUE = `SELECT public.enqueue_job($1::text, 'extract_text')::text AS id`;

const row = z.strictObject({ id: z.uuid() });

export const enqueueExtract = defineTool({
  name: 'enqueue_extract',
  description:
    'Queues the extraction of the claims of one stored document, and returns the job id. The ' +
    'back-end AI reads the whole text and proposes each claim that it finds, with its page and ' +
    'its excerpt. The job runs later: call job_status with the same document to see where it ' +
    'stands, then list_proposals to see what it proposed.',
  input: z.strictObject({ document: documentId }),
  output: z.strictObject({ jobId: z.uuid() }),
  async run(session, input) {
    let queued;
    try {
      [queued] = await rowsOf(session, row, ENQUEUE, [input.document]);
    } catch (cause) {
      if (isDoorRefusal(cause)) throw new ToolRefusal(cause.message);
      throw cause;
    }
    if (queued === undefined) throw new Error('the door queued a job and returned no identifier');
    return { jobId: queued.id };
  },
});
