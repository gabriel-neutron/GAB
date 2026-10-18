import { entryIntoForceOf, regimeOfSources, type Regime } from './alignment-matrix.ts';
import { assetKinds } from './asset-claims.ts';
import type { ReleaseFile } from './csv-export.ts';
import { entityColumns } from './entity-columns.ts';
import type { ReleaseHeading } from './release-heading.ts';
import { releaseLookup, type ReleaseLookup } from './release-lookup.ts';
import type { ReleaseRecord } from './release-record.ts';

const SITE_KEY: Record<Regime, 'eu' | 'us' | 'uk'> = { eu: 'eu', ofac: 'us', uk: 'uk' };

const MEASURES = ['designated_by', 'restricted_by'] as const;

interface Listing {
  readonly measure: (typeof MEASURES)[number];
  readonly from: string | null;
  readonly to: string | null;
  /** The far end of the relation: the act or the authority that gives the measure. */
  readonly act_id: string;
  readonly act_label: string;
  /** The title of the official file of the regime that the measure cites. */
  readonly act_document: string | null;
  readonly origin_label: string;
  /** Null when the act names the asset. Else the operator or the owner of the asset that the act
   * names, one step away (a direct `operates` or `owns` relation), with the label of that link. */
  readonly via: {
    readonly role: 'operator' | 'owner';
    readonly entity_id: string;
    readonly entity_label: string;
    readonly link_origin_label: string;
  } | null;
}

/** The entity types that have a sanctions status on the map. */
const ASSET_TYPES: ReadonlySet<string> = new Set(['facility', 'port']);
const ROLE_OF_LINK = { operates: 'operator', owns: 'owner' } as const;

/** The dated measures of each asset (an entity of the facility or port type), for each regime, by
 * entity identifier. A measure is a `designated_by` (listing) or a `restricted_by` (sectoral
 * measure) relation, with the dates of the relation, its act and its label. A measure names the
 * asset, or names its direct operator or owner (one step only, never the 50% rule).
 * shortcut: a measure with no single regime is not exported, add it when the view needs it. */
const listingsOf = (
  record: ReleaseRecord,
  { documentOf, labelOf }: Pick<ReleaseLookup, 'documentOf' | 'labelOf'>,
): ReadonlyMap<string, Record<'eu' | 'us' | 'uk', Listing[]>> => {
  const relationClaims = new Map(
    record.claims
      .filter((one) => one.subject_kind === 'relation' && one.attribute === null)
      .map((one) => [one.subject_id, one]),
  );
  const claimsById = new Map(record.claims.map((one) => [one.claim_id, one]));
  const found = new Map<string, Record<'eu' | 'us' | 'uk', Listing[]>>();
  for (const one of record.relations) {
    const measure = MEASURES.find((each) => each === one.type);
    if (measure === undefined) continue;
    const claim = relationClaims.get(one.id);
    const sources = claim?.sources ?? one.sources;
    const regime = regimeOfSources(sources, documentOf);
    if (regime === null) continue;
    const regimeSources = sources.filter((id) => regimeOfSources([id], documentOf) === regime);
    // A measure with no start falls back to the entry into force of its act, when that value
    // cites a file of the same regime. The record holds no other date of a document. With no such
    // value the measure has no date, and the card says so.
    const from = one.valid_from ?? entryIntoForceOf(claimsById, one, regimeSources).listedOn;
    const [document] = regimeSources;
    const held = found.get(one.src_id) ?? { eu: [], us: [], uk: [] };
    held[SITE_KEY[regime]].push({
      measure,
      from,
      to: one.valid_to,
      act_id: one.dst_id,
      act_label: labelOf(one.dst_id),
      act_document: document === undefined ? null : documentOf(document).title,
      origin_label: claim?.origin_label ?? one.origin_label,
      via: null,
    });
    found.set(one.src_id, held);
  }
  const assets = new Set(
    record.entities.filter((one) => ASSET_TYPES.has(one.type)).map((one) => one.id),
  );
  const byAsset = new Map<string, Record<'eu' | 'us' | 'uk', Listing[]>>();
  for (const id of assets) {
    const own = found.get(id);
    byAsset.set(id, {
      eu: [...(own?.eu ?? [])],
      us: [...(own?.us ?? [])],
      uk: [...(own?.uk ?? [])],
    });
  }
  for (const link of record.relations) {
    if (link.type !== 'operates' && link.type !== 'owns') continue;
    const held = byAsset.get(link.dst_id);
    const theirs = found.get(link.src_id);
    if (held === undefined || theirs === undefined) continue;
    const via = {
      role: ROLE_OF_LINK[link.type],
      entity_id: link.src_id,
      entity_label: labelOf(link.src_id),
      link_origin_label: relationClaims.get(link.id)?.origin_label ?? link.origin_label,
    };
    for (const key of ['eu', 'us', 'uk'] as const)
      held[key].push(...theirs[key].map((one) => ({ ...one, via })));
  }
  return byAsset;
};

/** The GeoJSON file of a release (RFC 7946): one feature for each entity with a position, with
 * the columns of the entity CSV as its properties. The collection carries the name of the release
 * and the disclaimer as foreign members. The database keeps each position in WGS84, and its
 * GeoJSON gives the longitude before the latitude, as RFC 7946 asks. */
export const geojsonExport = (record: ReleaseRecord, heading: ReleaseHeading): ReleaseFile => {
  const lookup = releaseLookup(record);
  const kinds = assetKinds(record);
  const listings = listingsOf(record, lookup);
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
              // Null for an entity with no asset kind. Only a facility or a port has a sanctions status.
              asset_kind: kinds.get(one.id) ?? null,
              ...(ASSET_TYPES.has(one.type)
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
