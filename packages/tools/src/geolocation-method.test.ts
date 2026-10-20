import { expect, test } from 'vitest';

import { geolocationMethodOf, methodOfSource } from './geolocation-method.ts';

const source = (uri: string | null, title: string, provider: string | null = null) => ({
  uri,
  title,
  provider,
});

test.each([
  [source('https://www.openstreetmap.org/way/61412496', 'Way 61412496'), 'osm_object'],
  [source('https://nominatim.openstreetmap.org/lookup?osm_ids=W61412496', 'Lookup'), 'osm_object'],
  [source(null, 'An object', 'osm'), 'osm_object'],
  [source('https://example.org/s2.tif', 'A scene', 'copernicus_sentinel'), 'satellite_match'],
  [source(null, 'Yandex Maps satellite coord card'), 'satellite_match'],
  [source('https://globalenergymonitor.org/projects/x', 'Tracker'), 'source_coordinates'],
  [source(null, 'Global Energy Monitor oil and gas plant tracker'), 'source_coordinates'],
  [source('https://unece.org/trade/cefact/unlocode', 'UN/LOCODE 2026-1'), 'source_coordinates'],
  [source('https://example.org/news', 'A ship was seized'), null],
  [source(null, 'A note'), null],
])('the method of %j is %s', (given, method) => {
  expect(methodOfSource(given)).toBe(method);
});

test('documents that state the same method give it', () => {
  expect(
    geolocationMethodOf([
      source(null, 'Global Energy Monitor tracker'),
      source(null, 'UN/LOCODE 2026-1'),
    ]),
  ).toBe('source_coordinates');
});

test.each([
  ['no document', []],
  ['a document that no rule knows', [source('https://example.org/a', 'A page')]],
  [
    'one document that is known and one that is not',
    [source(null, 'UN/LOCODE 2026-1'), source('https://example.org/a', 'A page')],
  ],
  ['two documents that disagree', [source(null, 'UN/LOCODE 2026-1'), source(null, 'A way', 'osm')]],
])('%s give not_stated', (_case, sources) => {
  expect(geolocationMethodOf(sources)).toBe('not_stated');
});
