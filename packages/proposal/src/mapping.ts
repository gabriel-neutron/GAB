import { z } from 'zod';

import { identifierKey } from './identifiers.ts';

/** How a page states a claim. The table states one word for every row. */
const MODALITIES = ['enacts', 'asserts', 'attributes', 'alleges', 'denies'] as const;

/** The patterns of a date column. A pattern outside the list is an expression, and a mapping
 * holds none. */
export const DATE_PATTERNS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD.MM.YYYY'] as const;

// Origin: decided, not calibrated. A column name of a real list is short, and a longer one is a
// cell that a broken header moved into the first line.
const COLUMN_LENGTH = 200;

const column = z
  .string()
  .min(1)
  .max(COLUMN_LENGTH)
  .describe('the name of a column, as the header writes it');

const key = z.string().min(1).describe('lower case words joined by one underscore');

/** The closed set of casts. Each one turns the text of a cell into one attribute value, and none
 * of them holds an expression. */
export const cast = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text') }),
  z.strictObject({ type: z.literal('number'), scale: z.number().int().min(0).max(12) }),
  z.strictObject({ type: z.literal('identifier') }),
  z.strictObject({ type: z.literal('date'), pattern: z.enum(DATE_PATTERNS) }),
  z.strictObject({ type: z.literal('boolean') }),
  z.strictObject({ type: z.literal('list'), separator: z.string().min(1).max(3) }),
]);

export type Cast = z.infer<typeof cast>;

/** A lookup reads one column and finds the entity that holds its value under one key. `label`
 * finds the entity by its name, and it is the last key that a lookup tries. */
const lookupKey = z.union([identifierKey, z.literal('label')]);

export type LookupKey = z.infer<typeof lookupKey>;

const lookup = z.strictObject({ key: lookupKey, column });

// External constraint: the column holds two ordinates in degrees of EPSG:4326, and code reads no
// other system.
const geom = z.union([
  z.strictObject({ geojson: column }),
  z.strictObject({ lon: column, lat: column }),
]);

const datedColumn = z.strictObject({ column, pattern: z.enum(DATE_PATTERNS) });

// One end of a relation is always the entity of the row, so a relation names the other end and
// the side that the row takes.
const relation = z.strictObject({
  type: key,
  row_is: z.enum(['src', 'dst']).describe('the end of the relation that the entity of the row is'),
  other: lookup.describe('finds the entity at the other end, which the record holds already'),
  valid_from: datedColumn.optional(),
  valid_to: datedColumn.optional(),
});

const rows = z.strictObject({
  entity_type: key,
  label: column,
  lookup: z
    .array(lookup)
    .min(1)
    .max(4)
    .describe('how code finds the entity in the record before it proposes a new one'),
  geom: geom.optional(),
  attrs: z.record(key, z.strictObject({ column, cast })),
});

/** What the model gives for one table. The tool adds the signature of the header. */
export const mappingDraft = z.strictObject({
  table: z.string().trim().min(1).max(200),
  modality: z.enum(MODALITIES),
  rows,
  relations: z.array(relation).max(10),
});

export type MappingDraft = z.infer<typeof mappingDraft>;

/** The payload of one `map_document` act. The database holds its top-level keys, and this schema
 * holds every key below them. */
export const mappingPayload = mappingDraft.extend({
  header_sig: z.string().regex(/^[0-9a-f]{64}$/u),
});

export type MappingPayload = z.infer<typeof mappingPayload>;

/** Each column that a mapping names, once. */
const namedColumns = (mapping: MappingDraft): string[] => {
  const { geom: where } = mapping.rows;
  return [
    ...new Set([
      mapping.rows.label,
      ...mapping.rows.lookup.map((one) => one.column),
      ...(where === undefined ? [] : 'geojson' in where ? [where.geojson] : [where.lon, where.lat]),
      ...Object.values(mapping.rows.attrs).map((one) => one.column),
      ...mapping.relations.flatMap((one) => [
        one.other.column,
        ...[one.valid_from, one.valid_to].flatMap((day) => (day === undefined ? [] : [day.column])),
      ]),
    ]),
  ];
};

/** The columns that a mapping names and the header lacks, each with the sentence that says what
 * to correct. */
export const missingColumns = (mapping: MappingDraft, header: readonly string[]): string[] =>
  namedColumns(mapping)
    .filter((name) => !header.includes(name))
    .map((name) => `the column "${name}" is not in the header. Use one of: ${header.join(', ')}`);
