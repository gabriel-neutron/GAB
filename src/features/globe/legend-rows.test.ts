import { expect, test } from 'vitest';

import { stageRows } from './legend-rows';

test('the rows are the six stages in chain order, then the grey of no stage', () => {
  const rows = stageRows([]);
  expect(rows.map((one) => one.key)).toEqual([
    'field',
    'transport',
    'processing',
    'export',
    'exit',
    'destination',
    'none',
  ]);
});

test('each row counts its points, and a point with no known stage counts as no stage', () => {
  const rows = stageRows(['field', 'field', 'export', '', undefined]);
  const count = (key: string): number | undefined => rows.find((one) => one.key === key)?.count;
  expect(count('field')).toBe(2);
  expect(count('export')).toBe(1);
  expect(count('exit')).toBe(0);
  expect(count('none')).toBe(2);
});
