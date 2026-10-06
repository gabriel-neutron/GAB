import { expect, test } from 'vitest';

import { castCell, dayOf } from './cast.ts';
import { lookupOrder, reportOf } from './loader.ts';

test('each cast of the closed set turns a cell into one value', () => {
  expect(castCell({ type: 'text' }, 'flag', 'Panama')).toStrictEqual({ ok: true, value: 'Panama' });
  expect(castCell({ type: 'number', scale: 2 }, 'length_m', '182.25')).toStrictEqual({
    ok: true,
    value: 182.25,
  });
  expect(castCell({ type: 'identifier' }, 'imo', '9100009')).toStrictEqual({
    ok: true,
    value: '9100009',
  });
  expect(castCell({ type: 'date', pattern: 'DD.MM.YYYY' }, 'built', '03.05.2001')).toStrictEqual({
    ok: true,
    value: '2001-05-03',
  });
  expect(castCell({ type: 'boolean' }, 'listed', 'Yes')).toStrictEqual({ ok: true, value: true });
  expect(castCell({ type: 'list', separator: ';' }, 'aliases', 'A; B;;C')).toStrictEqual({
    ok: true,
    value: ['A', 'B', 'C'],
  });
});

const REFUSED = [
  [{ type: 'number', scale: 1 }, 'length_m', '182.25', /scale is 1/u],
  [{ type: 'number', scale: 0 }, 'length_m', '1,000', /not a number/u],
  [{ type: 'identifier' }, 'imo', '1234568', /check digit/u],
  [{ type: 'date', pattern: 'YYYY-MM-DD' }, 'built', '2001-02-30', /not a day/u],
  [{ type: 'date', pattern: 'MM/DD/YYYY' }, 'built', '13/01/2001', /not a day/u],
  [{ type: 'boolean' }, 'listed', 'perhaps', /not true or false/u],
] as const;

for (const [cast, key, text, reason] of REFUSED)
  test(`the cast ${cast.type} refuses "${text}"`, () => {
    const cell = castCell(cast, key, text);
    expect(cell.ok).toBe(false);
    if (!cell.ok) expect(cell.reason).toMatch(reason);
  });

test('a date pattern reads the year, the month and the day from their places', () => {
  expect(dayOf('05/03/2001', 'MM/DD/YYYY')).toBe('2001-05-03');
  expect(dayOf('05/03/2001', 'DD/MM/YYYY')).toBe('2001-03-05');
  expect(dayOf('2024-02-29', 'YYYY-MM-DD')).toBe('2024-02-29');
  expect(dayOf('2023-02-29', 'YYYY-MM-DD')).toBeNull();
});

test('the lookup tries imo, then opensanctions_id, then the other keys in order, then the name', () => {
  const given = [
    { key: 'label', column: 'Name' },
    { key: 'lei', column: 'LEI' },
    { key: 'opensanctions_id', column: 'OS' },
    { key: 'imo', column: 'IMO' },
  ] as const;
  expect(lookupOrder(given).map((one) => one.key)).toStrictEqual([
    'imo',
    'opensanctions_id',
    'lei',
    'label',
  ]);
});

test('the lookup tries only the keys that the mapping names', () => {
  expect(lookupOrder([{ key: 'lei', column: 'LEI' }]).map((one) => one.key)).toStrictEqual(['lei']);
});

test('the report names the load and its counts, then gives one CSV line for each row, in row order', () => {
  const totals = { document: 'doc_a', mapping: 'm1', job: 'j1', read: 3, loaded: 1, excluded: 2 };
  const report = reportOf(totals, [
    { row: 3, page: 1, start: 30, end: 40, reason: 'the cell "a, b" is not a number' },
    {
      row: 1,
      page: 1,
      start: 5,
      end: 12,
      reason: 'relation not loaded: the other end is not in the record',
    },
  ]);
  expect(report).toBe(
    '# document doc_a; mapping m1; job j1; read 3; loaded 1; excluded 2\r\n' +
      'row,page,start,end,reason\r\n' +
      '1,1,5,12,relation not loaded: the other end is not in the record\r\n' +
      '3,1,30,40,"the cell ""a, b"" is not a number"\r\n',
  );
  expect(reportOf({ ...totals, job: 'j2' }, [])).not.toBe(reportOf(totals, []));
});
