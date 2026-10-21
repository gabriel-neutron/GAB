import { expect, test } from 'vitest';

import { readFigureRows } from './figure-rows';

const HEADER = 'serie,periode,valeur,unite,document,page,extrait_ou_cellule,note';

test('a long-format file gives one row for each line, with its place in the document', () => {
  const [row] = readFigureRows(
    'f.csv',
    `${HEADER}\nA,2025,12.5,%,doc_1,4,"cell B2, row 3",a note\n`,
  );
  expect(row).toStrictEqual({
    serie: 'A',
    period: '2025',
    value: 12.5,
    unit: '%',
    document: 'doc_1',
    page: '4',
    excerpt: 'cell B2, row 3',
    note: 'a note',
  });
});

test('a decimal comma is read as a decimal point', () => {
  expect(readFigureRows('f.csv', `${HEADER}\nA,2025,"12,5",%,d,1,x,\n`)[0]?.value).toBe(12.5);
});

test('a value that is not a number stops the read, with its line', () => {
  expect(() => readFigureRows('f.csv', `${HEADER}\nA,2025,,%,d,1,x,\n`)).toThrow(/line 2/u);
});

test('a missing column stops the read, with its name', () => {
  expect(() => readFigureRows('f.csv', 'serie,valeur\nA,1\n')).toThrow(/column periode/u);
});
