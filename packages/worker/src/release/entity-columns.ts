import { NOT_STATED } from '@gab/proposal/geolocation-method';

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
  'geolocation_method',
] as const;

/** The method that found the place of an entity, one word of the closed list. An entity with no
 * place has none, and a place that no source says how it was found is `not_stated`. */
export const geolocationMethodOf = (entity: ReleaseEntity): string | null =>
  entity.geom === null ? null : (entity.geom_method ?? NOT_STATED);

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
  geolocation_method: geolocationMethodOf(entity) ?? '',
});
