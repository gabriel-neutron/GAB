import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { why } from './review-decision.ts';
import { citationOf, passage } from './review-passage.ts';
import { defineTool } from './tool.ts';

const REMOVE = 'SELECT public.ai_remove_act($1::uuid, $2::jsonb, $3::text) AS said';

const row = z.object({
  said: z.object({ removal: z.uuid(), act: z.uuid(), name: z.string() }),
});

export const removeAct = defineTool({
  name: 'remove_act',
  description:
    'Removes one accepted act of the record that is wrong: a new relation, or a change of the ' +
    'values of an entity. Use it only for an act that a passage shows to be wrong; an act that ' +
    'waits is rejected with reject_unit or reject_relation. A relation leaves the graph. Each ' +
    'value that the act set goes back to the value before the act, or leaves the entity. The ' +
    'act leaves each read of the graph, each export and each count, and the ledger keeps it with ' +
    'the removal: the origin "decided by an AI reviewer", your reason, who and when. The ' +
    'database refuses an act that is not accepted, an act that is removed already, another kind ' +
    'of act, a relation that is an end of another relation, and a value that a later act set ' +
    '(remove that act first). Read the act and its cited passage first (read_decided, ' +
    'list_proposals), and never remove an act that you proposed: a new reviewer agent decides it.',
  input: z.strictObject({
    actId: z.uuid().describe('the id of the accepted act, from read_decided or list_proposals'),
    passage,
    why,
  }),
  output: z.strictObject({
    removal: z.uuid(),
    act: z.uuid(),
    name: z.string(),
    origin: z.literal('decided by an AI reviewer'),
  }),
  run: async (session, input) => {
    const cited = await citationOf(session, input.passage);
    const [held] = await rowsOf(session, row, REMOVE, [
      input.actId,
      JSON.stringify(cited),
      input.why,
    ]);
    if (held === undefined) throw new Error('the removal returned no row');
    return { ...held.said, origin: 'decided by an AI reviewer' as const };
  },
});
