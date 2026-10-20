import { expect, test } from 'vitest';

import { ARC_LAYERS } from './arc-layers';
import { lineRows, pointRows } from './legend-rows';

test('each style of line that the canvas draws has one row', () => {
  const styles = new Set(ARC_LAYERS.map((one) => one.style));
  expect(
    lineRows()
      .map((one) => one.style)
      .sort(),
  ).toEqual([...styles].sort());
});

test('a row has words of its own, not the name of the style', () => {
  for (const row of lineRows()) expect(row.label).not.toBe(row.style);
});

test('the legend takes the dash of the canvas', () => {
  const dashed = lineRows().find((one) => one.style === 'dashed');
  expect(dashed?.dash).toEqual(ARC_LAYERS.find((one) => one.id === 'arcs-dashed')?.dash);
  expect(lineRows().find((one) => one.style === 'capacity')?.hollow).toBe(true);
  expect(lineRows().find((one) => one.style === 'in review')?.review).toBe(true);
});

test('the points are the six stages, then the grey of no stage', () => {
  const rows = pointRows();
  expect(rows).toHaveLength(7);
  expect(rows.at(-1)?.key).toBe('none');
});
