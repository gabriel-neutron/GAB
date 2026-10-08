import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { why } from './review-decision.ts';
import { defineTool } from './tool.ts';

const PROMOTE = 'SELECT public.ai_promote_group($1::uuid, $2::uuid[], $3::text) AS results';

// Origin of the number: the same cap as the group action of the page.
const MOST_GROUP_UNITS = 1000;

const result = z.strictObject({
  unit: z.uuid(),
  name: z.string(),
  outcome: z.enum(['promoted', 'refused']),
  said: z.string().nullable(),
});

const row = z.object({ results: z.array(result) });

export const promoteCleanProposals = defineTool({
  name: 'promote_clean_proposals',
  description:
    'Promotes the clean units of one group, as the button "Promote the clean proposals of this ' +
    'group" of the review page. Give the units of the group that read_group says the group can ' +
    'write. The database runs the same check of the faults as the page: each unit that is still ' +
    'clean, pending and in the group is written as its own decision, and each other unit is ' +
    'refused with its reason. Each written unit keeps the origin "decided by an AI reviewer" and ' +
    'your reason. Read the cited passages of each unit first, and never decide a unit that your ' +
    'own session proposed.',
  input: z.strictObject({
    groupId: z.uuid().describe('the id of the group, from read_groups'),
    unitIds: z
      .array(z.uuid())
      .min(1)
      .max(MOST_GROUP_UNITS)
      .describe('the units of the group that you read and decide to promote'),
    why,
  }),
  output: z.strictObject({
    results: z.array(result),
    origin: z.literal('decided by an AI reviewer'),
  }),
  async run(session, input) {
    const [held] = await rowsOf(session, row, PROMOTE, [input.groupId, input.unitIds, input.why]);
    if (held === undefined) throw new Error('the group action returned no row');
    return { results: held.results, origin: 'decided by an AI reviewer' as const };
  },
});
