import { expect, test } from 'vitest';

import { extractText, mimeOfFileName } from './extract.ts';
import {
  MAX_PART_BYTES,
  sheetCsv,
  sheetNames,
  textSetName,
  TABLE_READER,
  WorkbookFault,
  workbookCsvs,
} from './xlsx.ts';
import { workbookOf } from './xlsx-fixture.ts';

// A workbook in the shape of a tracker: a sheet of notes, and a sheet of fields.
const SHEETS = {
  About: [['A note'], ['Distributed under a licence']],
  'Field-level data': [
    ['Unit name', 'Country/Area', 'Latitude', 'Longitude', 'Notes'],
    ['Alpha, "north"', 'Russia', 61.25, 73.5, ''],
    ['Beta', 'Norway', 60.5, 5.25, 'x'],
    ['Gamma', 'Russia', 55, 37.5],
    [],
    ['Delta', 'Russia'],
  ],
};
const BOOK = workbookOf(SHEETS);

test('a workbook gives the names of its sheets in order', async () => {
  expect(await sheetNames(BOOK)).toStrictEqual(['About', 'Field-level data']);
});

test('one sheet is a CSV table, with the quotes of RFC 4180 and rows of the width of the header', async () => {
  expect(await sheetCsv(BOOK, 'Field-level data')).toBe(
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

test('a filter keeps the rows that hold one value in one column, and gives the same text each time', async () => {
  const filter = { column: 'Country/Area', value: 'Russia' };
  const text = await sheetCsv(BOOK, 'Field-level data', filter);

  expect(text.split('\r\n')).toStrictEqual([
    'Unit name,Country/Area,Latitude,Longitude,Notes',
    '"Alpha, ""north""",Russia,61.25,73.5,',
    'Gamma,Russia,55,37.5,',
    'Delta,Russia,,,',
    '',
  ]);
  expect(await sheetCsv(BOOK, 'Field-level data', filter)).toBe(text);
});

test('a limit stops the read after that many kept rows', async () => {
  const text = await sheetCsv(BOOK, 'Field-level data', undefined, 1);

  expect(text.split('\r\n')).toHaveLength(3);
});

test('the name of a text set holds the reader, the sheet and the filter', () => {
  expect(textSetName('Field-level data')).toBe(`${TABLE_READER}|sheet=Field-level data`);
  expect(textSetName('Field-level data', { column: 'Country/Area', value: 'Russia' })).toBe(
    `${TABLE_READER}|sheet=Field-level data|where=Country/Area=Russia`,
  );
});

test('a sheet or a column that the workbook lacks gives a sentence', async () => {
  await expect(sheetCsv(BOOK, 'Gas')).rejects.toThrow(WorkbookFault);
  await expect(sheetCsv(BOOK, 'Field-level data', { column: 'Owner', value: 'x' })).rejects.toThrow(
    /no column "Owner"/u,
  );
});

test('bytes that are no zip archive give a sentence', async () => {
  await expect(sheetNames(new TextEncoder().encode('a,b\r\n1,2\r\n'))).rejects.toThrow(
    /no zip archive/u,
  );
});

test('the text of a workbook is one CSV page for each sheet', async () => {
  const mime = mimeOfFileName('tracker.XLSX');
  expect(mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const { pages } = await extractText(BOOK, mime ?? '');

  expect(pages).toHaveLength(2);
  expect(pages[0]).toBe('A note\r\nDistributed under a licence\r\n');
  expect(pages[1]).toContain('Gamma,Russia,55,37.5,');
});

test('every sheet of a workbook is one CSV page, with the shared strings read once', async () => {
  const pages = await workbookCsvs(BOOK);

  expect(pages).toStrictEqual([
    await sheetCsv(BOOK, 'About'),
    await sheetCsv(BOOK, 'Field-level data'),
  ]);
  expect(pages[1]).toContain('"Alpha, ""north""",Russia,61.25,73.5,');
});

test('a Zip64 archive reads as a plain archive does', async () => {
  const book = workbookOf(SHEETS, true);

  expect(await sheetCsv(book, 'Field-level data')).toBe(await sheetCsv(BOOK, 'Field-level data'));
});

test('a part that inflates past the cap is refused', async () => {
  const bomb = workbookOf({ Big: [['Name'], ['a'.repeat(MAX_PART_BYTES + 1)]] });

  await expect(sheetCsv(bomb, 'Big')).rejects.toThrow(/inflates to more than/u);
});
