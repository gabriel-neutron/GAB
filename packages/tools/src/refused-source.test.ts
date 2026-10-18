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
  ['https://nominatim.openstreetmap.org?q=Kirishi', 'Nominatim'],
  ['https://api.opencagedata.com/geocode/v1/json?q=Kirishi', 'geocoder'],
  ['https://api.geoapify.com/v1/geocode/search?text=Kirishi', 'geocoder'],
  ['https://eu1.locationiq.com/v1/search?q=Kirishi', 'LocationIQ'],
  ['https://geocode.maps.co/search?q=Kirishi', 'geocoder'],
  ['https://api.mapbox.com/geocoding/v5/mapbox.places/Kirishi.json', 'Mapbox'],
  ['https://dev.virtualearth.net/REST/v1/Locations?q=Kirishi', 'Bing Maps'],
  ['https://api.tomtom.com/search/2/geocode/Kirishi.json', 'TomTom'],
  ['https://autosuggest.search.hereapi.com/v1/autosuggest?q=Kirishi', 'HERE'],
  ['https://www.google.com/maps/place/Kirishi/@59.44,32.02,14z', 'Google Maps'],
  ['https://www.google.com/maps/search/Kirishi+refinery', 'Google Maps'],
  ['https://yandex.ru/maps/?text=Kirishi&ll=32.02,59.44', 'Yandex Maps'],
  ['https://2gis.ru/kirishi/search/kinef', '2GIS search'],
  ['https://news.google.com/search?q=Kirishi', 'Google search'],
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
  'https://nominatim.org/release-docs/latest/',
  'https://wiki.openstreetmap.org/wiki/Overpass_API',
  'https://www.openstreetmap.org/way/123456/history',
  'https://api.example-register.org/v1/search?q=Kirishi',
  'https://duckduckgo.com/about',
  'https://yandex.ru/maps/org/kinef/1/',
  'https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/',
])('%s is allowed', (address) => {
  expect(refusedSource(address)).toBeNull();
});
