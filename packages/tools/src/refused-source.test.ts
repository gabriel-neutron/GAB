import { expect, test } from 'vitest';

import { refusedSource } from './refused-source.ts';

test.each([
  ['https://nominatim.openstreetmap.org/search?q=Kirishi&format=json', 'Nominatim'],
  ['https://nominatim.openstreetmap.org/ui/details.html?osmtype=W&osmid=1', 'Nominatim'],
  ['https://overpass-api.de/api/interpreter?data=way(1);out;', 'Overpass'],
  ['https://overpass.kumi.systems/api/interpreter', 'Overpass'],
  ['https://www.openstreetmap.org/search?query=Kirishi', 'OpenStreetMap search'],
  [
    'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=Kirishi',
    'ArcGIS',
  ],
  ['https://geocode-maps.yandex.ru/1.x/?geocode=Kirishi', 'Yandex geocoder'],
  ['https://geocode.search.hereapi.com/v1/geocode?q=Kirishi', 'HERE'],
  ['https://catalog.api.2gis.com/3.0/items/geocode?q=Kirishi', '2GIS'],
  ['https://maps.googleapis.com/maps/api/geocode/json?address=Kirishi', 'Google geocoder'],
  ['https://www.google.com/search?q=Kirishi+refinery', 'Google search'],
  ['https://www.google.ru/search?q=Kirishi', 'Google search'],
  ['https://www.bing.com/search?q=Kirishi', 'Bing search'],
  ['https://yandex.ru/search/?text=Kirishi', 'Yandex search'],
  ['https://html.duckduckgo.com/html/?q=Kirishi', 'DuckDuckGo search'],
  ['https://duckduckgo.com/?q=Kirishi&ia=web', 'DuckDuckGo search'],
  [
    'https://web.archive.org/web/2024/https://nominatim.openstreetmap.org/search?q=Kirishi',
    'Nominatim',
  ],
])('%s is refused', (address, name) => {
  const reason = refusedSource(address);
  expect(reason).toContain(name);
  expect(reason).toMatch(/nothing is stored$/u);
});

test.each([
  'https://www.openstreetmap.org/way/123456',
  'https://www.openstreetmap.org/node/42',
  'https://www.openstreetmap.org/relation/7#map=12/59.4/32.0',
  'https://www.kinef.ru/about/',
  'https://www.google.com/maps/place/Kirishi',
  'https://duckduckgo.com/about',
  'https://yandex.ru/maps/org/kinef/1/',
  'https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/',
])('%s is allowed', (address) => {
  expect(refusedSource(address)).toBeNull();
});
