import { expect, test } from 'vitest';

import { periodOf } from './observation.ts';

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
