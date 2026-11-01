import { expect, test } from 'vitest';

import { readCsv } from '@gab/tools/csv';
import { mappingDraft, isWideTable } from '@gab/proposal/mapping';

import { periodOf, wideCells } from './observation.ts';

test.each([
  ['2024', 'year', '2024'],
  ['2024-Q3', 'quarter', '2024-Q3'],
  ['2024-03', 'month', '2024-03'],
  ['202403', 'month', '2024-03'],
  ['2024M03', 'month', '2024-03'],
  ['2024M13', 'month', null],
  ['2024-W05', 'week', '2024-W05'],
  ['2024-13', 'month', null],
  ['2024-03', 'year', null],
  ['202403', 'year', null],
  ['2024-W54', 'week', null],
] as const)('the period %s of one %s reads as %s', (text, length, period) => {
  expect(periodOf(text, length)).toBe(period);
});

const WIDE = [
  'Section,Item,2018-01,2018-02,Total 2018,2018-03',
  'Total,Revenue,100.5,-3.2,97.3,-',
  'Oil,Revenue,40,,40,12.5',
  '"Other, misc",Revenue,7,8,15,9',
  'Gas,Revenue,1,1,2,1',
].join('\n');

const wideDraft = mappingDraft.parse({
  table: 'revenue',
  modality: 'asserts',
  rows: {
    wide: {
      rows: [
        { position: 1, measure: 'revenue_total' },
        { position: 2, measure: 'revenue_oil' },
        { position: 3, measure: 'revenue_other' },
      ],
    },
    unit: { constant: 'billion roubles' },
    method: 'monthly revenue',
  },
  relations: [],
});

test('a wide table gives one figure for each month cell of the rows that the mapping names', () => {
  const [head, ...records] = readCsv(WIDE);
  const header = head?.fields ?? [];
  expect(isWideTable(wideDraft.rows)).toBe(true);
  if (!isWideTable(wideDraft.rows)) return;
  const cells = wideCells(wideDraft.rows, header, records, { textSet: 'set', page: 1 });
  const words = cells.map((cell) =>
    'refused' in cell
      ? `${String(cell.at.row)}: ${cell.refused}`
      : `${String(cell.at.row)}: ${cell.figure['measure'] ?? ''} ${cell.figure['period'] ?? ''} ${cell.figure['value'] ?? ''}`,
  );
  // The annual total is no period, an empty cell is not applicable, and "-" is a refused cell.
  expect(words).toStrictEqual([
    '1: revenue_total 2018-01 100.5 billion roubles',
    '1: revenue_total 2018-02 -3.2 billion roubles',
    '1: the source has no data for 2018-03 ("-")',
    '2: revenue_oil 2018-01 40 billion roubles',
    '2: revenue_oil 2018-03 12.5 billion roubles',
    '3: revenue_other 2018-01 7 billion roubles',
    '3: revenue_other 2018-02 8 billion roubles',
    '3: revenue_other 2018-03 9 billion roubles',
  ]);
  // The cited span is the cell itself, also behind a quoted field with a comma.
  const spans = cells.flatMap((cell) =>
    'row' in cell ? [WIDE.slice(cell.at.start, cell.at.end)] : [],
  );
  expect(spans).toStrictEqual(['100.5', '-3.2', '40', '12.5', '7', '8', '9']);
});

test('a wide table refuses two rows with the same position or the same measure', () => {
  const twice = (rows: unknown[]) =>
    mappingDraft.safeParse({
      ...wideDraft,
      rows: { wide: { rows }, unit: { constant: 'u' }, method: 'm' },
    }).success;
  expect(
    twice([
      { position: 1, measure: 'a' },
      { position: 1, measure: 'b' },
    ]),
  ).toBe(false);
  expect(
    twice([
      { position: 1, measure: 'a' },
      { position: 2, measure: 'a' },
    ]),
  ).toBe(false);
  expect(
    twice([
      { position: 1, measure: 'a' },
      { position: 2, measure: 'b' },
    ]),
  ).toBe(true);
});

test('a header that states one month twice gives no figure for that month', () => {
  const text = ['Section,2018-01,2018M01,2018-02', 'Total,1,2,3'].join('\n');
  const [head, ...records] = readCsv(text);
  if (!isWideTable(wideDraft.rows)) throw new Error('the draft is a wide table');
  const cells = wideCells(wideDraft.rows, head?.fields ?? [], records, { textSet: 's', page: 1 });
  expect(
    cells.map((cell) => ('refused' in cell ? cell.refused : cell.figure['period'])),
  ).toStrictEqual([
    'the header states the month 2018-01 twice',
    'the header states the month 2018-01 twice',
    '2018-02',
  ]);
});

test('the span of a cell is the text of its field, without the white space around it', () => {
  const text = ['Section,2018-01', 'Total,  5.5  '].join('\n');
  const [head, ...records] = readCsv(text);
  if (!isWideTable(wideDraft.rows)) throw new Error('the draft is a wide table');
  const [cell] = wideCells(wideDraft.rows, head?.fields ?? [], records, { textSet: 's', page: 1 });
  expect(cell && text.slice(cell.at.start, cell.at.end)).toBe('5.5');
});
