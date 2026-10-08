import { expect, test } from 'vitest';

import { mappingDraft, mappingPayload, missingColumns, type MappingDraft } from './mapping.ts';

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
