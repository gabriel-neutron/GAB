import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const READ = 'SELECT public.review_groups() AS rail';

const group = z.record(z.string(), z.unknown());

const row = z.object({ rail: z.object({ groups: z.array(group) }) });

export const readGroups = defineTool({
  name: 'read_groups',
  description:
    'Reads the list "Groups" of the review page: each group of the queue that holds a unit that ' +
    'waits, in the order of the queue, with its subject, its proposer, its document, the count of ' +
    'its units and of its clean units, and the count of the units of each fault. read_group ' +
    'gives the units of one group.',
  input: z.strictObject({}),
  output: z.strictObject({ groups: z.array(group) }),
  async run(session) {
    const [held] = await rowsOf(session, row, READ, []);
    return { groups: held?.rail.groups ?? [] };
  },
});
