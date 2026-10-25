import { expect, test } from 'vitest';

import { areaOf, periodOf } from './observation.ts';

test('a code of Eurostat becomes a code of the area list', () => {
  expect(areaOf('DE', 'eurostat')).toStrictEqual({ system: 'iso3166', code: 'DE' });
  expect(areaOf('EL', 'eurostat')).toStrictEqual({ system: 'iso3166', code: 'GR' });
  expect(areaOf('UK', 'eurostat')).toStrictEqual({ system: 'iso3166', code: 'GB' });
  expect(areaOf('EU27_2020', 'eurostat')).toStrictEqual({ system: 'group', code: 'EU27' });
  expect(areaOf('TOTAL', 'eurostat')).toStrictEqual({ system: 'group', code: 'WORLD' });
  expect(areaOf('NSP', 'eurostat')).toStrictEqual({ system: 'group', code: 'OTHER' });
  expect(areaOf('EUR_OTH', 'eurostat')).toBeNull();
});

test('an ISO code stays as it is, and a group of Eurostat is no ISO code', () => {
  expect(areaOf('EL', 'iso3166')).toStrictEqual({ system: 'iso3166', code: 'EL' });
  expect(areaOf('EU27_2020', 'iso3166')).toBeNull();
  expect(areaOf('de', 'iso3166')).toBeNull();
});

test.each([
  ['2024', 'year', '2024'],
  ['2024-Q3', 'quarter', '2024-Q3'],
  ['2024-03', 'month', '2024-03'],
  ['202403', 'month', '2024-03'],
  ['2024-W05', 'week', '2024-W05'],
  ['2024-13', 'month', null],
  ['2024-03', 'year', null],
  ['202403', 'year', null],
  ['2024-W54', 'week', null],
] as const)('the period %s of one %s reads as %s', (text, length, period) => {
  expect(periodOf(text, length)).toBe(period);
});
