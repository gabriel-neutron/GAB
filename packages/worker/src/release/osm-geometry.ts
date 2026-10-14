import type { ReleaseRecord } from './release-record.ts';

const OSM_ADDRESS = /openstreetmap\.org|overpass/iu;

/** Stops the release when an entity with a geometry cites an OpenStreetMap document as a source.
 * The record keeps the identifier and the version of an OpenStreetMap object, and never its
 * geometry (operator decision of 13 October 2026), because the ODbL licence of the geometry would
 * bind the release. A point comes from GEM or from imagery. */
export const assertNoOsmGeometry = (record: ReleaseRecord): void => {
  for (const entity of record.entities) {
    if (entity.geom === null) continue;
    for (const id of entity.sources) {
      const document = record.documents.get(id);
      if (document === undefined) continue;
      if (
        document.provider === 'osm' ||
        document.licence === 'odbl' ||
        OSM_ADDRESS.test(document.uri ?? '')
      )
        throw new Error(
          `the geometry of entity ${entity.id} cites the OpenStreetMap document ${id}, and a release holds no OpenStreetMap geometry`,
        );
    }
  }
};
