import { SHARE_IMPUTED_KEY, SHARE_KEY } from '@gab/proposal/share';

import {
  entryIntoForceOf,
  regimesOfSources,
  regimeOfSources,
  type Regime,
} from './alignment-matrix.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseRecord, ReleaseRelation } from './release-record.ts';

/** Listed companies that hold this share of an entity, or more, make its status derived. */
export const DERIVED_FROM_PCT = 50;

/** One designation: the regime, the act and the date. The regime is null when the designation
 * cites no official file of one regime (ADR 0017). The date is null when the record has none. */
export interface Designation {
  readonly entityId: string;
  readonly entityLabel: string;
  readonly regime: Regime | null;
  readonly actId: string;
  readonly actLabel: string;
  readonly date: string | null;
  readonly claimId: string;
}

/** One general licence of a listed entity. */
export interface GeneralLicence {
  readonly entityId: string;
  readonly licenceId: string;
  readonly label: string;
  readonly regime: Regime | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly claimId: string;
}

/** One direct owner that is listed or derived, with its share. */
export interface BlockedHolder {
  readonly entityId: string;
  readonly label: string;
  /** The share in percent. */
  readonly sharePct: number;
  /** True when GEM estimated the share. */
  readonly estimated: boolean;
  readonly holderStatus: 'listed' | 'derived';
  /** The regime in which this owner is listed or derived. Null: no official file. */
  readonly regime: Regime | null;
}

export interface AssetSanctions {
  readonly assetId: string;
  readonly assetLabel: string;
  readonly status: 'listed' | 'derived' | 'none';
  /** For 'listed', the designations of the asset and of its operator. For 'derived', the
   * designations at the top of the owners that hold the asset. */
  readonly designations: readonly Designation[];
  /** The listed and derived owners and their shares, for a 'derived' status. */
  readonly holders: readonly BlockedHolder[];
  /** The regimes in which the status is derived (each one holds {@link DERIVED_FROM_PCT} percent
   * or more by itself). Empty for another status. A null entry is a designation with no official
   * file. */
  readonly derivedRegimes: readonly (Regime | null)[];
  /** The sum of the shares of the owners of the regime that holds most, in percent. */
  readonly heldPct: number;
  readonly licences: readonly GeneralLicence[];
}

type Blocked = ReadonlyMap<string, 'listed' | 'derived'>;

/** The regimes in turn. A designation with no official file, or with two regimes, has the key
 * null, and the 50% rule never adds shares across keys. */
const KEYS: readonly (Regime | null)[] = ['eu', 'ofac', 'uk', null];

// valid_to is the last day, inclusive (the schema checks valid_from <= valid_to).
const isActive = (relation: ReleaseRelation, asOf: string): boolean =>
  (relation.valid_from === null || relation.valid_from <= asOf) &&
  (relation.valid_to === null || relation.valid_to >= asOf);

// A sum of decimal shares can miss the exact total by a float error.
const round = (value: number): number => Math.round(value * 1e6) / 1e6;

const compare = (one: string, two: string): number => (one < two ? -1 : one > two ? 1 : 0);

const distinct = <T extends { readonly claimId: string }>(list: readonly T[]): T[] =>
  [...new Map(list.map((one) => [one.claimId, one])).values()].sort((one, two) =>
    compare(one.claimId, two.claimId),
  );

/**
 * The sanctions status of each asset (an entity of the facility type) on one day. An asset is
 * 'listed' when it or its operator has a designation in force. Else it is 'derived' when owners
 * that are listed, or derived themselves, hold {@link DERIVED_FROM_PCT} percent or more of it.
 * The chain goes up through the "owns" relations until no owner is new, so a cycle ends. An
 * ownership link with no share counts for nothing. The general licences of the listed entities
 * show beside the status. The result is in the order of the asset identifiers.
 */
export const assetSanctions = (record: ReleaseRecord, asOf: string): readonly AssetSanctions[] => {
  const { documentOf, labelOf } = releaseLookup(record);

  const regimeOf = (sources: readonly string[]): Regime | null =>
    regimeOfSources(sources, documentOf);
  const claimsById = new Map(record.claims.map((one) => [one.claim_id, one]));

  // The sources of a relation are the sources of its own claim, then the sources of the row.
  const claimSources = new Map(
    record.claims
      .filter((one) => one.subject_kind === 'relation' && one.attribute === null)
      .map((one) => [one.subject_id, one.sources]),
  );
  const attrsOf = new Map<string, Map<string, unknown>>();
  for (const claim of record.claims) {
    if (claim.subject_kind !== 'relation' || claim.attribute === null) continue;
    const held = attrsOf.get(claim.subject_id) ?? new Map<string, unknown>();
    held.set(claim.attribute, claim.value);
    attrsOf.set(claim.subject_id, held);
  }

  // The start of the designation, else for the EU the entry into force of the act, when it cites a
  // document of the designation (the rule of the alignment matrix).
  const designationDate = (
    relation: ReleaseRelation,
    sources: readonly string[],
  ): string | null => {
    if (relation.valid_from !== null) return relation.valid_from;
    const regimes = regimesOfSources(sources, documentOf);
    if (regimes.length !== 1 || regimes[0] !== 'eu') return null;
    const documentIds = sources.filter((id) => regimeOfSources([id], documentOf) === 'eu');
    return entryIntoForceOf(claimsById, relation, documentIds).listedOn;
  };

  const designationsOf = new Map<string, Designation[]>();
  const licencesOf = new Map<string, GeneralLicence[]>();
  const operatorsOf = new Map<string, string[]>();
  const ownersOf = new Map<string, ReleaseRelation[]>();
  const push = <T>(map: Map<string, T[]>, key: string, value: T): void => {
    map.set(key, [...(map.get(key) ?? []), value]);
  };
  for (const relation of record.relations) {
    const sources = claimSources.get(relation.id) ?? relation.sources;
    // A licence shows with its dates, also when it has ended.
    if (relation.type === 'exempted_by')
      push(licencesOf, relation.src_id, {
        entityId: relation.src_id,
        licenceId: relation.dst_id,
        label: labelOf(relation.dst_id),
        regime: regimeOf(sources),
        validFrom: relation.valid_from,
        validTo: relation.valid_to,
        claimId: relation.id,
      });
    if (!isActive(relation, asOf)) continue;
    if (relation.type === 'designated_by')
      push(designationsOf, relation.src_id, {
        entityId: relation.src_id,
        entityLabel: labelOf(relation.src_id),
        regime: regimeOf(sources),
        actId: relation.dst_id,
        actLabel: labelOf(relation.dst_id),
        date: designationDate(relation, sources),
        claimId: relation.id,
      });
    else if (relation.type === 'operates') push(operatorsOf, relation.dst_id, relation.src_id);
    else if (relation.type === 'owns') push(ownersOf, relation.dst_id, relation);
  }

  const shareOf = (relation: ReleaseRelation): number | null => {
    const value = attrsOf.get(relation.id)?.get(SHARE_KEY);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  // The blocked owners of an entity, one for each owner: when the record holds two links from
  // one owner, the larger share counts once.
  const holdersOf = (
    entityId: string,
    blocked: Blocked,
    regime: Regime | null,
  ): BlockedHolder[] => {
    const byOwner = new Map<string, BlockedHolder>();
    for (const relation of ownersOf.get(entityId) ?? []) {
      const holderStatus = blocked.get(relation.src_id);
      const sharePct = shareOf(relation);
      if (holderStatus === undefined || sharePct === null) continue;
      if ((byOwner.get(relation.src_id)?.sharePct ?? -1) >= sharePct) continue;
      byOwner.set(relation.src_id, {
        entityId: relation.src_id,
        label: labelOf(relation.src_id),
        sharePct,
        estimated: attrsOf.get(relation.id)?.get(SHARE_IMPUTED_KEY) === true,
        holderStatus,
        regime,
      });
    }
    return [...byOwner.values()].sort((one, two) => compare(one.entityId, two.entityId));
  };
  const held = (holders: readonly BlockedHolder[]): number =>
    round(holders.reduce((sum, one) => sum + one.sharePct, 0));

  // For each regime, the blocked entities grow from the entities listed in it until no owner is
  // new. Shares of owners listed under different regimes never add up.
  const blockedBy = new Map<Regime | null, Map<string, 'listed' | 'derived'>>();
  for (const key of KEYS) {
    const blocked = new Map<string, 'listed' | 'derived'>(
      [...designationsOf.entries()]
        .filter(([, list]) => list.some((one) => one.regime === key))
        .map(([id]) => [id, 'listed']),
    );
    for (let grown = true; grown;) {
      grown = false;
      for (const entityId of ownersOf.keys()) {
        if (blocked.has(entityId) || held(holdersOf(entityId, blocked, key)) < DERIVED_FROM_PCT)
          continue;
        blocked.set(entityId, 'derived');
        grown = true;
      }
    }
    blockedBy.set(key, blocked);
  }

  // The designations of one regime at the top of a blocked entity, and the entities on the way. A
  // derived entity gives those of its owners.
  const basisOf = (entityId: string, key: Regime | null, seen: Set<string>): Designation[] => {
    if (seen.has(entityId)) return [];
    seen.add(entityId);
    const own = (designationsOf.get(entityId) ?? []).filter((one) => one.regime === key);
    if (own.length > 0) return own;
    return holdersOf(entityId, blockedBy.get(key) ?? new Map(), key).flatMap((one) =>
      basisOf(one.entityId, key, seen),
    );
  };

  return record.entities
    .filter((one) => one.type === 'facility')
    .map((asset): AssetSanctions => {
      const listedEnds = [asset.id, ...(operatorsOf.get(asset.id) ?? [])].filter((id) =>
        designationsOf.has(id),
      );
      const derivedKeys = KEYS.filter((key) => {
        const blocked = blockedBy.get(key) ?? new Map<string, 'listed' | 'derived'>();
        return held(holdersOf(asset.id, blocked, key)) >= DERIVED_FROM_PCT;
      });
      const status = listedEnds.length > 0 ? 'listed' : derivedKeys.length > 0 ? 'derived' : 'none';
      const holders =
        status === 'derived'
          ? derivedKeys.flatMap((key) => holdersOf(asset.id, blockedBy.get(key) ?? new Map(), key))
          : [];
      // The asset and every owner in the chain can carry a general licence.
      const chain = new Set<string>([asset.id]);
      let designations: Designation[] = [];
      if (status === 'listed') {
        designations = listedEnds.flatMap((id) => designationsOf.get(id) ?? []);
        for (const id of listedEnds) chain.add(id);
      } else if (status === 'derived') {
        for (const key of derivedKeys) {
          const seen = new Set<string>();
          for (const one of holdersOf(asset.id, blockedBy.get(key) ?? new Map(), key))
            designations.push(...basisOf(one.entityId, key, seen));
          for (const id of seen) chain.add(id);
        }
      }
      return {
        assetId: asset.id,
        assetLabel: asset.label,
        status,
        designations: distinct(designations),
        holders,
        derivedRegimes: status === 'derived' ? derivedKeys : [],
        heldPct:
          status === 'derived'
            ? Math.max(
                ...derivedKeys.map((key) =>
                  held(holdersOf(asset.id, blockedBy.get(key) ?? new Map(), key)),
                ),
              )
            : 0,
        licences: distinct([...chain].flatMap((id) => licencesOf.get(id) ?? [])),
      };
    })
    .sort((one, two) => compare(one.assetId, two.assetId));
};

const regimeWords = (regime: Regime | null): string =>
  regime === null ? 'no official file' : regime.toUpperCase();

/** The status of an asset as lines of text for the operator. */
export const statusLines = (one: AssetSanctions): readonly string[] => {
  const lines = [`${one.assetLabel}\t${one.status}`];
  for (const holder of one.holders)
    lines.push(
      `  holder ${holder.label}\t${holder.holderStatus} ${regimeWords(holder.regime)}\t${String(holder.sharePct)}%` +
        (holder.estimated ? ' (estimated by GEM)' : ''),
    );
  for (const designation of one.designations)
    lines.push(
      `  ${regimeWords(designation.regime)}\t${designation.actLabel}\t` +
        `${designation.date ?? 'no date'}\t${designation.entityLabel}`,
    );
  for (const licence of one.licences)
    lines.push(
      `  general licence ${licence.label}\t${regimeWords(licence.regime)}\t` +
        `${licence.validFrom ?? 'no start'} to ${licence.validTo ?? 'no end'}`,
    );
  return lines;
};
