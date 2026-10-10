import type { ReleaseFile } from './csv-export.ts';
import { csvFile } from './csv-file.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

type Regime = 'eu' | 'ofac' | 'uk';
const REGIMES: readonly Regime[] = ['eu', 'ofac', 'uk'];

// Only the official tools give these providers to the documents that they store, so the provider
// of a cited document tells the regime of a designation. A label of an authority is free text.
const REGIME_OF_PROVIDER: ReadonlyMap<string, Regime> = new Map([
  ['eu_eurlex', 'eu'],
  ['eu_fsf', 'eu'],
  ['ofac_sdn', 'ofac'],
  ['uk_sanctions_list', 'uk'],
]);

const RULE_WORDS = {
  entry_into_force: 'the date of entry into force',
  recent_actions_notice: 'the date of the Recent Actions notice',
  date_designated: 'the date designated',
} as const;

/** Where the date of a listing comes from. */
type DateFrom = 'designation_start' | 'act_entry_into_force' | 'none';

interface Listing {
  readonly listedOn: string | null;
  readonly dateFrom: DateFrom;
  readonly dateClaimId: string | null;
  readonly actId: string;
  readonly actLabel: string;
  readonly documentIds: readonly string[];
  readonly claimId: string;
}

const REGIME_COLUMNS = [
  'listed_on',
  'date_from',
  'date_claim_id',
  'act_id',
  'act_label',
  'document_ids',
  'claim_id',
] as const;

const HEADER = [
  'imo',
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

/** The text that the matrix adds to the preamble: what a row is and the date rule of each
 * regime. */
const matrixNote = (rules: ReleaseManifest['dateRules']): string =>
  [
    'Alignment matrix of the EU, OFAC and UK sanctions lists.',
    'One row for each IMO number of a public vessel that a public designation of at least one regime lists. The join is on the IMO number only, never on a name.',
    'A designation belongs to a regime by the provider of its official document: EU EUR-Lex or the EU financial sanctions file for the EU, the OFAC SDN list for OFAC, the UK Sanctions List for the UK.',
    `Date rules of this release. EU: ${RULE_WORDS[rules.eu]}. OFAC: ${RULE_WORDS[rules.ofac]}. UK: ${RULE_WORDS[rules.uk]}.`,
    'The date of a listing is the start date of the designation (date_from designation_start), which holds the date that the rule names. When the designation has no start date, an EU listing takes the entry into force of the act that designates (date_from act_entry_into_force). Else the listing has no date (date_from none), and its gaps are empty.',
    'When a regime lists one IMO number more than once, the row gives the first listing with a date.',
    'days_eu_after_ofac is the EU date minus the OFAC date, in days. days_eu_after_uk and days_uk_after_ofac read the same way.',
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

  const entryIntoForce = (act: string): { day: string; claimId: string } | null => {
    const claim = claims.get(`${act}/entry_into_force`);
    return claim !== undefined && isDay(claim.value)
      ? { day: claim.value, claimId: claim.claim_id }
      : null;
  };

  const listings = new Map<string, Map<Regime, Listing[]>>();
  for (const claim of record.claims) {
    if (claim.subject_kind !== 'relation' || claim.attribute !== null) continue;
    const relation = relationOf(claim.subject_id);
    if (relation.type !== 'designated_by') continue;
    const imo = imoOfVessel.get(relation.src_id);
    if (imo === undefined) continue;
    for (const regime of REGIMES) {
      const documentIds = claim.sources.filter(
        (id) => REGIME_OF_PROVIDER.get(documentOf(id).provider ?? '') === regime,
      );
      if (documentIds.length === 0) continue;
      const act = regime === 'eu' ? entryIntoForce(relation.dst_id) : null;
      const dated: Pick<Listing, 'listedOn' | 'dateFrom' | 'dateClaimId'> =
        relation.valid_from !== null
          ? {
              listedOn: relation.valid_from,
              dateFrom: 'designation_start',
              dateClaimId: claim.claim_id,
            }
          : act !== null
            ? { listedOn: act.day, dateFrom: 'act_entry_into_force', dateClaimId: act.claimId }
            : { listedOn: null, dateFrom: 'none', dateClaimId: null };
      const byRegime = listings.get(imo) ?? new Map<Regime, Listing[]>();
      byRegime.set(regime, [
        ...(byRegime.get(regime) ?? []),
        {
          ...dated,
          actId: relation.dst_id,
          actLabel: labelOf(relation.dst_id),
          documentIds,
          claimId: claim.claim_id,
        },
      ]);
      listings.set(imo, byRegime);
    }
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
            listing.actId,
            listing.actLabel,
            listing.documentIds.join(' '),
            listing.claimId,
          ];
    const on = (listing: Listing | undefined): string | null => listing?.listedOn ?? null;
    return [
      imo,
      vessels.map((one) => one.subject_id).join(' '),
      vessels.map((one) => labelOf(one.subject_id)).join('; '),
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
    text: csvFile(`${preamble}\n\n${matrixNote(rules)}`, HEADER, rows),
  };
};
