import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

/** The value of one attribute of each entity that has it, by entity identifier. A relation claim
 * is not read. */
export const attributeOfEntities = (
  record: ReleaseRecord,
  attribute: string,
): ReadonlyMap<string, unknown> =>
  new Map(
    record.claims
      .filter((one: ReleaseClaim) => one.subject_kind === 'entity' && one.attribute === attribute)
      .map((one) => [one.subject_id, one.value]),
  );

/** The kind of each asset, by entity identifier. An asset is an entity with the `asset_kind`
 * attribute. */
export const assetKinds = (record: ReleaseRecord): ReadonlyMap<string, string> =>
  new Map(
    [...attributeOfEntities(record, 'asset_kind')].flatMap(([id, value]) =>
      typeof value === 'string' ? [[id, value] as const] : [],
    ),
  );
