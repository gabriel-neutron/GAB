import { expect, test } from 'vitest';

import { pointRows } from './legend-rows';

test('the points are the six stages, then the grey of no stage', () => {
  const rows = pointRows();
  expect(rows).toHaveLength(7);
  expect(rows.at(-1)?.key).toBe('none');
});
