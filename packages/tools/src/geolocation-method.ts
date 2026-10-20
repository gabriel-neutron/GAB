import { NOT_STATED, type GeolocationMethod } from '@gab/proposal/geolocation-method';

import { hostOf } from './document-type.ts';

// The method of geolocation of a place that the record holds already. A command reads the documents
// that gave the place, and it names a method only when each one of them states it clearly: an
// OpenStreetMap object, a satellite image, or a dataset that writes the coordinates itself. A
// document that no rule knows, or two documents that disagree, give `not_stated`: the record
// does not guess how a place was found.

export interface PlaceSource {
  readonly uri: string | null;
  readonly title: string;
  readonly provider: string | null;
}

const IMAGERY_PROVIDERS = new Set(['copernicus_sentinel', 'eox_s2cloudless_2016']);

// External constraint: the hosts and the titles of the datasets, as they stand on 20 October 2026.
const COORDINATE_HOST = /(?:^|\.)(?:globalenergymonitor\.org|unece\.org)$/u;
const COORDINATE_TITLE = /^(?:global energy monitor\b|un\/locode\b)/iu;
const YANDEX_CARD = /\byandex\b[^\n]*\b(?:satellite|coord)/iu;

/** The method that one document states, or null when no rule knows the document. */
export const methodOfSource = (source: PlaceSource): GeolocationMethod | null => {
  const words = `${source.title} ${source.uri ?? ''}`;
  const host = hostOf(source.uri);
  if (
    source.provider === 'osm' ||
    host === 'openstreetmap.org' ||
    host?.endsWith('.openstreetmap.org') === true ||
    /overpass/iu.test(host ?? '')
  )
    return 'osm_object';
  if (source.provider !== null && IMAGERY_PROVIDERS.has(source.provider)) return 'satellite_match';
  if (YANDEX_CARD.test(words)) return 'satellite_match';
  if ((host !== null && COORDINATE_HOST.test(host)) || COORDINATE_TITLE.test(source.title))
    return 'source_coordinates';
  return null;
};

/** The method of a place from the documents that gave it. Each document must state the same
 * method. A place with no document, one document that no rule knows, or two documents that
 * disagree is `not_stated`. */
export const geolocationMethodOf = (sources: readonly PlaceSource[]): GeolocationMethod => {
  const methods = new Set(sources.map(methodOfSource));
  const [only] = methods;
  return methods.size === 1 && only !== null && only !== undefined ? only : NOT_STATED;
};
