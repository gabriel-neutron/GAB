import { expect, test } from 'vitest';

import { isDay } from './day';

test('29 February stands in a year that four divides', () => {
  expect(isDay('2024-02-29')).toBe(true);
  expect(isDay('2023-02-29')).toBe(false);
});

test('29 February stands in a century year only when four hundred divides it', () => {
  expect(isDay('1900-02-29')).toBe(false);
  expect(isDay('2000-02-29')).toBe(true);
});

test('a month or a day the calendar does not hold is no day', () => {
  expect(isDay('2019-13-01')).toBe(false);
  expect(isDay('2019-02-30')).toBe(false);
  expect(isDay('2019-04-17')).toBe(true);
});
