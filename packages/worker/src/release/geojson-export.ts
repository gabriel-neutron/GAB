import { entryIntoForceOf, regimeOfSources, type Regime } from './alignment-matrix.ts';
import { assetKinds } from './asset-claims.ts';
import type { ReleaseFile } from './csv-export.ts';
import { entityColumns } from './entity-columns.ts';
import type { ReleaseHeading } from './release-heading.ts';
import { releaseLookup, type ReleaseLookup } from './release-lookup.ts';
import type { ReleaseRecord } from './release-record.ts';

const SITE_KEY: Record<Regime, 'eu' | 'us' | 'uk'> = { eu: 'eu', ofac: 'us', uk: 'uk' };

interface Listing {
  readonly from: string | null;
  readonly to: string | null;
}

/** The dated listings of each asset (an entity of the facility type), for each regime, by entity
 * identifier. A listing is a `designated_by` relation of the asset, with the dates of the relation.
 * shortcut: a derived status (50% rule), a listing of the operator, a sectoral measure
 * (`restricted_by`) and a listing with no single regime are not exported, add them when the view
 * needs them. */
const listingsOf = (
  record: ReleaseRecord,
  documentOf: ReleaseLookup['documentOf'],
): ReadonlyMap<string, Record<'eu' | 'us' | 'uk', Listing[]>> => {
  const claimSources = new Map(
    record.claims
      .filter((one) => one.subject_kind === 'relation' && one.attribute === null)
      .map((one) => [one.subject_id, one.sources]),
  );
  const claimsById = new Map(record.claims.map((one) => [one.claim_id, one]));
  const found = new Map<string, Record<'eu' | 'us' | 'uk', Listing[]>>();
  for (const one of record.relations) {
    if (one.type !== 'designated_by') continue;
    const sources = claimSources.get(one.id) ?? one.sources;
    const regime = regimeOfSources(sources, documentOf);
    if (regime === null) continue;
    // The EU start falls back to the entry into force of the act, as the alignment matrix does.
    const from =
      one.valid_from ??
      (regime === 'eu'
        ? entryIntoForceOf(
            claimsById,
            one,
            sources.filter((id) => regimeOfSources([id], documentOf) === 'eu'),
          ).listedOn
        : null);
    const held = found.get(one.src_id) ?? { eu: [], us: [], uk: [] };
    held[SITE_KEY[regime]].push({ from, to: one.valid_to });
    found.set(one.src_id, held);
  }
  return found;
};

/** The GeoJSON file of a release (RFC 7946): one feature for each entity with a position, with
 * the columns of the entity CSV as its properties. The collection carries the name of the release
 * and the disclaimer as foreign members. The database keeps each position in WGS84, and its
 * GeoJSON gives the longitude before the latitude, as RFC 7946 asks. */
export const geojsonExport = (record: ReleaseRecord, heading: ReleaseHeading): ReleaseFile => {
  const lookup = releaseLookup(record);
  const kinds = assetKinds(record);
  const listings = listingsOf(record, lookup.documentOf);
  const features = record.entities.flatMap((one) =>
    one.geom === null
      ? []
      : [
          {
            type: 'Feature',
            id: one.id,
            geometry: one.geom,
            properties: {
              ...entityColumns(one, lookup),
              // Null for an entity with no asset kind. Only a facility has a sanctions status.
              asset_kind: kinds.get(one.id) ?? null,
              ...(one.type === 'facility'
                ? { sanctions: listings.get(one.id) ?? { eu: [], us: [], uk: [] } }
                : {}),
            },
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
