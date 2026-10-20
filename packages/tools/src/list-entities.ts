import { z } from 'zod';

import { entityHit, rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// The keys that a caller can count. Each is an attribute that a vessel holds when the record knows
// it.
const COUNT_KEYS = ['flag_history', 'mmsi_history', 'call_sign'] as const;

const KNOWN_TYPE = `SELECT 1 AS found FROM api.entity_type WHERE key = $1::text`;

// The page follows the order of the id, so the cursor is the last id of the page before. One more
// row than the limit tells whether a next page exists.
const PAGE = `SELECT id::text AS id, label, type
  FROM api.entity
  WHERE type = $1::text
    AND ($2::uuid IS NULL OR id > $2::uuid)
    AND ($3::text IS NULL OR $4::text IS NULL OR (attrs ? $3::text) = ($4::text = 'with'))
  ORDER BY id
  LIMIT $5::int`;

// The counts do not depend on the cursor, so with + without is always the total of the type.
const COUNTS = `SELECT count(*)::int AS total,
         (count(*) FILTER (WHERE $2::text IS NOT NULL AND attrs ? $2::text))::int AS with_key
  FROM api.entity
  WHERE type = $1::text`;

const countRow = z.strictObject({ total: z.number().int(), with_key: z.number().int() });

export const listEntities = defineTool({
  name: 'list_entities',
  description:
    'Lists the entities of one type in pages, and counts them. Give the type as list_vocabulary ' +
    'gives it, such as vessel. Give "next" of a page as "after" to read the next page; a page ' +
    'with no "next" is the last. Give a key (flag_history, mmsi_history or call_sign) to get the ' +
    'count of the entities that hold the key and the count of the entities that do not; the two ' +
    'counts add up to the total of the type. Add "presence" to list only the entities that hold ' +
    'the key or only those that do not. It reads the record and changes nothing.',
  input: z
    .strictObject({
      type: z.string().trim().min(1).max(200).describe('the key of an entity type, such as vessel'),
      key: z.enum(COUNT_KEYS).optional().describe('an identifier key to count'),
      presence: z
        .enum(['with', 'without'])
        .optional()
        .describe('list only the entities that hold the key, or only those that do not'),
      after: z.uuid().optional().describe('the value of "next" of the page before'),
      limit: z.number().int().min(1).max(200).default(100),
    })
    .refine((input) => input.presence === undefined || input.key !== undefined, {
      error: 'give a key with presence',
    }),
  output: z.strictObject({
    entities: z.array(entityHit),
    next: z.uuid().nullable(),
    total: z.number().int(),
    withKey: z.number().int().nullable(),
    withoutKey: z.number().int().nullable(),
  }),
  async run(session, input) {
    const known = await rowsOf(session, z.object({ found: z.number() }), KNOWN_TYPE, [input.type]);
    if (known.length === 0) {
      throw new ToolRefusal(`the record has no entity type ${input.type}; use list_vocabulary`);
    }
    const key = input.key ?? null;
    const rows = await rowsOf(session, entityHit, PAGE, [
      input.type,
      input.after ?? null,
      key,
      input.presence ?? null,
      input.limit + 1,
    ]);
    const [counts] = await rowsOf(session, countRow, COUNTS, [input.type, key]);
    if (counts === undefined) throw new Error('the count query gave no row');
    const entities = rows.slice(0, input.limit);
    const last = entities.at(-1);
    return {
      entities,
      next: rows.length > input.limit ? (last?.id ?? null) : null,
      total: counts.total,
      withKey: key === null ? null : counts.with_key,
      withoutKey: key === null ? null : counts.total - counts.with_key,
    };
  },
});
