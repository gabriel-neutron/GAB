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

test('does not flag one value on two types', () => {
  expect(
    duplicateIdentifiers([
      entity('a', 'X', 'company', { tax_id: { v: '1' } }),
      entity('b', 'X', 'bank', { tax_id: { v: '1' } }),
    ]),
  ).toEqual([]);
});
