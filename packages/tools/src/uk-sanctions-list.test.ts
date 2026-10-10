import { expect, test } from 'vitest';

import { reportDay, ukEntryLine } from './uk-sanctions-list.ts';

const HEADER = 'Last Updated,Unique ID,OFSI Group ID,UN Reference Number,Name 6,Name type';

const CSV =
  'Report Date: 08-Oct-2026\n' +
  `${HEADER}\n` +
  '04/08/2026,AFG0001,12703,TAe.010,HAJI KHAIRULLAH MONEY EXCHANGE,Primary Name\n' +
  '04/08/2026,AFG0001,12703,TAe.010,Haji Alim Hawala,Alias\n' +
  '18/12/2021,DPR0075,,,"Petrel 8, a ship",Primary Name\n' +
  '18/12/2021,RUS1500,,,"named after RUS0001,",Primary Name\n';

test.each([
  ['AFG0001', '04/08/2026,AFG0001,12703,TAe.010,HAJI KHAIRULLAH MONEY EXCHANGE,Primary Name'],
  ['DPR0075', '18/12/2021,DPR0075,,,"Petrel 8, a ship",Primary Name'],
  ['RUS0001', null],
  ['AFG000', null],
  ['Unique ID', null],
])('the first line of entry %s is found by the second column alone', (id, line) => {
  expect(ukEntryLine(CSV, id)).toBe(line);
});

test('a long line is clipped to the cap of an excerpt, and stays a quote of the file', () => {
  const long = `01/01/2026,RUS0005,1,,"${'X'.repeat(800)}"\n`;
  const line = ukEntryLine(long, 'RUS0005') ?? '';
  expect(line).toHaveLength(600);
  expect(long.startsWith(line)).toBe(true);
});

test.each([
  ['Report Date: 08-Oct-2026\nLast Updated', '2026-10-08'],
  ['\uFEFFReport Date: 01-Jan-2027\r\n', '2027-01-01'],
  ['Report Date: 31-Feb-2026\n', null],
  ['Report Date: 8 October 2026\n', null],
  ['Last Updated,Unique ID\n', null],
])('the report date of %j is %s', (page, day) => {
  expect(reportDay(page)).toBe(day);
});
