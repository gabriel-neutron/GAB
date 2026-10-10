import { expect, test } from 'vitest';

import { KOROLEV_PROSPECT, UK_HEADER, ukRow } from './uk-list-fixture.ts';
import { missingColumn, reportDay, ukEntry } from './uk-sanctions-list.ts';

const lines = (...rows: readonly string[]): string =>
  `Report Date: 08-Oct-2026\n${UK_HEADER}\n${rows.join('\n')}\n`;

const PAGE = lines(
  // The first line of this entry is an alias, and its second line is the primary name.
  ukRow({ 'Unique ID': 'AFG0001', 'Name 6': 'HAJI ALIM HAWALA', 'Name type': 'Alias' }),
  ukRow({
    'Last Updated': '04/08/2026',
    'Unique ID': 'AFG0001',
    'Name 6': 'HAJI KHAIRULLAH MONEY EXCHANGE',
    'Name type': 'primary name',
    'Designation source': 'UN',
    'Date Designated': '29/06/2012',
  }),
  // A quoted value holds a line break and a text that looks like the start of another entry.
  ukRow({
    'Unique ID': 'DPR0001',
    'Name 6': 'DECOY',
    'Name type': 'Primary Name',
    'Other Information': 'see\n01/01/2020,RUS2176,,,NOT THE SHIP,,,,,,Primary Name',
  }),
  KOROLEV_PROSPECT,
  // An entry with no primary name gives its first line.
  ukRow({ 'Unique ID': 'SYR0001', 'Name 6': 'FIRST ALIAS', 'Name type': 'Alias' }),
  ukRow({ 'Unique ID': 'SYR0001', 'Name 6': 'SECOND ALIAS', 'Name type': 'Alias' }),
);

test('a ship gives its identity and its identifiers from its own line, with the IMO number', () => {
  expect(ukEntry(PAGE, 'RUS2176')).toStrictEqual({
    identity:
      '31/07/2024,RUS2176,,,KOROLEV PROSPECT,,,,,,Primary Name,,,,,,' +
      'The Russia (Sanctions) (EU Exit) Regulations 2019,Ship,UK',
    identifiers:
      '31/07/2024,,,,,,,,,,,,,,,IMO9826902,Stream Ship Management FZCO,,Gabon,,Oil Tanker,,,2019,',
  });
  expect(KOROLEV_PROSPECT.length).toBeGreaterThan(600);
});

test('the line of the primary name is chosen over an alias that comes first', () => {
  const entry = ukEntry(PAGE, 'AFG0001');
  expect(entry?.identity).toMatch(/^04\/08\/2026,AFG0001,.*HAJI KHAIRULLAH.*primary name.*,UN$/u);
  expect(entry?.identifiers.startsWith('29/06/2012,')).toBe(true);
});

test('an entry with no primary name gives its first line', () => {
  expect(ukEntry(PAGE, 'SYR0001')?.identity).toContain('FIRST ALIAS');
});

test.each(['RUS0001', 'AFG000', 'Unique ID'])('the file holds no entry %s', (id) => {
  expect(ukEntry(PAGE, id)).toBeNull();
});

test('each excerpt is a part of the page, and stays under the cap of an excerpt', () => {
  const long = 'X'.repeat(700);
  const page = lines(
    ukRow({ 'Unique ID': 'RUS0005', 'Name 6': long, 'Date Designated': '01/01/2026' }),
  );
  const entry = ukEntry(page, 'RUS0005');
  expect(entry?.identity).toHaveLength(600);
  expect(page.includes(entry?.identity ?? '-')).toBe(true);
  expect(page.includes(entry?.identifiers ?? '-')).toBe(true);
});

test.each([
  [lines(), null],
  [`Report Date: 08-Oct-2026\n${UK_HEADER.replace(',IMO number,', ',IMO,')}\n`, 'IMO number'],
  [`Report Date: 08-Oct-2026\nLast Updated,Name 6\n`, 'Unique ID'],
  ['Report Date: 08-Oct-2026\n', 'Unique ID'],
])('a header lacks a column the tool reads', (page, column) => {
  expect(missingColumn(page)).toBe(column);
});

test.each([
  ['Report Date: 08-Oct-2026\nLast Updated', '2026-10-08'],
  ['﻿Report Date: 01-Jan-2027\r\n', '2027-01-01'],
  ['Report Date: 31-Feb-2026\n', null],
  ['Report Date: 8 October 2026\n', null],
  ['Last Updated,Unique ID\n', null],
])('the report date of %j is %s', (page, day) => {
  expect(reportDay(page)).toBe(day);
});
