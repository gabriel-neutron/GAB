import { expect, test } from 'vitest';

import { readVolumeTable, VolumeTableFault } from './volume-table.ts';

// A small volume table made for the test. The assets, the figures and the documents are not data
// of the research.
const HEADER =
  'actif_amont,actif_aval,produit,periode,valeur,minimum,maximum,unite,classe,document,page,note';
const UP = '0A1F0000-0000-4000-8000-000000000101';
const DOWN = '0a1f0000-0000-4000-8000-000000000102';

const table = (...rows: readonly string[]): string => [HEADER, ...rows].join('\r\n');

test('reads a row of each class with its figures, and the identifier of an asset in lower case', () => {
  const read = readVolumeTable(
    table(
      `${UP},${DOWN},brut,2026-07,120,,,kb/j,observé,doc_test1,3,a test note`,
      `${UP},${DOWN},brut,2026-07,"90,5",80,100,kb/j,estimé,doc_test2,,`,
      `Test pipe A,Test pipe B,gaz,2026,15,,,Gm³/an,capacité,doc_test3,1,`,
    ),
  );
  expect(read.rejected).toEqual([]);
  expect(read.rows).toEqual([
    {
      line: 2,
      upstream: UP.toLowerCase(),
      downstream: DOWN,
      product: 'crude',
      period: '2026-07',
      value: 120,
      minimum: null,
      maximum: null,
      unit: 'kb/j',
      volumeClass: 'observed',
      document: 'doc_test1',
      page: '3',
      note: 'a test note',
    },
    {
      line: 3,
      upstream: UP.toLowerCase(),
      downstream: DOWN,
      product: 'crude',
      period: '2026-07',
      value: 90.5,
      minimum: 80,
      maximum: 100,
      unit: 'kb/j',
      volumeClass: 'estimated',
      document: 'doc_test2',
      page: '',
      note: '',
    },
    {
      line: 4,
      upstream: 'Test pipe A',
      downstream: 'Test pipe B',
      product: 'gas',
      period: '2026',
      value: 15,
      minimum: null,
      maximum: null,
      unit: 'Gm³/an',
      volumeClass: 'capacity',
      document: 'doc_test3',
      page: '1',
      note: '',
    },
  ]);
});

test('rejects a row with no source document or no class, and gives the line and the reason', () => {
  const read = readVolumeTable(
    table(
      `${UP},${DOWN},brut,2026-07,120,,,kb/j,observé,,,`,
      `${UP},${DOWN},brut,2026-07,120,,,kb/j,,doc_test1,,`,
      `${UP},${DOWN},brut,2026-07,120,,,kb/j,mesuré,doc_test1,,`,
      `${UP},${DOWN},brut,2026-07,,,,kb/j,observé,doc_test1,,`,
      `${UP},${DOWN},brut,2026-07,120,,,,observé,doc_test1,,`,
      `${UP},${DOWN},brut,2026-07,120,,,kb/j,estimé,doc_test1,,`,
      `${UP},${DOWN},brut,2026-07,120,130,140,kb/j,estimé,doc_test1,,`,
      `${UP},${DOWN},charbon,2026-07,120,,,kb/j,observé,doc_test1,,`,
      `${UP},${DOWN},brut,2026-07,120,,,kb/j,observé,doc_test1,,`,
    ),
  );
  expect(read.rows.map((one) => one.line)).toEqual([10]);
  expect(read.rejected.map((one) => one.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  expect(read.rejected[0]?.why).toMatch(/document/u);
  expect(read.rejected[1]?.why).toMatch(/class/u);
  expect(read.rejected[2]?.why).toMatch(/class/u);
  expect(read.rejected[3]?.why).toMatch(/valeur/u);
  expect(read.rejected[4]?.why).toMatch(/unit/u);
  expect(read.rejected[5]?.why).toMatch(/range/u);
  expect(read.rejected[6]?.why).toMatch(/range/u);
  expect(read.rejected[7]?.why).toMatch(/product/u);
});

test('refuses a file with a missing column or bytes that are not UTF-8', () => {
  expect(() => readVolumeTable('actif_amont,actif_aval\r\nA,B')).toThrow(VolumeTableFault);
  expect(() => readVolumeTable(new Uint8Array([0xff, 0xfe, 0x41]))).toThrow(VolumeTableFault);
});

test('skips the lines that start with # as notes', () => {
  const read = readVolumeTable(
    `# A test note\r\n${table(`${UP},${DOWN},produits,2026-07,1,,,kt/mois,observé,doc_test1,,`)}`,
  );
  expect(read.rows.map((one) => one.line)).toEqual([3]);
});
