import { z } from 'zod';

import { IDENTIFIER_KEYS, identifierKey } from './identifiers.ts';

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
  z
    .strictObject({ type: z.literal('ru_register') })
    .describe(
      'a number of the Russian register: ten or twelve digits are the tax number (tax_id), and ' +
        'thirteen or fifteen digits are the registration number (registration_number)',
    ),
]);

/** The keys that the Russian register cast fills. One column can fill the two keys, and each key
 * keeps only the numbers of its own length. */
const RU_REGISTER_KEYS = ['tax_id', 'registration_number'] as const;

export type Cast = z.infer<typeof cast>;

/** A lookup reads one column and finds the entity that holds its value under one key. `label`
 * finds the entity by its name, and it is the last key that a lookup tries. */
const lookupKey = z.union([identifierKey, z.literal('label')]);

export type LookupKey = z.infer<typeof lookupKey>;

const lookup = z.strictObject({ key: lookupKey, column });

/** A lookup of one end of a relation table. A name is no key, and a relation is loaded only
 * between two ends that an identifier finds, so the lookup of an end holds no `label`. */
const endLookup = z.strictObject({ key: identifierKey, column });

// External constraint: the column holds two ordinates in degrees of EPSG:4326, and code reads no
// other system.
const geom = z.union([
  z.strictObject({ geojson: column }),
  z.strictObject({ lon: column, lat: column }),
]);

const datedColumn = z.strictObject({ column, pattern: z.enum(DATE_PATTERNS) });

/** The attributes that a relation takes from the columns of its row, for example the share of an
 * ownership link. */
const relationAttrs = z
  .record(key, z.strictObject({ column, cast }))
  .refine((held) => Object.values(held).every((rule) => rule.cast.type !== 'ru_register'), {
    message: 'a relation takes no number of the Russian register',
  });

// One end of a relation is always the entity of the row, so a relation names the other end and
// the side that the row takes.
const relation = z
  .strictObject({
    type: key,
    row_is: z
      .enum(['src', 'dst'])
      .describe('the end of the relation that the entity of the row is'),
    other: lookup.describe(
      'finds the entity at the other end. The record holds it already, but a cell that splits creates a missing owner with its GEM identifier',
    ),
    other_type: key
      .optional()
      .describe('the entity type of the other end. The default is the type of the row'),
    split: z
      .strictObject({ separator: z.string().min(1).max(3) })
      .optional()
      .describe(
        'the cell of the other end holds many owners, each with its GEM identifier and its share ' +
          'in percent. The cell never splits when one owner lacks the identifier or the share',
      ),
    valid_from: datedColumn.optional(),
    valid_to: datedColumn.optional(),
    attrs: relationAttrs.optional(),
  })
  .refine((held) => held.split === undefined || held.other.key === 'gem_entity_id', {
    message: 'a relation that splits its cell finds the other end by gem_entity_id',
  })
  .refine((held) => held.split === undefined || !('share_pct' in (held.attrs ?? {})), {
    message: 'a relation that splits its cell takes share_pct from the cell, so attrs has none',
  })
  .refine((held) => held.split === undefined || held.other_type !== undefined, {
    message: 'a relation that splits its cell names the entity type of the other end',
  });

/** One end of a relation table. The record holds the entity already, and the lookups find it. */
const linkEnd = z.strictObject({
  entity_type: key.describe('the type of the entity at this end, for a lookup by its name'),
  name: column
    .optional()
    .describe('the column of the name at this end, which the load report gives'),
  lookup: z
    .array(endLookup)
    .min(1)
    .max(4)
    .describe('how code finds the entity at this end in the record, by an identifier'),
});

/** A relation table: each row is one relation between two entities that the record holds, and
 * a row creates no entity. An ownership table gives the holder, the subject and the share. */
const links = z.strictObject({
  relation_type: key,
  src: linkEnd,
  dst: linkEnd,
  attrs: relationAttrs,
  valid_from: datedColumn.optional(),
  valid_to: datedColumn.optional(),
});

export type LinkEnd = z.infer<typeof linkEnd>;

/** The kinds of asset. An asset is an entity of the facility type, and its kind tells a field from
 * a pipeline segment. The list is closed, so a filter and a release can group the assets. */
export const ASSET_KINDS = [
  'field',
  'pipeline_segment',
  'refinery',
  'export_terminal',
  'lng_plant',
] as const;

/** A constant attribute: the mapping gives its value, and no column does. A table that holds only
 * oil and gas fields sets the asset kind once. */
const constants = z
  .record(key, z.union([z.string().min(1).max(200), z.number(), z.boolean()]))
  .refine((held) => Object.keys(held).every((name) => name === 'asset_kind'), {
    message: 'the only constant attribute is asset_kind',
  })
  .refine(
    (held) =>
      held['asset_kind'] === undefined || ASSET_KINDS.some((kind) => kind === held['asset_kind']),
    { message: `asset_kind is one of: ${ASSET_KINDS.join(', ')}` },
  );

const entityRows = z
  .strictObject({
    entity_type: key,
    label: column,
    lookup: z
      .array(lookup)
      .min(1)
      .max(4)
      .describe('how code finds the entity in the record before it proposes a new one'),
    geom: geom.optional(),
    attrs: z.record(key, z.strictObject({ column, cast })),
    constants: constants.optional(),
  })
  // A column gives free words ("Oil Refinery"), so the kind of an asset is a constant only.
  .refine((held) => !('asset_kind' in held.attrs), {
    message: 'asset_kind is a constant of the table (rows.constants), never a column',
  })
  .refine((held) => Object.keys(held.constants ?? {}).every((name) => !(name in held.attrs)), {
    message: 'a constant attribute and an attribute of a column never share a key',
  })
  .refine(
    (held) =>
      Object.entries(held.attrs).every(
        ([name, rule]) =>
          rule.cast.type !== 'ru_register' || RU_REGISTER_KEYS.some((one) => one === name),
      ),
    { message: `the cast ru_register fills only ${RU_REGISTER_KEYS.join(' or ')}` },
  )
  // A register column holds a tax number in one row and a registration number in another, so a
  // mapping that reads it fills the two keys from the same column.
  .refine(
    (held) => {
      const read = RU_REGISTER_KEYS.map((name) => held.attrs[name]).filter(
        (rule) => rule?.cast.type === 'ru_register',
      );
      return read.length === 0 || (read.length === 2 && read[0]?.column === read[1]?.column);
    },
    { message: `the cast ru_register fills ${RU_REGISTER_KEYS.join(' and ')} from one column` },
  )
  .refine(
    (held) => held.attrs['lei'] === undefined || held.attrs['lei'].cast.type === 'identifier',
    {
      message: 'lei takes the cast identifier',
    },
  );

/** The rows of a table: each row is one entity, or each row is one relation (a relation table). */
const rows = z.union([entityRows, links], {
  // The union alone words each failure as "Invalid input". The key `relation_type` tells the
  // branch that the model meant, so the retry gets the issues of that branch.
  error: (issue) => {
    const input: unknown = issue.input;
    const isLinks = typeof input === 'object' && input !== null && 'relation_type' in input;
    const issues = issue.errors[isLinks ? 1 : 0] ?? [];
    if (issues.length === 0) return undefined;
    return issues
      .map((one) => (one.path.length === 0 ? one.message : `${one.path.join('.')}: ${one.message}`))
      .join('; ');
  },
});

export type EntityRows = z.infer<typeof entityRows>;
export type LinkRows = z.infer<typeof links>;

/** True when each row of the table is one relation, and no row is an entity. */
export const isLinkTable = (held: EntityRows | LinkRows): held is LinkRows =>
  'relation_type' in held;

const draftFields = {
  table: z.string().trim().min(1).max(200),
  modality: z.enum(MODALITIES),
  publisher: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe('the body that publishes the table. It is the author of each row'),
  rows,
  relations: z.array(relation).max(10),
};

// A relation table holds its one relation in its rows, so it gives no relation of an entity.
const linkTableHasNoRelations = (held: {
  readonly rows: EntityRows | LinkRows;
  readonly relations: readonly unknown[];
}): boolean => !isLinkTable(held.rows) || held.relations.length === 0;
const NO_RELATIONS = {
  message: 'a relation table gives its relation in rows, and relations is []',
};

/** What the model gives for one table. The tool adds the signature of the header. */
export const mappingDraft = z
  .strictObject(draftFields)
  .refine(linkTableHasNoRelations, NO_RELATIONS)
  // A name is not an identifier: the model has read a cell of names as a link to a record entity.
  // The operator may still write a name lookup (the payload allows it), and the model may not.
  .refine((held) => held.relations.every((one) => one.other.key !== 'label'), {
    message: 'a relation finds the other end by an identifier, and a column of names gives none',
  });

export type MappingDraft = z.infer<typeof mappingDraft>;

/** The payload of one `map_document` act. The database holds its top-level keys, and this schema
 * holds every key below them. */
export const mappingPayload = z
  .strictObject({ ...draftFields, header_sig: z.string().regex(/^[0-9a-f]{64}$/u) })
  .refine(linkTableHasNoRelations, NO_RELATIONS);

export type MappingPayload = z.infer<typeof mappingPayload>;

/** Each column that a mapping names, once. */
const namedColumns = (mapping: MappingDraft): string[] => {
  const dayColumns = (held: {
    readonly valid_from?: { readonly column: string } | undefined;
    readonly valid_to?: { readonly column: string } | undefined;
  }): string[] =>
    [held.valid_from, held.valid_to].flatMap((day) => (day === undefined ? [] : [day.column]));
  const attrColumns = (held: Readonly<Record<string, { readonly column: string }>> = {}) =>
    Object.values(held).map((one) => one.column);
  const { rows: held } = mapping;
  if (isLinkTable(held))
    return [
      ...new Set([
        ...[held.src, held.dst].flatMap((end) => [
          ...(end.name === undefined ? [] : [end.name]),
          ...end.lookup.map((one) => one.column),
        ]),
        ...attrColumns(held.attrs),
        ...dayColumns(held),
      ]),
    ];
  const { geom: where } = held;
  return [
    ...new Set([
      held.label,
      ...held.lookup.map((one) => one.column),
      ...(where === undefined ? [] : 'geojson' in where ? [where.geojson] : [where.lon, where.lat]),
      ...attrColumns(held.attrs),
      ...mapping.relations.flatMap((one) => [
        one.other.column,
        ...dayColumns(one),
        ...attrColumns(one.attrs),
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

/** The words of the record that a mapping can use: the live entity types and relation types. */
export interface MappingVocabulary {
  readonly entityTypes: readonly string[];
  readonly relationTypes: readonly string[];
}

/** The words of a mapping that the record does not hold, each with the sentence that says what to
 * correct: an entity type or a relation type that is not live, and a lookup key that is not an
 * identifier of an asset (`opensanctions_id` for a facility). An asset is the type
 * `facility` with an asset kind, never a type `field`. */
export const vocabularyFaults = (
  mapping: MappingDraft,
  { entityTypes, relationTypes }: MappingVocabulary,
): string[] => {
  const faults: string[] = [];
  const type = (where: string, held: string): void => {
    if (!entityTypes.includes(held))
      faults.push(
        `${where} "${held}" is not an entity type of the record. Use one of: ` +
          `${entityTypes.join(', ')}. An asset is "facility" with the constant asset_kind`,
      );
  };
  const relationType = (where: string, held: string): void => {
    if (!relationTypes.includes(held))
      faults.push(
        `${where} "${held}" is not a relation type of the record. Use one of: ` +
          relationTypes.join(', '),
      );
  };
  const keys = (where: string, held: string, lookups: readonly { readonly key: string }[]) => {
    // Only an asset has a closed list of keys: the lists of a company or a person are a convention
    // of the writers, and a sanctions table finds a person by ofac_uid.
    if (held !== 'facility' && held !== 'port') return;
    const allowed: readonly string[] = IDENTIFIER_KEYS[held];
    for (const { key: name } of lookups)
      if (name !== 'label' && !allowed.includes(name))
        faults.push(
          `${where} key "${name}" is not an identifier of the type ${held}. Use one of: ` +
            [...allowed, 'label'].join(', '),
        );
  };
  const { rows: held } = mapping;
  if (isLinkTable(held)) {
    relationType('rows.relation_type', held.relation_type);
    for (const [where, end] of [
      ['rows.src', held.src],
      ['rows.dst', held.dst],
    ] as const) {
      type(`${where}.entity_type`, end.entity_type);
      keys(`${where}.lookup`, end.entity_type, end.lookup);
    }
    return faults;
  }
  type('rows.entity_type', held.entity_type);
  keys('rows.lookup', held.entity_type, held.lookup);
  for (const [index, one] of mapping.relations.entries()) {
    relationType(`relations.${String(index)}.type`, one.type);
    // With no other_type, the far end can be of another type, so its key is not checked.
    if (one.other_type === undefined) continue;
    type(`relations.${String(index)}.other_type`, one.other_type);
    keys(`relations.${String(index)}.other`, one.other_type, [one.other]);
  }
  return faults;
};
