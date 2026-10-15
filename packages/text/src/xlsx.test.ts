import { expect, test } from 'vitest';

import { extractText, mimeOfFileName } from './extract.ts';
import {
  MAX_PART_BYTES,
  MAX_TABLE_CHARS,
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

test('a cell after the last column of a sheet refuses the file, and allocates no row of that width', async () => {
  const head = '<row r="1"><c r="A1" t="inlineStr"><is><t>Name</t></is></c></row>';
  for (const reference of ['XFE2', 'ZZZZZZZZZZ2']) {
    const book = workbookOf({ Wide: `${head}<row r="2"><c r="${reference}"><v>1</v></c></row>` });
    await expect(sheetCsv(book, 'Wide')).rejects.toThrow(/after the last column/u);
  }
});

test('cells with no reference past the last column refuse the file', async () => {
  const row = (cells: string): string => `<row r="1">${cells}</row>`;
  const tooMany = workbookOf({ Wide: row('<c><v>1</v></c>'.repeat(16_385)) });
  await expect(sheetCsv(tooMany, 'Wide')).rejects.toThrow(/after the last column/u);
  const afterLast = workbookOf({ Wide: row('<c r="XFD1"><v>1</v></c><c><v>2</v></c>') });
  await expect(sheetCsv(afterLast, 'Wide')).rejects.toThrow(/after the last column/u);
});

test('the last column XFD is a column', async () => {
  const book = workbookOf({
    Wide: '<row r="1"><c r="A1" t="inlineStr"><is><t>First</t></is></c><c r="XFD1" t="inlineStr"><is><t>Last</t></is></c></row>',
  });
  const first = (await sheetCsv(book, 'Wide')).split('\r\n')[0] ?? '';
  expect(first.split(',')).toHaveLength(16384);
});

test('a cell with no reference takes the column after the previous cell', async () => {
  const book = workbookOf({
    Gap: '<row r="1"><c r="A1"><v>1</v></c><c r="B1"><v>2</v></c><c r="C1"><v>3</v></c><c r="D1"><v>4</v></c><c r="E1"><v>5</v></c></row><row r="2"><c t="inlineStr"><is><t>a</t></is></c><c><v>2</v></c><c r="D2"><v>4</v></c><c><v>5</v></c></row>',
  });
  expect(await sheetCsv(book, 'Gap')).toBe('1,2,3,4,5\r\na,2,,4,5\r\n');
});

test(
  'the character cap applies to the whole workbook and not to each sheet',
  { timeout: 60_000 },
  async () => {
    const big = 'x'.repeat(1024 * 1024);
    const rows = Math.ceil(MAX_TABLE_CHARS / 2 / big.length) + 1;
    const sheet = [['Name'], ...Array.from({ length: rows }, () => [big])];
    const book = workbookOf({ A: sheet, B: sheet });
    await expect(sheetCsv(book, 'A')).resolves.toContain('Name');
    await expect(workbookCsvs(book)).rejects.toThrow(/keeps more than/u);
  },
);
