import { identifierContainment, identifierKey } from '@gab/proposal/identifiers';
import { z } from 'zod';

import { entityHit, entityHits, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

// A percent sign and an underscore are letters in a name, and a backslash escapes them.
const escaped = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

// One text for each case, so each filter that the caller leaves out is a null that holds for each
// row.
const SEARCH = `SELECT id::text AS id, label, type
  FROM api.entity
  WHERE ($1::text IS NULL OR label ILIKE '%' || $1::text || '%' ESCAPE '\\')
    AND ($2::text IS NULL OR type = $2::text)
    AND ($4::jsonb[] IS NULL OR attrs @> ANY($4::jsonb[]))
  ORDER BY COALESCE(label ILIKE $1::text || '%' ESCAPE '\\', false) DESC, label, id
  LIMIT $3::int`;

export const searchGraph = defineTool({
  name: 'search_graph',
  description:
    'Finds entities whose name holds the words you give, and filters by entity type when you ' +
    'name one. Names that start with the words come first. Give an identifier, such as ' +
    '{"key": "imo", "value": "9074729"}, to find only the entities that hold that exact value, ' +
    'as a text, as a number or in a list. Search each identifier before you propose an entity.',
  input: z
    .strictObject({
      query: z.string().trim().min(1).max(200).optional().describe('words of the name'),
      identifier: z
        .strictObject({ key: identifierKey, value: z.string().trim().min(1).max(500) })
        .optional()
        .describe('an identifier key that list_vocabulary gives, and its exact value'),
      type: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe('the key of an entity type, such as vessel'),
      limit: z.number().int().min(1).max(50).default(20),
    })
    .refine((input) => input.query !== undefined || input.identifier !== undefined, {
      error: 'give a query, an identifier, or both',
    }),
  output: entityHits,
  async run(session, input) {
    const held =
      input.identifier === undefined
        ? null
        : identifierContainment(input.identifier.key, input.identifier.value).map((shape) =>
            JSON.stringify(shape),
          );
    const entities = await rowsOf(session, entityHit, SEARCH, [
      input.query === undefined ? null : escaped(input.query),
      input.type ?? null,
      input.limit,
      held,
    ]);
    return { entities };
  },
});
