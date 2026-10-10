import { isValidImo } from '@gab/proposal/identifiers';

import type { ReleaseFile } from './csv-export.ts';
import { csvFile } from './csv-file.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import type { ReleaseClaim, ReleaseRecord, ReleaseRelation } from './release-record.ts';

type Regime = 'eu' | 'ofac' | 'uk';
const REGIMES: readonly Regime[] = ['eu', 'ofac', 'uk'];

type DateRule = ReleaseManifest['dateRules'][Regime];

// Only the official tools give these providers to the files that they store, so the provider of a
// cited document tells the regime of a designation. A label of an authority is free text. The EU
// financial sanctions file has no tool yet, so it gives no regime.
const REGIME_OF_PROVIDER: ReadonlyMap<string, Regime> = new Map([
  ['eu_eurlex', 'eu'],
  ['ofac_sdn', 'ofac'],
  ['uk_sanctions_list', 'uk'],
]);

const RULE_WORDS: Readonly<Record<DateRule, string>> = {
  entry_into_force: 'the date of entry into force',
  recent_actions_notice: 'the date of the Recent Actions notice',
  date_designated: 'the date designated',
};

/** The date of a listing and the claim that gives it, or no date. */
type Dated =
  | {
      readonly dateFrom: 'designation_start' | 'act_entry_into_force';
      readonly listedOn: string;
      readonly dateClaimId: string;
    }
  | { readonly dateFrom: 'none'; readonly listedOn: null; readonly dateClaimId: null };

type Listing = Dated & {
  readonly endedOn: string | null;
  readonly actId: string;
  readonly actLabel: string;
  readonly documentIds: readonly string[];
  readonly claimId: string;
};

const NO_DATE: Dated = { dateFrom: 'none', listedOn: null, dateClaimId: null };

const REGIME_COLUMNS = [
  'listed_on',
  'date_from',
  'date_claim_id',
  'ended_on',
  'act_id',
  'act_label',
  'document_ids',
  'claim_id',
] as const;

const HEADER = [
  'imo',
  'imo_check_digit_ok',
  'vessel_ids',
  'vessel_labels',
  'imo_claim_ids',
  ...REGIMES.flatMap((regime) => REGIME_COLUMNS.map((column) => `${regime}_${column}`)),
  'days_eu_after_ofac',
  'days_eu_after_uk',
  'days_uk_after_ofac',
  'ofac_or_uk_not_eu',
  'eu_not_ofac',
];

const DAY = /^\d{4}-\d{2}-\d{2}$/u;
const isDay = (text: unknown): text is string =>
  typeof text === 'string' && DAY.test(text) && !Number.isNaN(Date.parse(text));

// An IMO number is seven digits. A writer can give it as a number, or with the prefix "IMO".
const imoOf = (value: unknown): string | null => {
  const text =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const digits = text.replace(/^IMO\s*/iu, '');
  return /^\d{7}$/u.test(digits) ? digits : null;
};

const daysBetween = (later: string | null, earlier: string | null): string =>
  later === null || earlier === null
    ? ''
    : String(Math.round((Date.parse(later) - Date.parse(earlier)) / 86_400_000));

// The first listing with a date comes first. A tie goes to the lower claim identifier, so two
// releases of one record give one row.
const firstListing = (one: Listing, two: Listing): number => {
  if (one.listedOn !== two.listedOn) {
    if (one.listedOn === null) return 1;
    if (two.listedOn === null) return -1;
    return one.listedOn < two.listedOn ? -1 : 1;
  }
  return one.claimId < two.claimId ? -1 : one.claimId > two.claimId ? 1 : 0;
};

interface Counts {
  readonly noOfficialFile: number;
  readonly twoRegimes: number;
}

/** The text that the matrix adds to the preamble: what a row is, the date rule of each regime,
 * and the designations that count in no regime. */
const matrixNote = (rules: ReleaseManifest['dateRules'], counts: Counts): string =>
  [
    'Alignment matrix of the EU, OFAC and UK sanctions lists.',
    'One row for each IMO number of a public vessel that a public designation of at least one regime lists. The join is on the IMO number only, never on a name. imo_check_digit_ok tells if the check digit of the number is right.',
    'A designation belongs to a regime by the provider of its official file: EU EUR-Lex for the EU, the OFAC SDN list for OFAC, the UK Sanctions List for the UK.',
    `Date rules of this release. EU: ${RULE_WORDS[rules.eu]}. OFAC: ${RULE_WORDS[rules.ofac]}. UK: ${RULE_WORDS[rules.uk]}.`,
    'The date of a listing is the start date of its designation, as the writer proposed it from the source (date_from designation_start). The release does not check the date against the rule.',
    'Under the EU rule, a designation with no start date takes the entry into force of the act that designates, when that value cites a document of the designation (date_from act_entry_into_force). Else the listing has no date (date_from none), and its gaps are empty.',
    'When a regime lists one IMO number more than once, the row gives the first listing with a date. ended_on is the end date of that listing. The marks count each listing, ended or not.',
    'days_eu_after_ofac is the EU date minus the OFAC date, in days. days_eu_after_uk and days_uk_after_ofac read the same way.',
    `Designations of a vessel with an IMO number that cite no official file of a regime, and count in no regime: ${String(counts.noOfficialFile)}.`,
    `Designations that cite the official files of more than one regime, and count in no regime: ${String(counts.twoRegimes)}.`,
  ].join('\n');

/** The alignment matrix of a release: one row for each IMO number that the EU, OFAC or the UK
 * lists, with the listing date, the act and the claim of each regime, the gaps in days and a mark
 * for each direction. Each identifier of a claim in a row is a claim of the release. */
export const alignmentMatrix = (
  record: ReleaseRecord,
  rules: ReleaseManifest['dateRules'],
  preamble: string,
): ReleaseFile => {
  const { documentOf, entityOf, labelOf, relationOf } = releaseLookup(record);
  const claims = new Map(record.claims.map((one) => [one.claim_id, one]));

  const vesselsOf = new Map<string, ReleaseClaim[]>();
  const imoOfVessel = new Map<string, string>();
  for (const claim of record.claims) {
    if (claim.subject_kind !== 'entity' || claim.attribute !== 'imo') continue;
    if (entityOf(claim.subject_id).type !== 'vessel') continue;
    const imo = imoOf(claim.value);
    if (imo === null) continue;
    imoOfVessel.set(claim.subject_id, imo);
    vesselsOf.set(imo, [...(vesselsOf.get(imo) ?? []), claim]);
  }

  // The entry into force of the act counts only when its value cites a document of the
  // designation. An act that a later act amends states its own entry into force, and not the day
  // when the later act added the vessel.
  const entryIntoForce = (relation: ReleaseRelation, documentIds: readonly string[]): Dated => {
    const claim = claims.get(`${relation.dst_id}/entry_into_force`);
    if (claim === undefined || !isDay(claim.value)) return NO_DATE;
    if (!claim.sources.some((one) => documentIds.includes(one))) return NO_DATE;
    return { dateFrom: 'act_entry_into_force', listedOn: claim.value, dateClaimId: claim.claim_id };
  };

  // The rule of the manifest selects where the date comes from. The record holds one start date
  // for a designation, and the writer reads it from the source by the rule.
  const datedBy = (
    rule: DateRule,
    claim: ReleaseClaim,
    relation: ReleaseRelation,
    documentIds: readonly string[],
  ): Dated => {
    if (relation.valid_from !== null)
      return {
        dateFrom: 'designation_start',
        listedOn: relation.valid_from,
        dateClaimId: claim.claim_id,
      };
    switch (rule) {
      case 'entry_into_force':
        return entryIntoForce(relation, documentIds);
      case 'recent_actions_notice':
      case 'date_designated':
        return NO_DATE;
    }
  };

  let noOfficialFile = 0;
  let twoRegimes = 0;
  const listings = new Map<string, Map<Regime, Listing[]>>();
  for (const claim of record.claims) {
    if (claim.subject_kind !== 'relation' || claim.attribute !== null) continue;
    const relation = relationOf(claim.subject_id);
    if (relation.type !== 'designated_by') continue;
    const imo = imoOfVessel.get(relation.src_id);
    if (imo === undefined) continue;
    const regimes = new Set(
      claim.sources.flatMap((id) => {
        const regime = REGIME_OF_PROVIDER.get(documentOf(id).provider ?? '');
        return regime === undefined ? [] : [regime];
      }),
    );
    const [regime, ...others] = [...regimes];
    if (regime === undefined) {
      noOfficialFile += 1;
      continue;
    }
    if (others.length > 0) {
      twoRegimes += 1;
      continue;
    }
    const documentIds = claim.sources.filter(
      (id) => REGIME_OF_PROVIDER.get(documentOf(id).provider ?? '') === regime,
    );
    const byRegime = listings.get(imo) ?? new Map<Regime, Listing[]>();
    byRegime.set(regime, [
      ...(byRegime.get(regime) ?? []),
      {
        ...datedBy(rules[regime], claim, relation, documentIds),
        endedOn: relation.valid_to,
        actId: relation.dst_id,
        actLabel: labelOf(relation.dst_id),
        documentIds,
        claimId: claim.claim_id,
      },
    ]);
    listings.set(imo, byRegime);
  }

  const rows = [...listings.keys()].sort().map((imo) => {
    const byRegime = listings.get(imo) ?? new Map<Regime, Listing[]>();
    const chosen = (regime: Regime): Listing | undefined =>
      [...(byRegime.get(regime) ?? [])].sort(firstListing)[0];
    const [eu, ofac, uk] = REGIMES.map(chosen);
    const vessels = [...(vesselsOf.get(imo) ?? [])].sort((one, two) =>
      one.subject_id < two.subject_id ? -1 : 1,
    );
    const cells = (listing: Listing | undefined): string[] =>
      listing === undefined
        ? REGIME_COLUMNS.map(() => '')
        : [
            listing.listedOn ?? '',
            listing.dateFrom,
            listing.dateClaimId ?? '',
            listing.endedOn ?? '',
            listing.actId,
            listing.actLabel,
            listing.documentIds.join(' '),
            listing.claimId,
          ];
    const on = (listing: Listing | undefined): string | null => listing?.listedOn ?? null;
    return [
      imo,
      String(isValidImo(imo)),
      vessels.map((one) => one.subject_id).join(' '),
      // A label is free text and can hold any separator, so the list is a JSON array.
      JSON.stringify(vessels.map((one) => labelOf(one.subject_id))),
      vessels.map((one) => one.claim_id).join(' '),
      ...cells(eu),
      ...cells(ofac),
      ...cells(uk),
      daysBetween(on(eu), on(ofac)),
      daysBetween(on(eu), on(uk)),
      daysBetween(on(uk), on(ofac)),
      String(eu === undefined && (ofac !== undefined || uk !== undefined)),
      String(eu !== undefined && ofac === undefined),
    ];
  });

  return {
    path: 'alignment-matrix.csv',
    text: csvFile(
      `${preamble}\n\n${matrixNote(rules, { noOfficialFile, twoRegimes })}`,
      HEADER,
      rows,
    ),
  };
};
