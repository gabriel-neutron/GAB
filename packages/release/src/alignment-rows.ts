import { readReleaseRows } from './release-table.ts';
import { SiteReleaseFault } from './site-release-fault.ts';

export const REGIMES = ['eu', 'ofac', 'uk'] as const;

export type AlignmentRegime = (typeof REGIMES)[number];

/** The first listing of one IMO number by one regime. */
export interface AlignmentListing {
  /** Null when the listing has no date. */
  readonly listedOn: string | null;
  readonly endedOn: string | null;
  readonly actId: string;
  readonly actLabel: string;
  readonly claimId: string;
}

/** One row of the alignment matrix: one IMO number and its listing in each regime. */
export interface AlignmentRow {
  readonly imo: string;
  readonly vesselIds: readonly string[];
  readonly vesselLabels: readonly string[];
  /** Null when the regime does not list the number. */
  readonly listings: Readonly<Record<AlignmentRegime, AlignmentListing | null>>;
  readonly ofacOrUkNotEu: boolean;
  readonly euNotOfac: boolean;
}

const PATH = 'alignment-matrix.csv';

const REGIME_COLUMNS = ['listed_on', 'ended_on', 'act_id', 'act_label', 'claim_id'] as const;

const ids = (text: string): readonly string[] => text.split(' ').filter((one) => one !== '');

const labelsOf = (text: string): readonly string[] => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SiteReleaseFault(`${PATH}: vessel_labels is not a JSON list`);
  }
  if (!Array.isArray(json) || json.some((one) => typeof one !== 'string'))
    throw new SiteReleaseFault(`${PATH}: vessel_labels is not a list of text`);
  return json.map(String);
};

/** The rows of the alignment matrix of a release. A listing is present when its act is named. */
export const readAlignmentRows = (text: string): readonly AlignmentRow[] =>
  readReleaseRows(PATH, text, [
    'imo',
    'vessel_ids',
    'vessel_labels',
    'ofac_or_uk_not_eu',
    'eu_not_ofac',
    ...REGIMES.flatMap((regime) => REGIME_COLUMNS.map((column) => `${regime}_${column}`)),
  ]).map((row) => {
    const cell = (column: string): string => row[column] ?? '';
    const listing = (regime: AlignmentRegime): AlignmentListing | null =>
      cell(`${regime}_act_id`) === ''
        ? null
        : {
            listedOn: cell(`${regime}_listed_on`) || null,
            endedOn: cell(`${regime}_ended_on`) || null,
            actId: cell(`${regime}_act_id`),
            actLabel: cell(`${regime}_act_label`),
            claimId: cell(`${regime}_claim_id`),
          };
    return {
      imo: cell('imo'),
      vesselIds: ids(cell('vessel_ids')),
      vesselLabels: labelsOf(cell('vessel_labels')),
      listings: { eu: listing('eu'), ofac: listing('ofac'), uk: listing('uk') },
      ofacOrUkNotEu: cell('ofac_or_uk_not_eu') === 'true',
      euNotOfac: cell('eu_not_ofac') === 'true',
    };
  });
