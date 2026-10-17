import type { ReleaseRecord } from './release-record.ts';

const OSM_ADDRESS = /openstreetmap\.org|overpass/iu;

/** Stops the release when the geometry of an entity cites an OpenStreetMap document, and names
 * each such entity. The record keeps the identifier and the version of an OpenStreetMap object,
 * and never its geometry (operator decision of 13 October 2026), because the ODbL licence of the
 * geometry would bind the release. Only the documents of the act that set the geometry count: an
 * OpenStreetMap document can hold up the identifier while GEM, a port order or imagery holds up
 * the point. */
export const assertNoOsmGeometry = (record: ReleaseRecord): void => {
  const found: string[] = [];
  for (const entity of record.entities) {
    if (entity.geom === null) continue;
    for (const id of entity.geom_sources ?? entity.sources) {
      const document = record.documents.get(id);
      if (document === undefined) continue;
      if (
        document.provider === 'osm' ||
        document.licence === 'odbl' ||
        OSM_ADDRESS.test(document.uri ?? '')
      )
        found.push(`${entity.id} (${entity.label}): ${id}`);
    }
  }
  if (found.length > 0)
    throw new Error(
      `a release holds no OpenStreetMap geometry, and the geometry of these entities cites an OpenStreetMap document:\n${found.join('\n')}`,
    );
};
