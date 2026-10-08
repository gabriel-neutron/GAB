import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const READ = 'SELECT public.review_group($1::uuid) AS read';

const unit = z.record(z.string(), z.unknown());

const row = z.object({
  read: z.object({ id: z.uuid(), subject: z.string().nullable(), units: z.array(unit) }),
});

export const readGroup = defineTool({
  name: 'read_group',
  description:
    'Reads one group of the review page: each unit of the group that waits, with its state ' +
    '(clean, not clean or blocked), its faults, its parent, and whether the group can write it. ' +
    'read_unit gives the cited passages of one unit.',
  input: z.strictObject({ groupId: z.uuid().describe('the id of the group, from read_groups') }),
  output: z.strictObject({ id: z.uuid(), subject: z.string().nullable(), units: z.array(unit) }),
  async run(session, input) {
    const [held] = await rowsOf(session, row, READ, [input.groupId]);
    if (held === undefined) throw new Error('the read of the group returned no row');
    return held.read;
  },
});
