import { expect, test } from 'vitest';

import { entityHref, surfaceHref } from './address';

const AWKWARD_ID = 'a&b#c d';

test('the entity address encodes the identity and the source document', () => {
  expect(entityHref(AWKWARD_ID, 'x?y')).toBe('/entity/a%26b%23c%20d?src=x%3Fy');
});

test('the entity address with no source document carries no parameter', () => {
  expect(entityHref(AWKWARD_ID, null)).toBe('/entity/a%26b%23c%20d');
});

test('the surface address encodes the identity for the map and for the graph', () => {
  expect(surfaceHref('map', AWKWARD_ID)).toBe('/map?entity=a%26b%23c%20d');
  expect(surfaceHref('graph', AWKWARD_ID)).toBe('/graph?entity=a%26b%23c%20d');
});
