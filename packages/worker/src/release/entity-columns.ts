import type { ReleaseLookup } from './release-lookup.ts';
import type { ReleaseEntity } from './release-record.ts';

/** The columns of an entity in a release, in their order. The CSV and the GeoJSON give the same
 * columns. */
export const ENTITY_COLUMNS = [
  'id',
  'type',
  'label',
  'origin_label',
  'licence',
  'document_ids',
] as const;

/** The value of each column of an entity. */
export const entityColumns = (
  entity: ReleaseEntity,
  lookup: ReleaseLookup,
): Record<(typeof ENTITY_COLUMNS)[number], string> => ({
  id: entity.id,
  type: entity.type,
  label: entity.label,
  origin_label: entity.origin_label,
  licence: lookup.licenceOf(entity.sources),
  document_ids: entity.sources.join(' '),
});
