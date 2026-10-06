import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// The door refuses a document that does not exist, a document with no bytes and a second open
// job of one kind for one document.
const ENQUEUE = `SELECT public.enqueue_job($1::text, 'extract_text')::text AS id`;

// External constraint: the unique index of the table refuses a second open job of one kind for
// one document, and its name is the one witness of that rule.
const ONE_OPEN = 'jobs_one_open_per_kind';

const row = z.strictObject({ id: z.uuid() });

const isOneOpen = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  'constraint' in cause &&
  cause.constraint === ONE_OPEN;

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
      if (isOneOpen(cause))
        throw new ToolRefusal(
          `an extraction of ${input.document} is queued or runs already; job_status follows it`,
        );
      throw cause;
    }
    if (queued === undefined) throw new Error('the door queued a job and returned no identifier');
    return { jobId: queued.id };
  },
});
