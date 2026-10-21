import { isDay } from '@gab/proposal/day';
import { isValidImo } from '@gab/proposal/identifiers';

import type { ReleaseFile } from './csv-export.ts';
import { csvFile } from './csv-file.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import type { ReleaseClaim, ReleaseRecord, ReleaseRelation } from './release-record.ts';

export type Regime = 'eu' | 'ofac' | 'uk';
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

/** The distinct regimes of the official files among the cited documents (ADR 0017). */
export const regimesOfSources = (
  sources: readonly string[],
  documentOf: (id: string) => { readonly provider: string | null },
): Regime[] => [
  ...new Set(
    sources.flatMap((id) => {
      const regime = REGIME_OF_PROVIDER.get(documentOf(id).provider ?? '');
      return regime === undefined ? [] : [regime];
    }),
  ),
];

/** The regime of a designation: the one regime of the cited official files. Null when the
 * sources cite no official file, or the files of more than one regime. */
export const regimeOfSources = (
  sources: readonly string[],
  documentOf: (id: string) => { readonly provider: string | null },
): Regime | null => {
  const [only, ...others] = regimesOfSources(sources, documentOf);
  return only !== undefined && others.length === 0 ? only : null;
};

const RULE_WORDS: Readonly<Record<DateRule, string>> = {
  entry_into_force: 'the date of entry into force',
  recent_actions_notice: 'the date of the Recent Actions notice',
  date_designated: 'the date designated',
};

const TYPE_WORDS: Readonly<Record<DateRule, string>> = {
  entry_into_force: 'the entry into force of the act',
  recent_actions_notice: 'the date of the action',
  date_designated: 'the date designated',
};

/** The date of a listing and the claim that gives it, or no date. */
export type Dated =
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

// An IMO number is seven digits. A writer can give it as a number, or with the prefix "IMO". A
// list or any other shape gives no number. The check of the faults reads the number with the
// same rule.
const imoOf = (value: unknown): string | null => {
  const text =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const digits = text.replace(/^IMO\s*/iu, '');
  return /^\d{7}$/u.test(digits) ? digits : null;
};

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

const days = (later: string | null, earlier: string | null): number | null =>
  later === null || earlier === null
    ? null
    : Math.round((Date.parse(later) - Date.parse(earlier)) / 86_400_000);

const daysBetween = (later: string | null, earlier: string | null): string =>
  String(days(later, earlier) ?? '');

interface Counts {
  readonly noOfficialFile: number;
  readonly twoRegimes: number;
}

/** The dates of one row, and its two marks. */
interface RowFacts {
  readonly eu: string | null;
  readonly ofac: string | null;
  readonly uk: string | null;
  readonly hasEu: boolean;
  readonly hasOfac: boolean;
  readonly ofacOrUkNotEu: boolean;
}

// The note splits the rows at these days.
const EU_CUT = '2025-02-01';
const OFAC_CUT = '2022-01-01';

const meanOf = (gaps: readonly number[]): string =>
  `${(gaps.reduce((sum, one) => sum + one, 0) / gaps.length).toFixed(1)} days for ${String(gaps.length)} ${gaps.length === 1 ? 'row' : 'rows'}`;

/** The mean of one gap over the rows that have it, and the mean without the rows of the OFAC day
 * that most rows share. */
const meanLine = (
  name: string,
  rows: readonly RowFacts[],
  gap: (row: RowFacts) => number | null,
  commonDay: string,
): string => {
  const all = rows.flatMap((row) => gap(row) ?? []);
  const others = rows.filter((row) => row.ofac !== commonDay).flatMap((row) => gap(row) ?? []);
  if (all.length === 0) return `Mean of ${name}: no row.`;
  const without =
    others.length === 0
      ? 'no row without the rows of that day'
      : `${meanOf(others)} without the rows of that day`;
  return `Mean of ${name}: ${meanOf(all)}; ${without}.`;
};

/** The lines of the note that the rows give: the EU split, the OFAC day that most rows share, the
 * mean gaps with and without that day, and the floor of the mark ofac_or_uk_not_eu. */
const countLines = (rows: readonly RowFacts[]): string[] => {
  const euOnly = rows.filter((row) => row.hasEu && !row.hasOfac);
  const before = euOnly.filter((row) => row.eu !== null && row.eu < EU_CUT).length;
  const after = euOnly.filter((row) => row.eu !== null && row.eu >= EU_CUT).length;
  const noDate = euOnly.filter((row) => row.eu === null).length;

  const byDay = new Map<string, number>();
  for (const row of rows)
    if (row.ofac !== null) byDay.set(row.ofac, (byDay.get(row.ofac) ?? 0) + 1);
  const dated = [...byDay.values()].reduce((sum, one) => sum + one, 0);
  // A tie goes to the earlier day.
  const [commonDay, commonRows] = [...byDay.entries()].sort(
    (one, two) => two[1] - one[1] || (one[0] < two[0] ? -1 : 1),
  )[0] ?? [null, 0];

  return [
    `Rows with an EU listing and no OFAC listing: ${String(euOnly.length)}. EU date before 1 February 2025: ${String(before)}. EU date on 1 February 2025 or later: ${String(after)}. No EU date: ${String(noDate)}.`,
    commonDay === null
      ? 'No row has an OFAC date.'
      : `The OFAC date with the most rows is ${commonDay}: ${String(commonRows)} of the ${String(dated)} rows with an OFAC date.`,
    `Rows with an OFAC date before 2022: ${String(rows.filter((row) => row.ofac !== null && row.ofac < OFAC_CUT).length)}.`,
    meanLine('days_eu_after_ofac', rows, (row) => days(row.eu, row.ofac), commonDay ?? ''),
    meanLine('days_uk_after_ofac', rows, (row) => days(row.uk, row.ofac), commonDay ?? ''),
    `ofac_or_uk_not_eu is a floor: ${String(rows.filter((row) => row.ofacOrUkNotEu).length)} rows among the vessels in the record. A vessel that the record does not hold has no row.`,
  ];
};

/** The text that the matrix adds to the preamble: what a row is, the date rule of each regime,
 * and the designations that count in no regime. */
const matrixNote = (
  rules: ReleaseManifest['dateRules'],
  counts: Counts,
  rows: readonly RowFacts[],
): string =>
  [
    'Alignment matrix of the EU, OFAC and UK sanctions lists.',
    'One row for each IMO number of a public vessel that a public designation of at least one regime lists. The join is on the IMO number only, never on a name. imo_check_digit_ok tells if the check digit of the number is right.',
    'A designation belongs to a regime by the provider of its official file: EU EUR-Lex for the EU, the OFAC SDN list for OFAC, the UK Sanctions List for the UK.',
    `Date rules of this release. EU: ${RULE_WORDS[rules.eu]}. OFAC: ${RULE_WORDS[rules.ofac]}. UK: ${RULE_WORDS[rules.uk]}.`,
    'Measure of each regime. EU: port and service ban (Council Regulation (EU) No 833/2014, Annex XLII). OFAC: blocking under a Russia programme. UK: asset freeze (Russia (Sanctions) (EU Exit) Regulations 2019, UK Sanctions List row). The day gaps compare different measures.',
    'The matrix gives the listing date, not the current status. The release tracks no OFAC removal and no UK removal.',
    `The type of date is different for each regime. EU: ${TYPE_WORDS[rules.eu]}. OFAC: ${TYPE_WORDS[rules.ofac]}. UK: ${TYPE_WORDS[rules.uk]}.`,
    'The date of a listing is the start date of its designation, as the writer proposed it from the source (date_from designation_start). The release does not check the date against the rule.',
    'Under the EU rule, a designation with no start date takes the entry into force of the act that designates, when that value cites a document of the designation (date_from act_entry_into_force). Else the listing has no date (date_from none), and its gaps are empty.',
    'When a regime lists one IMO number more than once, the row gives the first listing with a date. ended_on is the end date of that listing. The marks count each listing, ended or not.',
    'days_eu_after_ofac is the EU date minus the OFAC date, in days. days_eu_after_uk and days_uk_after_ofac read the same way.',
    `Designations of a vessel with an IMO number that cite no official file of a regime, and count in no regime: ${String(counts.noOfficialFile)}.`,
    `Designations that cite the official files of more than one regime, and count in no regime: ${String(counts.twoRegimes)}.`,
    ...countLines(rows),
  ].join('\n');

/** The entry into force of the act of a designation counts only when its value cites a document
 * of the designation. An act that a later act amends states its own entry into force, and not the
 * day when the later act added the vessel. */
export const entryIntoForceOf = (
  claims: ReadonlyMap<string, ReleaseClaim>,
  relation: ReleaseRelation,
  documentIds: readonly string[],
): Dated => {
  const claim = claims.get(`${relation.dst_id}/entry_into_force`);
  if (claim === undefined || !isDay(claim.value)) return NO_DATE;
  if (!claim.sources.some((one) => documentIds.includes(one))) return NO_DATE;
  return { dateFrom: 'act_entry_into_force', listedOn: claim.value, dateClaimId: claim.claim_id };
};

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

  const entryIntoForce = (relation: ReleaseRelation, documentIds: readonly string[]): Dated =>
    entryIntoForceOf(claims, relation, documentIds);

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
    const [regime, ...others] = regimesOfSources(claim.sources, documentOf);
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

  const facts: RowFacts[] = [];
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
    const ofacOrUkNotEu = eu === undefined && (ofac !== undefined || uk !== undefined);
    facts.push({
      eu: on(eu),
      ofac: on(ofac),
      uk: on(uk),
      hasEu: eu !== undefined,
      hasOfac: ofac !== undefined,
      ofacOrUkNotEu,
    });
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
      String(ofacOrUkNotEu),
      String(eu !== undefined && ofac === undefined),
    ];
  });

  return {
    path: 'alignment-matrix.csv',
    text: csvFile(
      `${preamble}\n\n${matrixNote(rules, { noOfficialFile, twoRegimes }, facts)}`,
      HEADER,
      rows,
    ),
  };
};
