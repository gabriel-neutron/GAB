import { NOT_STATED } from '@gab/proposal/geolocation-method';
import type { GeolocationCoverage } from '@gab/release/coverage';

import { geolocationMethodOf } from './entity-columns.ts';
import type { ReleaseRecord } from './release-record.ts';

/** The share of the public places with no stated method of geolocation: the count of places, the
 * count of them with `not_stated`, and the count of each method (the largest first, then by
 * name). A place is the geometry of a public entity. */
export const geolocationCoverageOf = (record: ReleaseRecord): GeolocationCoverage => {
  const counts = new Map<string, number>();
  for (const entity of record.entities) {
    const method = geolocationMethodOf(entity);
    if (method !== null) counts.set(method, (counts.get(method) ?? 0) + 1);
  }
  return {
    places: [...counts.values()].reduce((sum, count) => sum + count, 0),
    notStated: counts.get(NOT_STATED) ?? 0,
    byMethod: [...counts]
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method)),
  };
};
