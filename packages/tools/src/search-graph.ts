import { z } from 'zod';

import { entityHit, entityHits, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// A percent sign and an underscore are letters in a name, and a backslash escapes them.
const escaped = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

const SEARCH = `SELECT id::text AS id, label, type
  FROM api.entity
  WHERE label ILIKE '%' || $1::text || '%' ESCAPE '\\'
    AND ($2::text IS NULL OR type = $2::text)
  ORDER BY (label ILIKE $1::text || '%' ESCAPE '\\') DESC, label, id
  LIMIT $3::int`;

export const searchGraph = defineTool({
  name: 'search_graph',
  description:
    'Finds entities whose name holds the words you give, and filters by entity type when you ' +
    'name one. Names that start with the words come first.',
  input: z.strictObject({
    query: z.string().trim().min(1).max(200),
    type: z.string().trim().min(1).max(200).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  output: entityHits,
  async run(session, input) {
    const entities = await rowsOf(session, entityHit, SEARCH, [
      escaped(input.query),
      input.type ?? null,
      input.limit,
    ]);
    return { entities };
  },
});
