import { z } from 'zod';

import { documentId, isDoorRefusal, rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// The door refuses a document that does not exist, a document with no bytes and a second open
// job of one kind for one document.
const ENQUEUE = `SELECT public.enqueue_job($1::text, 'map_structured')::text AS id`;

const row = z.strictObject({ id: z.uuid() });

export const enqueueMapping = defineTool({
  name: 'enqueue_mapping',
  description:
    'Queues the mapping of one stored table (a CSV file), and returns the job id. The back-end ' +
    'AI reads the header and a sample of the rows and proposes how the columns map to the ' +
    'record. The operator promotes the mapping, and then code loads the rows. The job runs ' +
    'later: call job_status with the same document to see where it stands, then list_proposals ' +
    'to see the mapping. It does not extract claims: use enqueue_extract for that.',
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
