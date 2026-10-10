import { releaseLookup } from './release-lookup.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

/** The claims of one group, and how many of them have a full NATO pair. */
export interface CoverageRow {
  /** "all", or "entity" or "relation" with the type of what the claims are about. */
  readonly group: string;
  readonly claims: number;
  readonly paired: number;
}

/** The coverage of the NATO pair over the public claims of a release: the whole set first, then
 * one row for each entity type and each relation type, in the order of their names. A value of an
 * entity counts under the type of the entity. A relation and a value of a relation count under the
 * type of the relation. */
export const natoCoverage = (
  record: ReleaseRecord,
  pairs: ReadonlyMap<string, unknown>,
): readonly CoverageRow[] => {
  const { entityOf, relationOf } = releaseLookup(record);
  const groupOf = (claim: ReleaseClaim): string =>
    claim.subject_kind === 'entity'
      ? `entity ${entityOf(claim.subject_id).type}`
      : `relation ${relationOf(claim.subject_id).type}`;
  const counts = new Map<string, { claims: number; paired: number }>();
  for (const claim of record.claims) {
    const group = groupOf(claim);
    const held = counts.get(group) ?? { claims: 0, paired: 0 };
    counts.set(group, {
      claims: held.claims + 1,
      paired: held.paired + (pairs.has(claim.claim_id) ? 1 : 0),
    });
  }
  const groups = [...counts]
    .sort(([one], [two]) => one.localeCompare(two))
    .map(([group, count]) => ({ group, ...count }));
  return [
    {
      group: 'all',
      claims: record.claims.length,
      paired: record.claims.filter((one) => pairs.has(one.claim_id)).length,
    },
    ...groups,
  ];
};

const share = (row: CoverageRow): string =>
  row.claims === 0 ? '0.0%' : `${((100 * row.paired) / row.claims).toFixed(1)}%`;

/** One line of the report: the group, the claims with a full pair, all the claims, the share. */
export const coverageLine = (row: CoverageRow): string =>
  `${row.group}\t${String(row.paired)}\t${String(row.claims)}\t${share(row)}`;

/** The heading of the columns of the report. */
export const COVERAGE_HEADER = 'group\twith a full pair\tpublic claims\tshare';
