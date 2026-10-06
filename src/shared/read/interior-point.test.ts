import { expect, test } from 'vitest';

import { interiorPointOf } from './interior-point';
import type { Area, Ring } from './model';

const SQUARE: Ring = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
  [0, 0],
];

// A U whose centroid falls in the gap between the two arms, so a centroid is a point outside.
const U: Ring = [
  [0, 0],
  [10, 0],
  [10, 10],
  [7, 10],
  [7, 3],
  [3, 3],
  [3, 10],
  [0, 10],
  [0, 0],
];

const inside = (ring: Ring, lon: number, lat: number): boolean => {
  let held = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) held = !held;
  }
  return held;
};

test('a convex polygon gives a point inside it', () => {
  const at = interiorPointOf([[SQUARE]]);
  expect(at).not.toBeNull();
  expect(inside(SQUARE, at?.lon ?? NaN, at?.lat ?? NaN)).toBe(true);
});

test('a concave polygon gives a point inside it, where its centroid is outside', () => {
  const at = interiorPointOf([[U]]);
  expect(inside(U, at?.lon ?? NaN, at?.lat ?? NaN)).toBe(true);
});

test('a hole is not inside the polygon', () => {
  const hole: Ring = [
    [1, 1],
    [1, 9],
    [9, 9],
    [9, 1],
    [1, 1],
  ];
  const at = interiorPointOf([[SQUARE, hole]]);
  expect(at).not.toBeNull();
  const lon = at?.lon ?? NaN;
  const lat = at?.lat ?? NaN;
  expect(inside(SQUARE, lon, lat) && !inside(hole, lon, lat)).toBe(true);
});

test('a multipolygon gives a point inside its largest polygon', () => {
  const small: Ring = [
    [20, 20],
    [21, 20],
    [21, 21],
    [20, 21],
    [20, 20],
  ];
  const area: Area = [[small], [SQUARE]];
  const at = interiorPointOf(area);
  expect(inside(SQUARE, at?.lon ?? NaN, at?.lat ?? NaN)).toBe(true);
});

test('the same area always gives the same point', () => {
  expect(interiorPointOf([[U]])).toStrictEqual(interiorPointOf([[U]]));
});

test('an area with no ring gives no point', () => {
  expect(interiorPointOf([])).toBeNull();
  expect(interiorPointOf([[]])).toBeNull();
});
