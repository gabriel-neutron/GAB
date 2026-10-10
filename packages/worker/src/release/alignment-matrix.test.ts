import { readCsv } from '@gab/tools/csv';
import { expect, test } from 'vitest';

import { alignmentMatrix } from './alignment-matrix.ts';
import type {
  ReleaseClaim,
  ReleaseDocument,
  ReleaseEntity,
  ReleaseRecord,
  ReleaseRelation,
} from './release-record.ts';

const RULES = {
  eu: 'entry_into_force',
  ofac: 'recent_actions_notice',
  uk: 'date_designated',
} as const;
const LABEL = 'Validated manually by the operator, on 2026-10-08';
const ACT = '00000000-0000-4000-8000-0000000000ac';

const id = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const SHIP = id(1);
const RENAMED = id(2);
const NO_IMO = id(3);
const OTHER = id(4);
const EU_ACT = id(10);
const EU_AMENDMENT = id(11);
const OFAC_LIST = id(12);
const UK_LIST = id(13);

// A valid IMO number: its check digit is right.
const VALID_IMO = '9811000';

const document = (key: string, provider: string | null): ReleaseDocument => ({
  id: key,
  title: `The document ${key}`,
  uri: null,
  retrieved_at: null,
  licence: null,
  provider,
});

const DOCUMENTS: readonly ReleaseDocument[] = [
  document('doc_eu', 'eu_eurlex'),
  document('doc_eu_amendment', 'eu_eurlex'),
  document('doc_sdn', 'ofac_sdn'),
  document('doc_uk', 'uk_sanctions_list'),
  document('doc_fsf', 'eu_fsf'),
  document('doc_news', null),
];

const entity = (key: string, type: string, label: string): ReleaseEntity => ({
  id: key,
  type,
  label,
  origin_label: LABEL,
  sources: ['doc_news'],
  geom: null,
});

const value = (
  subject: string,
  attribute: string,
  v: unknown,
  sources: string[] = ['doc_news'],
): ReleaseClaim => ({
  claim_id: `${subject}/${attribute}`,
  subject_kind: 'entity',
  subject_id: subject,
  attribute,
  value: v,
  origin_label: LABEL,
  sources,
  act_id: ACT,
  passages: [],
});

interface Designation {
  readonly relation: ReleaseRelation;
  readonly claim: ReleaseClaim;
}

const designation = (
  n: number,
  vessel: string,
  act: string,
  sources: string[],
  validFrom: string | null,
  validTo: string | null = null,
): Designation => ({
  relation: {
    id: id(n),
    type: 'designated_by',
    src_id: vessel,
    dst_id: act,
    valid_from: validFrom,
    valid_to: validTo,
    origin_label: LABEL,
    sources,
  },
  claim: {
    claim_id: id(n),
    subject_kind: 'relation',
    subject_id: id(n),
    attribute: null,
    value: null,
    origin_label: LABEL,
    sources,
    act_id: ACT,
    passages: [],
  },
});

const recordOf = (
  entities: readonly ReleaseEntity[],
  values: readonly ReleaseClaim[],
  designations: readonly Designation[],
): ReleaseRecord => ({
  entities,
  relations: designations.map((one) => one.relation),
  claims: [...values, ...designations.map((one) => one.claim)],
  merges: [],
  documents: new Map(DOCUMENTS.map((one) => [one.id, one])),
  disclaimer: '',
  natoPairs: null,
});

const ACTS = [
  entity(EU_ACT, 'legal_act', 'Council Regulation (EU) 2024/1745'),
  entity(EU_AMENDMENT, 'legal_act', 'Council Implementing Regulation (EU) 2025/1'),
  entity(OFAC_LIST, 'legal_act', 'OFAC SDN list'),
  entity(UK_LIST, 'legal_act', 'UK Sanctions List'),
];

const matrixOf = (record: ReleaseRecord) => {
  const file = alignmentMatrix(record, RULES, 'GAB dataset.\n\nThe disclaimer.');
  const body = file.text
    .slice(1)
    .split('\r\n')
    .filter((line) => !line.startsWith('#'))
    .join('\r\n');
  const [header, ...rows] = readCsv(body).map((one) => one.fields);
  return {
    file,
    rows: rows.map((row) =>
      Object.fromEntries((header ?? []).map((name, at) => [name, row[at] ?? ''])),
    ),
  };
};

const shipWith = (imo: unknown, designations: readonly Designation[]) =>
  matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [value(SHIP, 'imo', imo)],
      designations,
    ),
  );

test('a vessel listed by the three regimes gives one row, with the date, the act and the claim of each regime, and the gaps', () => {
  const eu = designation(20, SHIP, EU_ACT, ['doc_eu'], '2024-06-24');
  const ofac = designation(21, SHIP, OFAC_LIST, ['doc_sdn'], '2024-02-23');
  const uk = designation(22, SHIP, UK_LIST, ['doc_uk', 'doc_news'], '2024-05-09');
  const { file, rows } = shipWith(VALID_IMO, [eu, ofac, uk]);
  expect(file.path).toBe('alignment-matrix.csv');
  expect(rows).toStrictEqual([
    {
      imo: VALID_IMO,
      imo_check_digit_ok: 'true',
      vessel_ids: SHIP,
      vessel_labels: '["TEST TANKER"]',
      imo_claim_ids: `${SHIP}/imo`,
      eu_listed_on: '2024-06-24',
      eu_date_from: 'designation_start',
      eu_date_claim_id: eu.claim.claim_id,
      eu_ended_on: '',
      eu_act_id: EU_ACT,
      eu_act_label: 'Council Regulation (EU) 2024/1745',
      eu_document_ids: 'doc_eu',
      eu_claim_id: eu.claim.claim_id,
      ofac_listed_on: '2024-02-23',
      ofac_date_from: 'designation_start',
      ofac_date_claim_id: ofac.claim.claim_id,
      ofac_ended_on: '',
      ofac_act_id: OFAC_LIST,
      ofac_act_label: 'OFAC SDN list',
      ofac_document_ids: 'doc_sdn',
      ofac_claim_id: ofac.claim.claim_id,
      uk_listed_on: '2024-05-09',
      uk_date_from: 'designation_start',
      uk_date_claim_id: uk.claim.claim_id,
      uk_ended_on: '',
      uk_act_id: UK_LIST,
      uk_act_label: 'UK Sanctions List',
      uk_document_ids: 'doc_uk',
      uk_claim_id: uk.claim.claim_id,
      days_eu_after_ofac: '122',
      days_eu_after_uk: '46',
      days_uk_after_ofac: '76',
      ofac_or_uk_not_eu: 'false',
      eu_not_ofac: 'false',
    },
  ]);
  // The file holds the preamble, states the date rule of each regime, and says that the release
  // does not check the date against the rule.
  expect(file.text).toContain('# GAB dataset.');
  expect(file.text).toContain('# The disclaimer.');
  expect(file.text).toContain('EU: the date of entry into force');
  expect(file.text).toContain('OFAC: the date of the Recent Actions notice');
  expect(file.text).toContain('UK: the date designated');
  expect(file.text).toContain('The release does not check the date against the rule.');
  expect(file.text).toContain('The marks count each listing, ended or not.');
});

test('both directions are marked: OFAC and not the EU, the EU and not OFAC, and the UK alone', () => {
  const { rows } = matrixOf(
    recordOf(
      [
        entity(SHIP, 'vessel', 'TEST TANKER'),
        entity(RENAMED, 'vessel', 'TEST EU SHIP'),
        entity(OTHER, 'vessel', 'TEST UK SHIP'),
        ...ACTS,
      ],
      [
        value(SHIP, 'imo', '9123456'),
        value(RENAMED, 'imo', '9234567'),
        value(OTHER, 'imo', '9345678'),
      ],
      [
        designation(20, SHIP, OFAC_LIST, ['doc_sdn'], '2024-02-23'),
        designation(21, RENAMED, EU_ACT, ['doc_eu'], '2024-06-24'),
        designation(22, OTHER, UK_LIST, ['doc_uk'], '2024-05-09'),
      ],
    ),
  );
  expect(
    rows.map((row) => [
      row['imo'],
      row['ofac_or_uk_not_eu'],
      row['eu_not_ofac'],
      row['days_eu_after_ofac'],
    ]),
  ).toStrictEqual([
    ['9123456', 'true', 'false', ''],
    ['9234567', 'false', 'true', ''],
    ['9345678', 'true', 'false', ''],
  ]);
  expect(rows[0]).toMatchObject({ eu_listed_on: '', eu_claim_id: '', eu_date_from: '' });
});

test('two vessels with one IMO number, one of them renamed, give one row with the first listing of each regime', () => {
  const first = designation(20, SHIP, EU_ACT, ['doc_eu'], '2024-06-24');
  const later = designation(21, RENAMED, EU_AMENDMENT, ['doc_eu_amendment'], '2025-01-10');
  const { rows } = matrixOf(
    recordOf(
      [
        entity(SHIP, 'vessel', 'TEST; TANKER'),
        entity(RENAMED, 'vessel', 'TEST "NEW" NAME'),
        ...ACTS,
      ],
      [value(SHIP, 'imo', 'IMO 9123456'), value(RENAMED, 'imo', '9123456')],
      [later, first],
    ),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    imo: '9123456',
    imo_check_digit_ok: 'false',
    vessel_ids: `${SHIP} ${RENAMED}`,
    imo_claim_ids: `${SHIP}/imo ${RENAMED}/imo`,
    eu_listed_on: '2024-06-24',
    eu_claim_id: first.claim.claim_id,
  });
  // A label that holds the separator of a list stays one label.
  expect(JSON.parse(rows[0]?.['vessel_labels'] ?? '')).toStrictEqual([
    'TEST; TANKER',
    'TEST "NEW" NAME',
  ]);
});

test.each([
  ['IMO9811000', VALID_IMO],
  ['IMO 9811000', VALID_IMO],
  [9811000, VALID_IMO],
])('the IMO value %s joins as %s', (imo, joined) => {
  const { rows } = shipWith(imo, [designation(20, SHIP, EU_ACT, ['doc_eu'], '2024-06-24')]);
  expect(rows.map((row) => [row['imo'], row['imo_check_digit_ok']])).toStrictEqual([
    [joined, 'true'],
  ]);
});

test.each(['981100', '98110001', 'IMO 98110001', 'none'])(
  'the IMO value %s is not an IMO number, so the vessel is not in the matrix',
  (imo) => {
    const { rows } = shipWith(imo, [designation(20, SHIP, EU_ACT, ['doc_eu'], '2024-06-24')]);
    expect(rows).toStrictEqual([]);
  },
);

test('a vessel with no IMO number is not in the matrix, and a designation with no official document is counted in the note', () => {
  const { rows, file } = matrixOf(
    recordOf(
      [entity(NO_IMO, 'vessel', 'TEST NO IMO'), entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [value(SHIP, 'imo', '9123456'), value(NO_IMO, 'flag', 'Panama')],
      [
        designation(20, NO_IMO, EU_ACT, ['doc_eu'], '2024-06-24'),
        designation(21, SHIP, EU_ACT, ['doc_news'], '2024-06-24'),
        // The EU financial sanctions file has no tool, so it gives no regime.
        designation(22, SHIP, EU_ACT, ['doc_fsf'], '2024-06-24'),
      ],
    ),
  );
  expect(rows).toStrictEqual([]);
  expect(file.text).toContain(
    'Designations of a vessel with an IMO number that cite no official file of a regime, and count in no regime: 2.',
  );
});

test('a designation that cites the official files of two regimes counts in no regime, and the note counts it', () => {
  const both = designation(20, SHIP, OFAC_LIST, ['doc_sdn', 'doc_uk'], '2024-02-23');
  const uk = designation(21, SHIP, UK_LIST, ['doc_uk'], '2024-05-09');
  const { rows, file } = shipWith('9123456', [both, uk]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ ofac_claim_id: '', uk_claim_id: uk.claim.claim_id });
  expect(file.text).toContain(
    'Designations that cite the official files of more than one regime, and count in no regime: 1.',
  );
  expect(file.text).toContain(
    'Designations of a vessel with an IMO number that cite no official file of a regime, and count in no regime: 0.',
  );
});

test('an ended listing gives its end date and still counts in the marks', () => {
  const { rows } = shipWith('9123456', [
    designation(20, SHIP, EU_ACT, ['doc_eu'], '2024-06-24', '2025-03-01'),
  ]);
  expect(rows[0]).toMatchObject({
    eu_listed_on: '2024-06-24',
    eu_ended_on: '2025-03-01',
    eu_not_ofac: 'true',
  });
});

test('an EU designation with no start date takes the entry into force of its act only when that value cites a document of the designation', () => {
  const eu = designation(20, SHIP, EU_AMENDMENT, ['doc_eu_amendment'], null);
  const ofac = designation(21, SHIP, OFAC_LIST, ['doc_sdn'], null);
  const { file, rows } = matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [
        value(SHIP, 'imo', '9123456'),
        value(EU_AMENDMENT, 'entry_into_force', '2025-01-11', ['doc_eu_amendment']),
      ],
      [eu, ofac],
    ),
  );
  expect(rows[0]).toMatchObject({
    eu_listed_on: '2025-01-11',
    eu_date_from: 'act_entry_into_force',
    eu_date_claim_id: `${EU_AMENDMENT}/entry_into_force`,
    eu_claim_id: eu.claim.claim_id,
    ofac_listed_on: '',
    ofac_date_from: 'none',
    ofac_date_claim_id: '',
    ofac_claim_id: ofac.claim.claim_id,
    days_eu_after_ofac: '',
  });
  expect(file.text).toContain('the entry into force of the act that designates');
});

test('an EU designation that points to the base act, from the document of a later amendment, gets no date from the base act', () => {
  // The base act entered into force in 2014 and states it in its own document. The vessel was
  // added by an amendment in 2025, so the date of the base act is not the date of this listing.
  const eu = designation(20, SHIP, EU_ACT, ['doc_eu_amendment'], null);
  const { rows } = matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [value(SHIP, 'imo', '9123456'), value(EU_ACT, 'entry_into_force', '2014-08-01', ['doc_eu'])],
      [eu],
    ),
  );
  expect(rows[0]).toMatchObject({
    eu_listed_on: '',
    eu_date_from: 'none',
    eu_date_claim_id: '',
    eu_claim_id: eu.claim.claim_id,
  });
});

test('a designation with a date comes before an older designation with no date', () => {
  const dated = designation(21, SHIP, EU_AMENDMENT, ['doc_eu_amendment'], '2025-01-10');
  const { rows } = shipWith('9123456', [designation(20, SHIP, EU_ACT, ['doc_eu'], null), dated]);
  expect(rows[0]).toMatchObject({ eu_listed_on: '2025-01-10', eu_claim_id: dated.claim.claim_id });
});
