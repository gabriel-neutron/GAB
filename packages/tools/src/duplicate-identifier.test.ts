import { expect, test } from 'vitest';

import { duplicateIdentifiers, type EntityIdentifiers } from './duplicate-identifier.ts';

const entity = (
  id: string,
  label: string,
  type: string,
  attrs: EntityIdentifiers['attrs'],
): EntityIdentifiers => ({ id, label, type, attrs });

test('flags two companies with the same INN and OGRN', () => {
  const same = { tax_id: { v: '7706107510' }, registration_number: { v: 1027700043502 } };
  const groups = duplicateIdentifiers([
    entity('a', 'ROSNEFTEGAZ', 'company', same),
    entity('b', 'JSC ROSNEFTEGAZ', 'company', {
      ...same,
      registration_number: { v: ['1027700043502'] },
    }),
    entity('c', 'Other', 'company', { tax_id: { v: '7707083893' } }),
  ]);
  expect(groups.map((group) => [group.key, group.entities.map((one) => one.id)])).toEqual([
    ['tax_id', ['a', 'b']],
    ['registration_number', ['a', 'b']],
  ]);
});

test('does not flag two vessels with one name and two IMO numbers', () => {
  expect(
    duplicateIdentifiers([
      entity('a', 'ARCTIC', 'vessel', { imo: { v: '9074729' } }),
      entity('b', 'ARCTIC', 'vessel', { imo: { v: '9321483' } }),
    ]),
  ).toEqual([]);
});

test('flags one INN on two entity types', () => {
  const groups = duplicateIdentifiers([
    entity('a', 'X', 'company', { tax_id: { v: '1' } }),
    entity('b', 'X', 'state_body', { tax_id: { v: '1' } }),
  ]);
  expect(groups).toHaveLength(1);
});

test('flags a same IMO and a same LEI, spelled with spaces or in lower case', () => {
  const groups = duplicateIdentifiers([
    entity('a', 'A', 'vessel', { imo: { v: '9074729' } }),
    entity('b', 'B', 'vessel', { imo: { v: [9074729] } }),
    entity('c', 'C', 'bank', { lei: { v: '5493001KJTIIGC8Y1R12' } }),
    entity('d', 'D', 'bank', { lei: { v: '5493001kjtiigc8y1r12' } }),
    entity('e', 'E', 'company', { tax_id: { v: '7706 107510' } }),
    entity('f', 'F', 'company', { tax_id: { v: '7706107510' } }),
  ]);
  expect(groups.map((group) => group.key)).toEqual(['imo', 'lei', 'tax_id']);
});

test('does not flag an entity listed twice', () => {
  const same = entity('a', 'A', 'company', { tax_id: { v: '1' } });
  expect(duplicateIdentifiers([same, same])).toEqual([]);
});

test('flags a new entity that waits as a copy of an element of the record, and marks it', () => {
  const groups = duplicateIdentifiers([
    entity('a', 'ALPHA', 'company', { tax_id: { v: '7706107510' } }),
    { ...entity('b', 'ALPHA', 'company', { tax_id: { v: '7706107510' } }), pending: true },
  ]);
  expect(groups[0]?.entities).toEqual([
    { id: 'a', label: 'ALPHA', type: 'company' },
    { id: 'b', label: 'ALPHA', type: 'company', pending: true },
  ]);
});

test('flags two companies with the same IMO company number', () => {
  const groups = duplicateIdentifiers([
    entity('a', 'ACME SHIPPING', 'company', { imo_company_number: { v: '1234567' } }),
    entity('b', 'ACME SHIPPING LTD', 'company', { imo_company_number: { v: ['1234567'] } }),
  ]);
  expect(groups.map((group) => [group.key, group.entities.map((one) => one.id)])).toEqual([
    ['imo_company_number', ['a', 'b']],
  ]);
});
