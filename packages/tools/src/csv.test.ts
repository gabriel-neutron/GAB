import { expect, test } from 'vitest';

import { CsvFault, readCsv, readTsv } from './csv.ts';
import { headerSignature } from './header-signature.ts';

const slice = (page: string, start: number, end: number): string =>
  Array.from(page).slice(start, end).join('');

test('each record gives its fields and its span in code points, with no line break', () => {
  const page = 'a,b\r\n1,2\n3,4';
  const records = readCsv(page);
  expect(records.map((record) => record.fields)).toStrictEqual([
    ['a', 'b'],
    ['1', '2'],
    ['3', '4'],
  ]);
  expect(records.map((record) => slice(page, record.start, record.end))).toStrictEqual([
    'a,b',
    '1,2',
    '3,4',
  ]);
});

test('a quoted field holds a comma, a line break and a doubled quote, in one record', () => {
  const page = 'name,note\n"Nayara, Star","line one\nline ""two"""\n';
  const [, row] = readCsv(page);
  expect(row?.fields).toStrictEqual(['Nayara, Star', 'line one\nline "two"']);
  expect(slice(page, row?.start ?? 0, row?.end ?? 0)).toBe(
    '"Nayara, Star","line one\nline ""two"""',
  );
});

test('the offsets count code points, so a character outside the basic plane counts once', () => {
  const page = 'name\n𝔄lpha\nBeta';
  const records = readCsv(page);
  expect(records.map((record) => [record.start, record.end])).toStrictEqual([
    [0, 4],
    [5, 10],
    [11, 15],
  ]);
});

test('a byte order mark is not part of the first column name, and its offset still counts', () => {
  const [header] = readCsv('﻿name,imo\n');
  expect(header?.fields).toStrictEqual(['name', 'imo']);
  expect(header?.start).toBe(1);
});

test('an empty line is no record, and an empty field is an empty string', () => {
  expect(readCsv('a,b\n\n,2\n\n').map((record) => record.fields)).toStrictEqual([
    ['a', 'b'],
    ['', '2'],
  ]);
});

test('a quote that never closes stops the read', () => {
  expect(() => readCsv('a\n"open\n')).toThrow(CsvFault);
});

test('the signature changes with the order of the columns', () => {
  expect(headerSignature(['a', 'b'])).toMatch(/^[0-9a-f]{64}$/u);
  expect(headerSignature(['a', 'b'])).not.toBe(headerSignature(['b', 'a']));
  expect(headerSignature(['a,b'])).not.toBe(headerSignature(['a', 'b']));
});

test('a TSV record splits at each tab, and a quote or a comma is a character of its field', () => {
  const page = '﻿name\tnote\r\n"Nayara, Star"\t5" pipe\n\nlast\t\n';
  const records = readTsv(page);
  expect(records.map((record) => record.fields)).toStrictEqual([
    ['name', 'note'],
    ['"Nayara, Star"', '5" pipe'],
    ['last', ''],
  ]);
  expect(records.map((record) => slice(page, record.start, record.end))).toStrictEqual([
    'name\tnote',
    '"Nayara, Star"\t5" pipe',
    'last\t',
  ]);
});

test('the TSV of Eurostat keeps its dimensions in one column and a column for each period', () => {
  const page =
    'freq,reporter,partner,product,flow,indicators\\TIME_PERIOD\t2026-07 \n' +
    'M,HU,RU,27090090,1,QUANTITY_IN_100KG\t3272070.00\n';
  expect(readTsv(page).map((record) => record.fields)).toStrictEqual([
    ['freq,reporter,partner,product,flow,indicators\\TIME_PERIOD', '2026-07 '],
    ['M,HU,RU,27090090,1,QUANTITY_IN_100KG', '3272070.00'],
  ]);
});
