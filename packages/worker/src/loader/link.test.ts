import { expect, test } from 'vitest';

import { nameTableOf, splitNames, splitOwners } from './link.ts';

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

test('a share with a comma is never read in part', () => {
  expect(splitOwners('Novatek [E100000130497] 60,5%', ';')).toHaveProperty('refused');
  expect(splitOwners('Novatek [E100000130497] 1,60%', ';')).toHaveProperty('refused');
});

test('a cell that names the same GEM identifier two times does not split', () => {
  expect(
    splitOwners('Novatek [E100000130497] 60%; Novatek again [E100000130497] 20%', ';'),
  ).toHaveProperty('refused');
});

test('a cell of names splits into names with their shares', () => {
  expect(splitNames('Novatek PJSC [60.5%]; Rosneftegaz [30%]; Mystery Holder', ';')).toStrictEqual([
    { name: 'Novatek PJSC', share: 60.5 },
    { name: 'Rosneftegaz', share: 30 },
    { name: 'Mystery Holder', share: null },
  ]);
});

const nameTable = (header: string[], rows: string[][]) =>
  nameTableOf({
    header,
    rows: rows.map((fields) => ({ fields, start: 0, end: 0 })),
  });

test('the register check confirms a candidate, and an older table confirms none', () => {
  const header = ['name', 'status', 'gem_entity_id', 'dossier_entity_id', 'controle_registre'];
  const held = nameTable(header, [
    ['A', 'candidat-dossier', '', 'id-a', 'confirmé'],
    ['B', 'candidat-dossier', '', 'id-b', 'sans-clé'],
    ['C', 'candidat-dossier', '', 'id-c', ''],
    ['D', 'ouvert', '', '', 'candidat-registre'],
    ['E', 'marqueur', '', '', ''],
    ['F', 'sûr', 'E1', '', ''],
    ['G', 'nouveau', '', '', ''],
  ]);
  expect(held.get('a')).toStrictEqual({ kind: 'candidate', entity: 'id-a', confirmed: true });
  expect(held.get('b')).toStrictEqual({ kind: 'candidate', entity: 'id-b', confirmed: false });
  expect(held.get('c')).toStrictEqual({ kind: 'candidate', entity: 'id-c', confirmed: false });
  expect(held.get('d')).toStrictEqual({ kind: 'open' });
  expect(held.get('e')).toStrictEqual({ kind: 'open' });
  expect(held.get('f')).toStrictEqual({ kind: 'sure', gemId: 'E1' });
  expect(held.get('g')).toStrictEqual({ kind: 'new' });
  const older = nameTable(header.slice(0, 4), [['A', 'candidat-dossier', '', 'id-a']]);
  expect(older.get('a')).toStrictEqual({ kind: 'candidate', entity: 'id-a', confirmed: false });
});
