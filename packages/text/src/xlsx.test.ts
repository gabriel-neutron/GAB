import { expect, test } from 'vitest';

import { extractText, mimeOfFileName } from './extract.ts';
import { sheetCsv, sheetNames, textSetName, TABLE_READER, WorkbookFault } from './xlsx.ts';
import { workbookOf } from './xlsx-fixture.ts';

// A workbook in the shape of a tracker: a sheet of notes, and a sheet of fields.
const BOOK = workbookOf({
  About: [['A note'], ['Distributed under a licence']],
  'Field-level data': [
    ['Unit name', 'Country/Area', 'Latitude', 'Longitude', 'Notes'],
    ['Alpha, "north"', 'Russia', 61.25, 73.5, ''],
    ['Beta', 'Norway', 60.5, 5.25, 'x'],
    ['Gamma', 'Russia', 55, 37.5],
    [],
    ['Delta', 'Russia'],
  ],
});

test('a workbook gives the names of its sheets in order', () => {
  expect(sheetNames(BOOK)).toStrictEqual(['About', 'Field-level data']);
});

test('one sheet is a CSV table, with the quotes of RFC 4180 and rows of the width of the header', () => {
  expect(sheetCsv(BOOK, 'Field-level data')).toBe(
    [
      'Unit name,Country/Area,Latitude,Longitude,Notes',
      '"Alpha, ""north""",Russia,61.25,73.5,',
      'Beta,Norway,60.5,5.25,x',
      'Gamma,Russia,55,37.5,',
      'Delta,Russia,,,',
      '',
    ].join('\r\n'),
  );
});

test('a filter keeps the rows that hold one value in one column, and gives the same text each time', () => {
  const filter = { column: 'Country/Area', value: 'Russia' };
  const text = sheetCsv(BOOK, 'Field-level data', filter);

  expect(text.split('\r\n')).toStrictEqual([
    'Unit name,Country/Area,Latitude,Longitude,Notes',
    '"Alpha, ""north""",Russia,61.25,73.5,',
    'Gamma,Russia,55,37.5,',
    'Delta,Russia,,,',
    '',
  ]);
  expect(sheetCsv(BOOK, 'Field-level data', filter)).toBe(text);
});

test('the name of a text set holds the reader, the sheet and the filter', () => {
  expect(textSetName('Field-level data')).toBe(`${TABLE_READER}|sheet=Field-level data`);
  expect(textSetName('Field-level data', { column: 'Country/Area', value: 'Russia' })).toBe(
    `${TABLE_READER}|sheet=Field-level data|where=Country/Area=Russia`,
  );
});

test('a sheet or a column that the workbook lacks gives a sentence', () => {
  expect(() => sheetCsv(BOOK, 'Gas')).toThrow(WorkbookFault);
  expect(() => sheetCsv(BOOK, 'Field-level data', { column: 'Owner', value: 'x' })).toThrow(
    /no column "Owner"/u,
  );
});

test('bytes that are no zip archive give a sentence', () => {
  expect(() => sheetNames(new TextEncoder().encode('a,b\r\n1,2\r\n'))).toThrow(/no zip archive/u);
});

test('the text of a workbook is one CSV page for each sheet', async () => {
  const mime = mimeOfFileName('tracker.XLSX');
  expect(mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const { pages } = await extractText(BOOK, mime ?? '');

  expect(pages).toHaveLength(2);
  expect(pages[0]).toBe('A note\r\nDistributed under a licence\r\n');
  expect(pages[1]).toContain('Gamma,Russia,55,37.5,');
});
