import { expect, test } from 'vitest';

import {
  isLinkTable,
  isObservationTable,
  mappingDraft,
  splitFaults,
  mappingPayload,
  missingColumns,
  vocabularyFaults,
  type EntityRows,
  type MappingDraft,
} from './mapping.ts';

const DRAFT: MappingDraft & { rows: EntityRows } = {
  table: 'list.csv',
  modality: 'enacts',
  rows: {
    entity_type: 'vessel',
    label: 'Name',
    lookup: [{ key: 'imo', column: 'IMO' }],
    attrs: {
      imo: { column: 'IMO', cast: { type: 'identifier' } },
      length_m: { column: 'Length', cast: { type: 'number', scale: 1 } },
    },
  },
  relations: [{ type: 'owned_by', row_is: 'src', other: { key: 'lei', column: 'Owner' } }],
};

const HEADER = ['Name', 'IMO', 'Length', 'Owner', 'Notes'];

test('a whole mapping parses, and a payload adds the signature of the header', () => {
  expect(mappingDraft.safeParse(DRAFT).success).toBe(true);
  const register = { column: 'IMO', cast: { type: 'ru_register' } } as const;
  expect(
    mappingDraft.safeParse({
      ...DRAFT,
      rows: { ...DRAFT.rows, attrs: { tax_id: register, registration_number: register } },
    }).success,
  ).toBe(true);
  expect(mappingPayload.safeParse({ ...DRAFT, header_sig: 'a'.repeat(64) }).success).toBe(true);
});

const REFUSED: readonly (readonly [string, unknown])[] = [
  [
    'a cast outside the closed set',
    {
      ...DRAFT,
      rows: {
        ...DRAFT.rows,
        attrs: { imo: { column: 'IMO', cast: { type: 'expression', formula: 'a+b' } } },
      },
    },
  ],
  [
    'a lookup key outside the identifiers',
    { ...DRAFT, rows: { ...DRAFT.rows, lookup: [{ key: 'imo_number', column: 'IMO' }] } },
  ],
  ['no lookup', { ...DRAFT, rows: { ...DRAFT.rows, lookup: [] } }],
  [
    'a register cast that fills one key alone',
    {
      ...DRAFT,
      rows: { ...DRAFT.rows, attrs: { tax_id: { column: 'IMO', cast: { type: 'ru_register' } } } },
    },
  ],
  [
    'a register cast that fills a key of no register',
    {
      ...DRAFT,
      rows: { ...DRAFT.rows, attrs: { imo: { column: 'IMO', cast: { type: 'ru_register' } } } },
    },
  ],
  [
    'a LEI read as text',
    {
      ...DRAFT,
      rows: { ...DRAFT.rows, attrs: { lei: { column: 'Owner', cast: { type: 'text' } } } },
    },
  ],
  [
    'a date with no pattern of the list',
    {
      ...DRAFT,
      rows: {
        ...DRAFT.rows,
        attrs: { built: { column: 'Length', cast: { type: 'date', pattern: 'D/M/Y' } } },
      },
    },
  ],
  [
    'a relation with no side for the row',
    { ...DRAFT, relations: [{ type: 'owned_by', other: { key: 'lei', column: 'Owner' } }] },
  ],
  ['a key the schema does not know', { ...DRAFT, weight: 0.9 }],
];

for (const [name, given] of REFUSED)
  test(`the schema refuses ${name}`, () => {
    expect(mappingDraft.safeParse(given).success).toBe(false);
  });

test('a mapping that names only columns of the header has no fault', () => {
  expect(missingColumns(DRAFT, HEADER)).toStrictEqual([]);
});

test('a column that the header lacks is a fault that says what to use', () => {
  expect(missingColumns(DRAFT, ['Name', 'IMO', 'Owner'])).toStrictEqual([
    'the column "Length" is not in the header. Use one of: Name, IMO, Owner',
  ]);
});

test('a mapping names its publisher and sets a constant attribute of the closed list', () => {
  const held = {
    ...DRAFT,
    publisher: 'Global Energy Monitor',
    rows: { ...DRAFT.rows, constants: { asset_kind: 'field' } },
  };

  expect(mappingDraft.safeParse(held).success).toBe(true);
  expect(
    mappingDraft.safeParse({ ...held, rows: { ...held.rows, constants: { asset_kind: 'well' } } })
      .success,
  ).toBe(false);
  expect(mappingDraft.safeParse({ ...held, publisher: ' ' }).success).toBe(false);
  const withConstants = (constants: Record<string, string>, attrs = DRAFT.rows.attrs) => ({
    ...held,
    rows: { ...held.rows, constants, attrs },
  });
  expect(mappingDraft.safeParse(withConstants({ weight: 'heavy' })).success).toBe(false);
  expect(
    mappingDraft.safeParse(
      withConstants(
        { asset_kind: 'field' },
        { asset_kind: { column: 'Kind', cast: { type: 'text' } } },
      ),
    ).success,
  ).toBe(false);
});

const LINKS = {
  table: 'GEM-ownership.xlsx',
  modality: 'asserts',
  publisher: 'Global Energy Monitor',
  rows: {
    relation_type: 'owns',
    src: {
      entity_type: 'company',
      name: 'Holder',
      lookup: [{ key: 'gem_entity_id', column: 'Holder ID' }],
    },
    dst: { entity_type: 'company', lookup: [{ key: 'gem_entity_id', column: 'Subject ID' }] },
    attrs: {
      share_pct: { column: 'Share', cast: { type: 'number', scale: 4 } },
      share_imputed: { column: 'Imputed', cast: { type: 'boolean' } },
      source_url: { column: 'URL', cast: { type: 'text' } },
    },
  },
  relations: [],
};

test('a relation table gives two lookups and the attributes of its relation, and no entity', () => {
  const read = mappingDraft.parse(LINKS);
  expect(isLinkTable(read.rows)).toBe(true);
  expect(isLinkTable(DRAFT.rows)).toBe(false);
  expect(missingColumns(read, ['Holder', 'Holder ID', 'Subject ID', 'Share'])).toStrictEqual([
    'the column "Imputed" is not in the header. Use one of: Holder, Holder ID, Subject ID, Share',
    'the column "URL" is not in the header. Use one of: Holder, Holder ID, Subject ID, Share',
  ]);
  // A relation table holds its one relation in its rows.
  expect(mappingDraft.safeParse({ ...LINKS, relations: DRAFT.relations }).success).toBe(false);
  expect(
    mappingDraft.safeParse({ ...LINKS, rows: { ...LINKS.rows, label: 'Holder' } }).success,
  ).toBe(false);
  expect(
    mappingDraft.safeParse({
      ...LINKS,
      rows: { ...LINKS.rows, src: { ...LINKS.rows.src, lookup: [] } },
    }).success,
  ).toBe(false);
});

test('a relation of an entity table takes attributes from its columns', () => {
  const held = {
    ...DRAFT,
    relations: [
      {
        ...DRAFT.relations[0],
        attrs: { share_pct: { column: 'Length', cast: { type: 'number', scale: 2 } } },
      },
    ],
  };
  expect(mappingDraft.safeParse(held).success).toBe(true);
  expect(missingColumns(mappingDraft.parse(held), ['Name', 'IMO', 'Owner'])).toStrictEqual([
    'the column "Length" is not in the header. Use one of: Name, IMO, Owner',
  ]);
});

test('a failed entity table keeps the specific issues', () => {
  const read = mappingDraft.safeParse({
    ...DRAFT,
    rows: { ...DRAFT.rows, lookup: [{ key: 'imo_number', column: 'IMO' }] },
  });
  expect(read.success).toBe(false);
  expect(JSON.stringify(read.error?.issues)).toContain('lookup');
});

test('the lookup of an end of a relation table holds no name key', () => {
  const end = (key: string) => ({
    ...LINKS,
    rows: {
      ...LINKS.rows,
      src: { ...LINKS.rows.src, lookup: [{ key, column: 'Holder ID' }] },
    },
  });
  expect(mappingDraft.safeParse(end('label')).success).toBe(false);
  expect(mappingDraft.safeParse(end('gem_entity_id')).success).toBe(true);
});

test('a relation names the entity type of its far end, and a split cell needs a GEM key', () => {
  const owner = { key: 'gem_entity_id', column: 'Owner' } as const;
  const held = (extra: object, other: object = owner) => ({
    ...DRAFT,
    relations: [{ type: 'owns', row_is: 'dst', other, ...extra }],
  });
  expect(mappingDraft.safeParse(held({ other_type: 'company' })).success).toBe(true);
  expect(
    mappingDraft.safeParse(held({ other_type: 'company', split: { separator: ';' } })).success,
  ).toBe(true);
  // A cell never splits without the type of its owners.
  expect(mappingDraft.safeParse(held({ split: { separator: ';' } })).success).toBe(false);
  // A cell of names or of another key never splits.
  expect(
    mappingDraft.safeParse(
      held({ other_type: 'company', split: { separator: ';' } }, { key: 'imo', column: 'Owner' }),
    ).success,
  ).toBe(false);
  // A split cell gives the share, so a mapped share_pct would be overwritten.
  expect(
    mappingDraft.safeParse(
      held({
        other_type: 'company',
        split: { separator: ';' },
        attrs: { share_pct: { column: 'Share', cast: { type: 'number', scale: 2 } } },
      }),
    ).success,
  ).toBe(false);
});

const VOCABULARY = {
  entityTypes: ['vessel', 'company', 'facility'],
  relationTypes: ['owns', 'operates'],
};

const fieldTable = (
  entityType: string,
  key: 'gem_unit_id' | 'opensanctions_id',
  relation: string,
) =>
  mappingDraft.parse({
    table: 'GEM-fields.xlsx',
    modality: 'asserts',
    rows: {
      entity_type: entityType,
      label: 'Name',
      lookup: [{ key, column: 'Unit ID' }],
      attrs: {},
      constants: { asset_kind: 'field' },
    },
    relations: [
      {
        type: relation,
        row_is: 'dst',
        other: { key: 'gem_entity_id', column: 'Operator ID' },
        other_type: 'company',
      },
    ],
  });

test('a GEM field is a facility with a GEM key, and a made-up type or key is a fault', () => {
  expect(
    vocabularyFaults(fieldTable('facility', 'gem_unit_id', 'operates'), VOCABULARY),
  ).toStrictEqual([]);
  expect(
    vocabularyFaults(fieldTable('field', 'gem_unit_id', 'operated_by'), VOCABULARY),
  ).toStrictEqual([
    expect.stringMatching(/^rows\.entity_type "field" is not an entity type .*"facility" with/u),
    expect.stringMatching(/^relations\.0\.type "operated_by" is not a relation type/u),
  ]);
  expect(
    vocabularyFaults(fieldTable('facility', 'opensanctions_id', 'operates'), VOCABULARY),
  ).toStrictEqual([
    expect.stringMatching(
      /^rows\.lookup key "opensanctions_id" is not an identifier of the type facility\. Use one of: .*gem_unit_id/u,
    ),
  ]);
});

test('a relation table checks its type, the types of its ends and their keys', () => {
  const read = mappingDraft.parse(LINKS);
  expect(vocabularyFaults(read, VOCABULARY)).toStrictEqual([]);
  expect(
    vocabularyFaults(
      mappingDraft.parse({ ...LINKS, rows: { ...LINKS.rows, relation_type: 'holds' } }),
      VOCABULARY,
    ),
  ).toHaveLength(1);
});

test('only an asset has a closed list of lookup keys, and a far end with no type is not checked', () => {
  const table = (entityType: string, key: 'ofac_uid' | 'gem_entity_id') =>
    mappingDraft.parse({
      table: 'list.csv',
      modality: 'enacts',
      rows: { entity_type: entityType, label: 'Name', lookup: [{ key, column: 'ID' }], attrs: {} },
      relations: [
        { type: 'operates', row_is: 'dst', other: { key: 'gem_entity_id', column: 'Op' } },
      ],
    });
  const vocabulary = { ...VOCABULARY, entityTypes: [...VOCABULARY.entityTypes, 'person'] };
  expect(vocabularyFaults(table('person', 'ofac_uid'), vocabulary)).toStrictEqual([]);
  expect(vocabularyFaults(table('facility', 'gem_entity_id'), vocabulary)).toHaveLength(1);
});

test('the kind of an asset is a constant, never a column', () => {
  const read = mappingDraft.safeParse({
    ...DRAFT,
    rows: {
      ...DRAFT.rows,
      entity_type: 'facility',
      attrs: { asset_kind: { column: 'Notes', cast: { type: 'text' } } },
    },
  });
  expect(read.success).toBe(false);
  expect(JSON.stringify(read.error?.issues)).toContain('asset_kind is a constant');
});

test('a relation that finds the other end by a name is refused', () => {
  const byName = {
    ...DRAFT,
    relations: [{ type: 'operates', row_is: 'dst', other: { key: 'label', column: 'Owner' } }],
  };
  expect(mappingDraft.safeParse(byName).success).toBe(false);
});

test('a split of a column with no GEM identifier is a fault', () => {
  const draft = {
    ...DRAFT,
    relations: [
      {
        type: 'owns',
        row_is: 'dst' as const,
        other: { key: 'gem_entity_id' as const, column: 'Owner' },
        other_type: 'company',
        split: { separator: ';' },
      },
    ],
  };
  const header = ['Name', 'IMO', 'Length', 'Owner'];
  expect(splitFaults(draft, header, [['a', '1', '2', 'Gazprom [100%]']])).toHaveLength(1);
  expect(splitFaults(draft, header, [['a', '1', '2', 'E100000123456 [100%]']])).toEqual([]);
  expect(splitFaults(DRAFT, header, [['a', '1', '2', 'Gazprom']])).toEqual([]);
  // A column that the header lacks is a fault of missingColumns, and no table of rows is no proof.
  expect(splitFaults(draft, ['Name'], [['a']])).toEqual([]);
  expect(splitFaults(draft, header, [])).toHaveLength(1);
});

const OBSERVATIONS = {
  table: 'nrg_ti_gasm',
  modality: 'asserts',
  publisher: 'Eurostat',
  rows: {
    measure: 'imports_natural_gas',
    value: { column: 'OBS_VALUE' },
    unit: { column: 'unit' },
    period: { column: 'TIME_PERIOD', length: 'month' },
    reporter: { column: 'geo', codes: 'eurostat' },
    partner: { column: 'partner', codes: 'eurostat' },
    product: { column: 'siec', system: 'siec' },
    method: 'imports reported by the importer',
    licence: 'eu-reuse',
    flag: 'OBS_FLAG',
  },
  relations: [],
};

test('an observation table parses, and each row is one figure', () => {
  const read = mappingDraft.safeParse(OBSERVATIONS);
  expect(read.success).toBe(true);
  if (!read.success) return;
  expect(isObservationTable(read.data.rows)).toBe(true);
  expect(isLinkTable(read.data.rows)).toBe(false);
  expect(
    missingColumns(read.data, ['geo', 'TIME_PERIOD', 'OBS_VALUE', 'unit', 'partner', 'siec']),
  ).toStrictEqual([
    'the column "OBS_FLAG" is not in the header. Use one of: geo, TIME_PERIOD, OBS_VALUE, unit, ' +
      'partner, siec',
  ]);
});

const REFUSED_OBSERVATIONS: readonly (readonly [string, unknown])[] = [
  ['a relation of an entity', { ...OBSERVATIONS, relations: [DRAFT.relations[0]] }],
  [
    'a licence outside the closed list',
    { ...OBSERVATIONS, rows: { ...OBSERVATIONS.rows, licence: 'free' } },
  ],
  [
    'a period of a day',
    {
      ...OBSERVATIONS,
      rows: { ...OBSERVATIONS.rows, period: { column: 'TIME_PERIOD', length: 'day' } },
    },
  ],
  [
    'a code list outside the list',
    { ...OBSERVATIONS, rows: { ...OBSERVATIONS.rows, reporter: { column: 'geo', codes: 'm49' } } },
  ],
  ['no method', { ...OBSERVATIONS, rows: { ...OBSERVATIONS.rows, method: ' ' } }],
];

test.each(REFUSED_OBSERVATIONS)('an observation table with %s is refused', (_name, draft) => {
  expect(mappingDraft.safeParse(draft).success).toBe(false);
});

test('a refused observation table words the issues of its own branch', () => {
  const read = mappingDraft.safeParse({
    ...OBSERVATIONS,
    rows: { ...OBSERVATIONS.rows, licence: 'free' },
  });
  expect(read.success).toBe(false);
  expect(JSON.stringify(read.error?.issues)).toContain('licence');
});
