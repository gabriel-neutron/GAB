import { regimeOfSources } from './alignment-matrix.ts';
import type { ReleaseRecord } from './release-record.ts';

/** The act that a `designated_by` relation names, split for the count of the blind spot. */
type Act = 'us_eo_14024' | 'us_ofac_action' | 'eu' | 'uk' | 'other';

/** The same count in SQL, for a reader who checks it on the record. The code below gives the
 * counts of the manifest; this text states the rule. */
const QUERY =
  "release_relations() where type = 'designated_by' and valid_from is null, split by the label of the end entity (release_entities()): 'Executive Order 14024' is us_eo_14024; a label that starts with 'OFAC action of ' is us_ofac_action; else the regime of the official file that the relation cites (eu_eurlex is eu, uk_sanctions_list is uk); else other";

/** The cause and the effect of the blind spot, as the manifest states them. */
export interface UndatedDesignations {
  readonly query: string;
  readonly total: number;
  readonly byAct: Readonly<Record<Act, number>>;
  readonly cause: string;
  readonly effect: string;
  readonly baselineMetrics: string;
}

const CAUSE =
  'Note on the source: the OFAC SDN.CSV file holds no designation date. A US designation has a start date only when a page of the OFAC Recent Actions gives it.';
const EFFECT =
  'Note on use: a test of dated facts that reads the start date of a designation cannot count an undated designation. The counts above show how many are left out.';
const METRICS =
  'No baseline metric reads the start date of a designation. The US dates are a declared blind spot of this release; the next release compares these counts.';

/** Counts the `designated_by` relations that have no start date, by act. The count comes from the
 * record of the release, never from a hand count. */
export const undatedDesignations = (
  record: Pick<ReleaseRecord, 'entities' | 'relations' | 'documents'>,
): UndatedDesignations => {
  const labels = new Map(record.entities.map((one) => [one.id, one.label]));
  const byAct: Record<Act, number> = {
    us_eo_14024: 0,
    us_ofac_action: 0,
    eu: 0,
    uk: 0,
    other: 0,
  };
  let total = 0;
  for (const one of record.relations) {
    if (one.type !== 'designated_by' || one.valid_from !== null) continue;
    const label = labels.get(one.dst_id) ?? '';
    const regime = regimeOfSources(
      one.sources,
      (id) => record.documents.get(id) ?? { provider: null },
    );
    const act: Act =
      label === 'Executive Order 14024'
        ? 'us_eo_14024'
        : label.startsWith('OFAC action of ')
          ? 'us_ofac_action'
          : regime === 'eu' || regime === 'uk'
            ? regime
            : 'other';
    byAct[act] += 1;
    total += 1;
  }
  return { query: QUERY, total, byAct, cause: CAUSE, effect: EFFECT, baselineMetrics: METRICS };
};
