import type { NatoCoverage, NatoShare } from '@gab/release/coverage';

import type { Queryable } from '../queryable.ts';
import { releaseLookup } from './release-lookup.ts';
import { readReleaseRecord, type ReleaseClaim, type ReleaseRecord } from './release-record.ts';

const line = (group: string, count: NatoShare): string => {
  const share = count.claims === 0 ? 0 : (100 * count.paired) / count.claims;
  return `${group}\t${String(count.paired)}\t${String(count.claims)}\t${share.toFixed(1)}%`;
};

/** The coverage of the NATO pair for the claims of a release: the whole set, then each entity type
 * and each relation type, in the order of their names. A value of an entity counts under the type
 * of the entity. A relation and a value of a relation count under the type of the relation. */
export const natoCoverageOf = (
  record: ReleaseRecord,
  pairs: ReadonlyMap<string, unknown>,
): NatoCoverage => {
  const { entityOf, relationOf } = releaseLookup(record);
  const groupOf = (claim: ReleaseClaim): string =>
    claim.subject_kind === 'entity'
      ? `entity ${entityOf(claim.subject_id).type}`
      : `relation ${relationOf(claim.subject_id).type}`;
  const counts = new Map<string, NatoShare>();
  for (const claim of record.claims) {
    const group = groupOf(claim);
    const held = counts.get(group) ?? { claims: 0, paired: 0 };
    counts.set(group, {
      claims: held.claims + 1,
      paired: held.paired + (pairs.has(claim.claim_id) ? 1 : 0),
    });
  }
  return {
    all: {
      claims: record.claims.length,
      paired: record.claims.filter((one) => pairs.has(one.claim_id)).length,
    },
    byType: [...counts]
      .sort(([one], [two]) => one.localeCompare(two))
      .map(([group, count]) => ({ group, ...count })),
  };
};

/** The report on the NATO pair as lines of tab-separated columns: a heading, the whole set of the
 * claims of a release, then one line for each entity type and each relation type. */
export const natoCoverageLines = (
  record: ReleaseRecord,
  pairs: ReadonlyMap<string, unknown>,
): readonly string[] => {
  const { all, byType } = natoCoverageOf(record, pairs);
  return [
    'group\twith a full pair\tpublic claims\tshare',
    line('all', all),
    ...byType.map(({ group, ...count }) => line(group, count)),
  ];
};

/** The report on the NATO pair of the public claims, as the release reads them. The caller gives
 * one snapshot for the reads. */
export const natoCoverageReport = async (db: Queryable): Promise<readonly string[]> => {
  const record = await readReleaseRecord(db, { natoPair: true });
  return natoCoverageLines(record, record.natoPairs ?? new Map());
};
