import { z } from 'zod';

import { entityHit, entityHits, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const MAX_ENTITIES = 20;

// A value is a scalar or a flat list. A list matches when it holds the word, and a scalar matches
// when its text is the word, so a number such as an IMO number matches the text of that number.
const LOOKUP = `SELECT id::text AS id, label, type
  FROM api.entity
  WHERE CASE jsonb_typeof(attrs -> $1::text -> 'v')
          WHEN 'array' THEN (attrs -> $1::text -> 'v') @> to_jsonb($2::text)
          ELSE (attrs -> $1::text -> 'v') #>> '{}' = $2::text
        END
  ORDER BY label, id
  LIMIT $3::int`;

export const lookupEntity = defineTool({
  name: 'lookup_entity',
  description:
    'Finds the entities that hold one identifier, such as an imo number, by the key of the ' +
    'attribute and its exact value. Call it before you propose a new entity, so you do not ' +
    'propose one that the record already holds.',
  input: z.strictObject({
    key: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(500),
  }),
  output: entityHits,
  async run(session, input) {
    const entities = await rowsOf(session, entityHit, LOOKUP, [
      input.key,
      input.value,
      MAX_ENTITIES,
    ]);
    return { entities };
  },
});
