import { expect, test } from 'vitest';

import { backoffMs } from './backoff.ts';

test('the first attempt waits the base delay', () => {
  expect(backoffMs(1)).toBe(1000);
});

test('each lost claim doubles the wait', () => {
  expect(backoffMs(2)).toBe(2000);
  expect(backoffMs(3)).toBe(4000);
});

test('the wait never grows past the cap', () => {
  expect(backoffMs(20)).toBe(30_000);
});

test('an attempt count below one waits no longer than the base delay', () => {
  expect(backoffMs(0)).toBe(1000);
});
