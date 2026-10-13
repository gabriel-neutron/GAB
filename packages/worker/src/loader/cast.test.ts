import { expect, test } from 'vitest';

import { castCell, dayOf } from './cast.ts';
import { lookupOrder } from './join.ts';
import { reportOf } from './loader.ts';

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

test('the Russian register cast gives a tax number of ten digits with its leading zero', () => {
  const cast = { type: 'ru_register' } as const;
  expect(castCell(cast, 'tax_id', '7706107510')).toStrictEqual({ ok: true, value: '7706107510' });
  // A workbook keeps a tax number as a number, and a number loses its leading zero.
  expect(castCell(cast, 'tax_id', '105012345')).toStrictEqual({ ok: true, value: '0105012345' });
  expect(castCell(cast, 'tax_id', '77061075120')).toStrictEqual({
    ok: true,
    value: '077061075120',
  });
  expect(castCell(cast, 'registration_number', '1027700043502')).toStrictEqual({
    ok: true,
    value: '1027700043502',
  });
});

const SKIPPED = [
  [{ type: 'ru_register' }, 'tax_id', '1027700043502', /registration number/u],
  [{ type: 'ru_register' }, 'registration_number', '7706107510', /tax number/u],
  [{ type: 'ru_register' }, 'tax_id', 'not found', /not a number of the Russian register/u],
  [{ type: 'ru_register' }, 'registration_number', '12345', /not a number of the Russian/u],
  [{ type: 'identifier' }, 'lei', 'not found', /not a LEI/u],
  [{ type: 'identifier' }, 'lei', '253400JT3MQWNDKMJE45', /not a LEI/u],
] as const;

for (const [cast, key, text, reason] of SKIPPED)
  test(`the cast ${cast.type} of ${key} skips "${text}", and the row keeps its other cells`, () => {
    const cell = castCell(cast, key, text);
    expect(cell.ok).toBe('skip');
    if (cell.ok === 'skip') expect(cell.reason).toMatch(reason);
  });

test('a LEI in its legal form loads in capitals', () => {
  expect(castCell({ type: 'identifier' }, 'lei', '253400jt3mqwndkmje44')).toStrictEqual({
    ok: true,
    value: '253400JT3MQWNDKMJE44',
  });
});

test('a date pattern reads the year, the month and the day from their places', () => {
  expect(dayOf('05/03/2001', 'MM/DD/YYYY')).toBe('2001-05-03');
  expect(dayOf('05/03/2001', 'DD/MM/YYYY')).toBe('2001-03-05');
  expect(dayOf('2024-02-29', 'YYYY-MM-DD')).toBe('2024-02-29');
  expect(dayOf('2023-02-29', 'YYYY-MM-DD')).toBeNull();
});

test('the lookup tries the GEM identifiers, the tax number, the LEI and the place codes, then the other keys in order, then the name', () => {
  const given = [
    { key: 'label', column: 'Name' },
    { key: 'ofac_uid', column: 'OFAC' },
    { key: 'osm_id', column: 'OSM' },
    { key: 'lei', column: 'LEI' },
    { key: 'tax_id', column: 'INN' },
    { key: 'gem_entity_id', column: 'Entity ID' },
    { key: 'opensanctions_id', column: 'OS' },
    { key: 'imo', column: 'IMO' },
  ] as const;
  expect(lookupOrder(given).map((one) => one.key)).toStrictEqual([
    'imo',
    'opensanctions_id',
    'gem_entity_id',
    'tax_id',
    'lei',
    'osm_id',
    'ofac_uid',
    'label',
  ]);
});

test('the lookup tries only the keys that the mapping names', () => {
  expect(lookupOrder([{ key: 'lei', column: 'LEI' }]).map((one) => one.key)).toStrictEqual(['lei']);
});

test('the report names the load and its counts, then gives one CSV line for each row, in row order', () => {
  const totals = {
    document: 'doc_a',
    mapping: 'm1',
    job: 'j1',
    read: 3,
    loaded: 1,
    excluded: 2,
    dropped: 0,
  };
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
    '# document doc_a; mapping m1; job j1; read 3; loaded 1; excluded 2; dropped 0\r\n' +
      'row,page,start,end,reason\r\n' +
      '1,1,5,12,relation not loaded: the other end is not in the record\r\n' +
      '3,1,30,40,"the cell ""a, b"" is not a number"\r\n',
  );
  expect(reportOf({ ...totals, job: 'j2' }, [])).not.toBe(reportOf(totals, []));
});

test('a dropped link has no row, and its line comes after the lines of the rows', () => {
  const totals = {
    document: 'doc_b',
    mapping: 'm1',
    job: 'j1',
    read: 1,
    loaded: 1,
    excluded: 0,
    dropped: 1,
  };
  expect(
    reportOf(totals, [
      { row: null, page: null, start: null, end: null, reason: 'the edition no longer gives r1' },
      { row: 1, page: 1, start: 5, end: 12, reason: 'a note' },
    ]),
  ).toBe(
    '# document doc_b; mapping m1; job j1; read 1; loaded 1; excluded 0; dropped 1\r\n' +
      'row,page,start,end,reason\r\n' +
      '1,1,5,12,a note\r\n' +
      ',,,,the edition no longer gives r1\r\n',
  );
});
