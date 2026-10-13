import { expect, test } from 'vitest';

import {
  isLinkTable,
  mappingDraft,
  mappingPayload,
  missingColumns,
  type MappingDraft,
} from './mapping.ts';

const DRAFT: MappingDraft = {
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
      held({ other_type: 'company', split: { separator: ';' } }, { key: 'label', column: 'Owner' }),
    ).success,
  ).toBe(false);
});
