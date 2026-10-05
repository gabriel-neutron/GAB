import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// The walk grows with each hop, and a model reads the whole answer. Three hops reach the owner of
// the owner of a vessel, which is as far as a question of control goes.
const MAX_DEPTH = 3;

const MAX_ENTITIES = 200;

const WALK = `SELECT n.entity_id::text AS id, e.label, e.type, n.hop::int AS hop
  FROM api.neighbourhood($1::uuid, $2::int) n
  JOIN api.entity e ON e.id = n.entity_id
  ORDER BY n.hop, e.label, e.id
  LIMIT $3::int`;

const reached = z.strictObject({
  id: z.uuid(),
  label: z.string(),
  type: z.string(),
  hop: z.number().int().min(0),
});

export const neighbourhood = defineTool({
  name: 'neighbourhood',
  description:
    'Lists the entities within a number of relations of one entity, each with its distance in ' +
    `hops. The root is at hop 0. The depth runs from 1 to ${MAX_DEPTH}, and it is 2 when you give none.`,
  input: z.strictObject({
    root: z.uuid(),
    depth: z.number().int().min(1).max(MAX_DEPTH).default(2),
  }),
  output: z.strictObject({ entities: z.array(reached) }),
  async run(session, input) {
    const entities = await rowsOf(session, reached, WALK, [input.root, input.depth, MAX_ENTITIES]);
    return { entities };
  },
});
