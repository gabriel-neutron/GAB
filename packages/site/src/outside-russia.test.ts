import { expect, test } from 'vitest';

import { outsideRussia } from './outside-russia.ts';

const square = (west: number, south: number, east: number, north: number) => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  },
});

// A test map with two outlines: one that holds Moscow, and one beside it to the west.
const OUTLINES = JSON.stringify({
  type: 'FeatureCollection',
  features: [square(30, 40, 60, 70), square(20, 40, 30, 70)],
});

test('a position in the outline of another country is outside Russia', () => {
  expect(outsideRussia(OUTLINES)([25, 50])).toBe(true);
});

test('a position in the outline that holds Moscow is in Russia', () => {
  expect(outsideRussia(OUTLINES)([45, 50])).toBe(false);
});

test('a position at sea, in no outline, is not outside Russia', () => {
  expect(outsideRussia(OUTLINES)([10, 50])).toBe(false);
});
