import { expect, test } from 'vitest';

import { splitOwners } from './link.ts';

test('a cell splits when each owner has its GEM identifier and its share', () => {
  expect(
    splitOwners('Novatek [E100000130497] 60.5%; Total [E100000130498] 20%', ';'),
  ).toStrictEqual({
    owners: [
      { gemId: 'E100000130497', name: 'Novatek', share: 60.5 },
      { gemId: 'E100000130498', name: 'Total', share: 20 },
    ],
  });
});

test('a name is never paired with an identifier by its place in the cell', () => {
  // Names only.
  expect(splitOwners('Novatek 60%; Total 20%', ';')).toHaveProperty('refused');
  // One owner lacks its identifier, so no owner splits.
  expect(splitOwners('Novatek [E100000130497] 60%; Total 20%', ';')).toHaveProperty('refused');
  // One owner lacks its share.
  expect(splitOwners('Novatek [E100000130497]; Total [E100000130498] 20%', ';')).toHaveProperty(
    'refused',
  );
  // The identifiers stand apart from the names.
  expect(splitOwners('Novatek; Total; E100000130497; E100000130498', ';')).toHaveProperty(
    'refused',
  );
});
