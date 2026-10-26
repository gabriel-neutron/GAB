import { describe, expect, it } from 'vitest';

import type { GeoEntity } from './projection';
import { shapeFeatureOf } from './shape-feature';

const base: GeoEntity = {
  fid: 7,
  id: 'e7',
  type: 'facility',
  label: 'Invented pipeline segment',
  lon: 1,
  lat: 1,
  area: null,
  route: null,
  sources: [],
  attrs: {},
  parentId: null,
  positionFrom: null,
  symbol: null,
};

const ROUTE = [
  [
    [0, 0],
    [1, 1],
  ],
] as const;

describe('the shape feature of an entity', () => {
  it('draws a route as a multi line string of its type', () => {
    expect(shapeFeatureOf({ ...base, route: ROUTE }, true)).toStrictEqual({
      type: 'Feature',
      id: 7,
      geometry: { type: 'MultiLineString', coordinates: ROUTE },
      properties: { entityType: 'facility' },
    });
  });

  it('carries the hue of the stage with the shape', () => {
    expect(shapeFeatureOf({ ...base, route: ROUTE }, true, '#e0c341')?.properties).toStrictEqual({
      entityType: 'facility',
      stageColour: '#e0c341',
    });
  });

  it('draws nothing for a point, or for a type with no hue', () => {
    expect(shapeFeatureOf(base, true)).toBeNull();
    expect(shapeFeatureOf({ ...base, route: ROUTE }, false)).toBeNull();
  });
});
