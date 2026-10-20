import { expect, test } from 'vitest';

import { markTimeWords } from './mark-time';

test('a day mark names its key and the day', () => {
  expect(markTimeWords({ kind: 'day', key: 'observed_on', day: '2026-03-02' })).toBe(
    'On Observed on: 02/03/2026.',
  );
});

test('a mark with no date says so', () => {
  expect(markTimeWords({ kind: 'no date' })).toBe('The release gives no date.');
});

test('an interval with no end is open and does not say that the relation ended', () => {
  expect(markTimeWords({ kind: 'interval', from: '2024-01-05', to: null, endClaim: null })).toBe(
    'From 05/01/2024, open: no end date recorded.',
  );
});

test('an interval with a known end gives both days', () => {
  expect(
    markTimeWords({ kind: 'interval', from: '2024-01-05', to: '2025-06-30', endClaim: null }),
  ).toBe('From 05/01/2024, to 30/06/2025.');
});

test('an interval with no start says that the start is unknown', () => {
  expect(markTimeWords({ kind: 'interval', from: null, to: '2025-06-30', endClaim: null })).toBe(
    'Start unknown. End to 30/06/2025.',
  );
  expect(markTimeWords({ kind: 'interval', from: null, to: null, endClaim: null })).toBe(
    'Start unknown. End open: no end date recorded.',
  );
});
