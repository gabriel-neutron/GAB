import { expect, test } from 'vitest';

import { compare, passes, table } from './speed-budget-compare.ts';

const budget = {
  home: { mainContentMs: 3000, inputMs: 200, weightKb: 500 },
  map: { mainContentMs: 5000, inputMs: 300, weightKb: 2000, minFps: 20 },
};
const good = { mainContentMs: 2000, inputMs: 100, weightKb: 400 };

test('a measure inside each budget passes', () => {
  const rows = compare(budget, { home: good, map: { ...good, fps: 30 } });
  expect(rows).toHaveLength(7);
  expect(passes(rows)).toBe(true);
});

test('a time over the budget fails', () => {
  const rows = compare(budget, {
    home: { ...good, mainContentMs: 3001 },
    map: { ...good, fps: 30 },
  });
  expect(passes(rows)).toBe(false);
  expect(rows.filter((one) => one.status === 'fail').map((one) => one.metric)).toEqual([
    'main content',
  ]);
});

test('a frame rate under the minimum fails', () => {
  expect(passes(compare(budget, { home: good, map: { ...good, fps: 19 } }))).toBe(false);
});

test('a skipped page gives a skip row and does not fail', () => {
  const rows = compare(budget, { home: good, map: { skipped: 'no WebGL' } });
  expect(rows.at(-1)?.status).toBe('skip');
  expect(passes(rows)).toBe(true);
});

test('a page that nobody measured fails', () => {
  expect(passes(compare(budget, { home: good }))).toBe(false);
});

test('the table names each status', () => {
  expect(table(compare(budget, { home: good, map: { skipped: 'x' } }))).toContain('skip');
});
