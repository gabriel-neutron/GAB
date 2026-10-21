// The fixed release of the stories of the report page: the release that the release code wrote,
// with the NATO pair, and an alignment matrix of two rows that the test made. The rows are made for
// the test and are not data of the record.

import { readSiteRelease } from '@gab/release/site-release';

const NATO = import.meta.glob<string>('../../../packages/site/fixtures/release-nato/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const REGIMES = ['eu', 'ofac', 'uk'] as const;
const FIELDS = [
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
  ...REGIMES.flatMap((regime) => FIELDS.map((field) => `${regime}_${field}`)),
  'days_eu_after_ofac',
  'days_eu_after_uk',
  'days_uk_after_ofac',
  'ofac_or_uk_not_eu',
  'eu_not_ofac',
];

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const OTHER = '0a1f0000-0000-4000-8000-000000000009';
const ACT = '0a1f0000-0000-4000-8000-000000000003';
const CLAIM = '0a1f0000-0000-4000-8000-000000000012';

const NONE = FIELDS.map(() => '');
const listing = (listedOn: string, endedOn: string, claim: string): string[] => [
  listedOn,
  'designation_start',
  '',
  endedOn,
  ACT,
  'Council of the European Union',
  'eu_act',
  claim,
];

const row = (
  imo: string,
  vessel: string,
  label: string,
  cells: readonly (readonly string[])[],
  marks: readonly string[],
): string =>
  [imo, 'true', vessel, JSON.stringify([label]), '', ...cells.flat(), '', '', '', ...marks]
    .map((cell) => `"${cell.replaceAll('"', '""')}"`)
    .join(',');

const MATRIX = [
  HEADER.join(','),
  // Listed by the EU only, so the row is in the mark "EU, not OFAC".
  row(
    '9000001',
    VESSEL,
    'Severnaya Volna',
    [listing('2025-03-14', '', CLAIM), NONE, NONE],
    ['false', 'true'],
  ),
  // Listed by OFAC, then ended, and not by the EU.
  row(
    '9000002',
    OTHER,
    'Northern Wave',
    [NONE, listing('2024-01-10', '2024-04-26', 'claim-unknown'), NONE],
    ['true', 'false'],
  ),
].join('\n');

const files = new Map(
  Object.entries(NATO).map(([path, text]) => [path.split('/').pop() ?? path, text]),
);
files.set('alignment-matrix.csv', MATRIX);

/** The fixed release with the NATO pair of each claim, and two rows of the alignment matrix. */
export const EXPORTS_RELEASE = readSiteRelease(files);
