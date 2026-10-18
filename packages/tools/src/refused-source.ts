// The addresses that a store tool refuses before any write, because their answer is no source of
// the record (panel verdict on the map sources):
// - a geocoder or OpenStreetMap search answer: Nominatim, Overpass, and the geocoder endpoints.
//   Its coordinates are never stored, because their licence binds the record (ODbL) or forbids
//   storage. A query that is not stored can still check an address.
// - a search result page: it lists pages and states no fact. Store the page that a result names.
// A page of one OpenStreetMap object stays allowed: the record keeps the identifier and the
// version of an object, and the release refuses it as the source of a geometry.
// The whole address is read, so a copy in a web archive of such an answer is refused too.

interface Rule {
  readonly pattern: RegExp;
  readonly reason: string;
}

const GEOCODER =
  'the answer of a geocoder is a check of an address only, and its coordinates are never stored';
const SEARCH =
  'a search result page states no fact: store the page that a result names, not the list';

// External constraint: the hosts and paths of the services, as they answer on 18 October 2026.
const RULES: readonly Rule[] = [
  { pattern: /\/\/[^/]*nominatim[^/]*\//iu, reason: `Nominatim: ${GEOCODER}` },
  { pattern: /\/\/[^/]*overpass[^/]*\/|\/api\/interpreter\b/iu, reason: `Overpass: ${GEOCODER}` },
  {
    pattern: /\/\/(?:www\.)?openstreetmap\.org\/(?:search|geocoder)\b/iu,
    reason: `an OpenStreetMap search: ${GEOCODER}`,
  },
  {
    pattern: /\/\/[^/]*arcgis\.com\/[^?]*geocodeserver\//iu,
    reason: `the ArcGIS geocoder: ${GEOCODER}`,
  },
  { pattern: /\/\/geocode-maps\.yandex\.ru\//iu, reason: `the Yandex geocoder: ${GEOCODER}` },
  {
    pattern: /\/\/[^/]*(?:geocode|geocoder|revgeocode)\.[^/]*here(?:api)?\.com\//iu,
    reason: `the HERE geocoder: ${GEOCODER}`,
  },
  { pattern: /\/\/catalog\.api\.2gis\.(?:com|ru)\//iu, reason: `the 2GIS geocoder: ${GEOCODER}` },
  {
    pattern: /\/\/maps\.googleapis\.com\/maps\/api\/geocode\//iu,
    reason: `the Google geocoder: ${GEOCODER}`,
  },
  { pattern: /\/\/photon\.komoot\.io\//iu, reason: `the Photon geocoder: ${GEOCODER}` },
  { pattern: /\/\/api\.opencagedata\.com\//iu, reason: `the OpenCage geocoder: ${GEOCODER}` },
  {
    pattern: /\/\/(?:www\.)?google\.[a-z.]+\/(?:search|webhp)\b/iu,
    reason: `a Google search: ${SEARCH}`,
  },
  { pattern: /\/\/(?:www\.)?bing\.com\/search\b/iu, reason: `a Bing search: ${SEARCH}` },
  {
    pattern: /\/\/(?:www\.)?yandex\.[a-z.]+\/(?:search|yandsearch)\b/iu,
    reason: `a Yandex search: ${SEARCH}`,
  },
  {
    pattern: /\/\/(?:html\.|lite\.)?duckduckgo\.com\/(?:html\/?|lite\/?)?\?(?:[^#]*&)?q=/iu,
    reason: `a DuckDuckGo search: ${SEARCH}`,
  },
  { pattern: /\/\/search\.yahoo\.com\/search\b/iu, reason: `a Yahoo search: ${SEARCH}` },
  { pattern: /\/\/(?:www\.)?baidu\.com\/s\?/iu, reason: `a Baidu search: ${SEARCH}` },
];

/** The reason that a store tool refuses this address, or null for an address that it may store. */
export const refusedSource = (address: string): string | null => {
  for (const rule of RULES)
    if (rule.pattern.test(address)) return `${rule.reason}, so nothing is stored`;
  return null;
};
