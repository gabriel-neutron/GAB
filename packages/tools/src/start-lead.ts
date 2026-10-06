import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// The door keeps the role of the connection as the author of the lead. The worker role holds no
// grant on it, so the agent that runs a lead starts no lead of its own.
const START = 'SELECT public.start_lead($1::text)::text AS id';

const row = z.strictObject({ id: z.uuid() });

export const startLead = defineTool({
  name: 'start_lead',
  description:
    'Gives a lead to the back-end AI of Gabriel, and returns the job id. The back-end AI ' +
    'searches the web and the news for the lead, fetches and stores each new page, and queues ' +
    'the extraction of its claims. It proposes nothing by itself. The lead runs later: the ' +
    'stored pages come back with find_document, and their proposals with list_proposals. A ' +
    'lead is private and the public never reads it.',
  input: z.strictObject({
    lead: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe('what to search for, such as "Intershipping and its vessels"'),
  }),
  output: z.strictObject({ jobId: z.uuid() }),
  async run(session, input) {
    const [started] = await rowsOf(session, row, START, [input.lead]);
    if (started === undefined)
      throw new Error('the door started a lead and returned no identifier');
    return { jobId: started.id };
  },
});
