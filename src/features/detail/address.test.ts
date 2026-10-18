import { expect, test } from 'vitest';

import { claimHref, entityHref, relationHref, surfaceHref, vesselHref } from './address';

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

test('the surface address of a relation names the relation key', () => {
  expect(surfaceHref('graph', AWKWARD_ID, 'relation')).toBe('/graph?relation=a%26b%23c%20d');
});

test('the vessel address is the IMO number under the vessel path', () => {
  expect(vesselHref('9000001')).toBe('/vessel/9000001');
  expect(vesselHref('a b')).toBe('/vessel/a%20b');
});

test('the claim address keeps the folders of the identifier and encodes each one', () => {
  expect(claimHref('0a1f/valid_to')).toBe('/claim/0a1f/valid_to');
  expect(claimHref('a b/c#d')).toBe('/claim/a%20b/c%23d');
  expect(relationHref('0a1f')).toBe('/relation/0a1f');
});
