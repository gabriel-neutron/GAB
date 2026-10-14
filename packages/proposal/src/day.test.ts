import { expect, test } from 'vitest';

import { day, isDay } from './day.ts';

test.each(['2024-02-29', '2026-12-31', '2026-01-01'])('%s is a day of the calendar', (value) => {
  expect(isDay(value)).toBe(true);
  expect(day.safeParse(value).success).toBe(true);
});

test.each([
  '2026-02-30',
  '2025-02-29',
  '2026-13-01',
  '2026-1-1',
  '2026-01-31T00:00:00Z',
  20260131,
  null,
])('%s is no day of the calendar', (value) => {
  expect(isDay(value)).toBe(false);
  expect(day.safeParse(value).success).toBe(false);
});
