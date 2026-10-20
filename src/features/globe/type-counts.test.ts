import { expect, test } from 'vitest';

import { typeCountLine, typeCounts } from './type-counts';

const entities = [
  { type: 'refinery' },
  { type: 'refinery' },
  { type: 'refinery' },
  { type: 'vessel' },
  { type: 'vessel' },
];
const rows = [{ type: 'refinery' }, { type: 'refinery' }];

test('each type counts the entities of the record and those with a position', () => {
  expect(typeCounts(entities, rows)).toEqual([
    { type: 'refinery', label: 'Refinery', total: 3, onMap: 2 },
    { type: 'vessel', label: 'Vessel', total: 2, onMap: 0 },
  ]);
});

test('a type with a part on the map says the part, the whole and the rest', () => {
  expect(typeCountLine({ type: 'refinery', label: 'Refinery', total: 46, onMap: 28 })).toEqual({
    figure: '28 of 46 on the map',
    note: '18 have no known position',
  });
});

test('a type with every entity on the map has no note', () => {
  expect(typeCountLine({ type: 'refinery', label: 'Refinery', total: 3, onMap: 3 })).toEqual({
    figure: '3 of 3 on the map',
    note: null,
  });
});

test('a vessel with none on the map says why', () => {
  const line = typeCountLine({ type: 'vessel', label: 'Vessel', total: 770, onMap: 0 });
  expect(line.figure).toBe('770, none on the map');
  expect(line.note).toContain('moves');
});

test('another type with none on the map says that none has a position', () => {
  expect(typeCountLine({ type: 'company', label: 'Company', total: 4, onMap: 0 })).toEqual({
    figure: '4, none on the map',
    note: 'none has a known position',
  });
});

test('one entity without a position reads in the singular', () => {
  expect(typeCountLine({ type: 'port', label: 'Port', total: 5, onMap: 4 }).note).toBe(
    '1 has no known position',
  );
});
