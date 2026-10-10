import type { ReleaseFile } from './csv-export.ts';
import { entityColumns } from './entity-columns.ts';
import type { ReleaseHeading } from './release-heading.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseRecord } from './release-record.ts';

/** The GeoJSON file of a release (RFC 7946): one feature for each entity with a position, with
 * the columns of the entity CSV as its properties. The collection carries the name of the release
 * and the disclaimer as foreign members. The database keeps each position in WGS84, and its
 * GeoJSON gives the longitude before the latitude, as RFC 7946 asks. */
export const geojsonExport = (record: ReleaseRecord, heading: ReleaseHeading): ReleaseFile => {
  const lookup = releaseLookup(record);
  const features = record.entities.flatMap((one) =>
    one.geom === null
      ? []
      : [
          {
            type: 'Feature',
            id: one.id,
            geometry: one.geom,
            properties: entityColumns(one, lookup),
          },
        ],
  );
  const collection = {
    type: 'FeatureCollection',
    name: heading.title,
    disclaimer: heading.disclaimer,
    features,
  };
  return { path: 'entities.geojson', text: `${JSON.stringify(collection)}\n` };
};
