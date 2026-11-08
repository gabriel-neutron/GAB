import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { why } from './review-decision.ts';
import { citationOf, passage } from './review-passage.ts';
import { defineTool } from './tool.ts';

const JOIN = 'SELECT public.ai_join_entities($1::uuid, $2::uuid, $3::jsonb, $4::text) AS said';

const row = z.object({
  said: z.object({ join: z.uuid(), kept: z.uuid(), absorbed: z.uuid(), name: z.string() }),
});

export const joinEntities = defineTool({
  name: 'join_entities',
  description:
    'Joins two accepted entities of the record that are one thing, such as one firm that two ' +
    'sources named in two ways. The older entity stays. The newer entity leaves the graph: its ' +
    'values, its relations and its documents move to the older one, its name becomes a former ' +
    'name, and its id resolves to the older one. The record keeps the origin "decided by an AI ' +
    'reviewer", your reason, the cited passage and a full copy, so the operator can undo the ' +
    'join. The database refuses one entity named twice, two entities of two types, and an ' +
    'entity that an act that waits names (decide that act first). Use it only when a passage ' +
    'identifies both, such as one identifier. Read both entities first (read_entity), and never ' +
    'join entities that you proposed: a new reviewer agent decides it.',
  input: z.strictObject({
    entityIds: z
      .tuple([z.uuid(), z.uuid()])
      .describe('the ids of the two entities, from search_graph or read_entity'),
    passage,
    why,
  }),
  output: z.strictObject({
    join: z.uuid(),
    kept: z.uuid(),
    absorbed: z.uuid(),
    name: z.string(),
    origin: z.literal('decided by an AI reviewer'),
  }),
  run: async (session, input) => {
    const cited = await citationOf(session, input.passage);
    const [held] = await rowsOf(session, row, JOIN, [
      input.entityIds[0],
      input.entityIds[1],
      JSON.stringify(cited),
      input.why,
    ]);
    if (held === undefined) throw new Error('the join returned no row');
    return { ...held.said, origin: 'decided by an AI reviewer' as const };
  },
});
