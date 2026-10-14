import { assetKinds, attributeOfEntities } from './asset-claims.ts';
import type { ReleaseFile } from './csv-export.ts';
import { csvFile } from './csv-file.ts';
import { osmLink } from './osm-link.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseEntity, ReleaseRecord } from './release-record.ts';

const HEADER = [
  'id',
  'label',
  'asset_kind',
  'osm_id',
  'osm_version',
  'osm_link',
  'point',
  'licence',
  'document_ids',
];

/** The point of an entity as `longitude latitude` in WGS84, or an empty text when its geometry is
 * not a point. */
const pointText = (entity: ReleaseEntity): string => {
  const geometry = entity.geom;
  if (geometry?.['type'] !== 'Point') return '';
  const coordinates = geometry['coordinates'];
  if (!Array.isArray(coordinates) || coordinates.length < 2) return '';
  return `${String(coordinates[0])} ${String(coordinates[1])}`;
};

const text = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** The link file of a release: one row for each entity that has an OpenStreetMap identifier. The
 * row gives the identifier, the version of the object and the link to the object, and it gives the
 * own sourced point of the entity. The release never copies an OpenStreetMap geometry (ADR 0020),
 * so the reader opens the object on OpenStreetMap to see its outline. */
export const assetLinks = (record: ReleaseRecord, preamble: string): ReleaseFile => {
  const lookup = releaseLookup(record);
  const osmIds = attributeOfEntities(record, 'osm_id');
  const versions = attributeOfEntities(record, 'osm_version');
  const kinds = assetKinds(record);
  const rows = record.entities
    .filter((one) => osmIds.has(one.id))
    .map((one) => [
      one.id,
      one.label,
      kinds.get(one.id) ?? '',
      text(osmIds.get(one.id)),
      text(versions.get(one.id)),
      osmLink(osmIds.get(one.id)) ?? '',
      pointText(one),
      lookup.licenceOf(one.sources),
      one.sources.join(' '),
    ]);
  return { path: 'asset-links.csv', text: csvFile(preamble, HEADER, rows) };
};
