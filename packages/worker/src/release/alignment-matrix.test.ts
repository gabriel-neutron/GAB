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
const EU_ONLY = id(4);
const EU_ACT = id(10);
const EU_AMENDMENT = id(11);
const OFAC_LIST = id(12);
const UK_LIST = id(13);

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

const value = (subject: string, attribute: string, v: unknown): ReleaseClaim => ({
  claim_id: `${subject}/${attribute}`,
  subject_kind: 'entity',
  subject_id: subject,
  attribute,
  value: v,
  origin_label: LABEL,
  sources: ['doc_news'],
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
): Designation => ({
  relation: {
    id: id(n),
    type: 'designated_by',
    src_id: vessel,
    dst_id: act,
    valid_from: validFrom,
    valid_to: null,
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

test('a vessel listed by the three regimes gives one row, with the date, the act and the claim of each regime, and the gaps', () => {
  const eu = designation(20, SHIP, EU_ACT, ['doc_eu'], '2024-06-24');
  const ofac = designation(21, SHIP, OFAC_LIST, ['doc_sdn'], '2024-02-23');
  const uk = designation(22, SHIP, UK_LIST, ['doc_uk', 'doc_news'], '2024-05-09');
  const { file, rows } = matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [value(SHIP, 'imo', '9123456')],
      [eu, ofac, uk],
    ),
  );
  expect(file.path).toBe('alignment-matrix.csv');
  expect(rows).toStrictEqual([
    {
      imo: '9123456',
      vessel_ids: SHIP,
      vessel_labels: 'TEST TANKER',
      imo_claim_ids: `${SHIP}/imo`,
      eu_listed_on: '2024-06-24',
      eu_date_from: 'designation_start',
      eu_date_claim_id: eu.claim.claim_id,
      eu_act_id: EU_ACT,
      eu_act_label: 'Council Regulation (EU) 2024/1745',
      eu_document_ids: 'doc_eu',
      eu_claim_id: eu.claim.claim_id,
      ofac_listed_on: '2024-02-23',
      ofac_date_from: 'designation_start',
      ofac_date_claim_id: ofac.claim.claim_id,
      ofac_act_id: OFAC_LIST,
      ofac_act_label: 'OFAC SDN list',
      ofac_document_ids: 'doc_sdn',
      ofac_claim_id: ofac.claim.claim_id,
      uk_listed_on: '2024-05-09',
      uk_date_from: 'designation_start',
      uk_date_claim_id: uk.claim.claim_id,
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
  // The file states the date rule of each regime and holds the preamble.
  expect(file.text).toContain('# GAB dataset.');
  expect(file.text).toContain('# The disclaimer.');
  expect(file.text).toContain('EU: the date of entry into force');
  expect(file.text).toContain('OFAC: the date of the Recent Actions notice');
  expect(file.text).toContain('UK: the date designated');
});

test('both directions are marked: a vessel that OFAC lists and the EU does not, and the reverse', () => {
  const { rows } = matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), entity(EU_ONLY, 'vessel', 'TEST EU SHIP'), ...ACTS],
      [value(SHIP, 'imo', '9123456'), value(EU_ONLY, 'imo', 9234567)],
      [
        designation(20, SHIP, OFAC_LIST, ['doc_sdn'], '2024-02-23'),
        designation(21, EU_ONLY, EU_ACT, ['doc_eu'], '2024-06-24'),
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
  ]);
  expect(rows[0]).toMatchObject({ eu_listed_on: '', eu_claim_id: '', eu_date_from: '' });
});

test('two vessels with one IMO number, one of them renamed, give one row with the first listing of each regime', () => {
  const first = designation(20, SHIP, EU_ACT, ['doc_eu'], '2024-06-24');
  const later = designation(21, RENAMED, EU_AMENDMENT, ['doc_eu_amendment'], '2025-01-10');
  const { rows } = matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), entity(RENAMED, 'vessel', 'TEST NEW NAME'), ...ACTS],
      [value(SHIP, 'imo', 'IMO 9123456'), value(RENAMED, 'imo', '9123456')],
      [later, first],
    ),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    imo: '9123456',
    vessel_ids: `${SHIP} ${RENAMED}`,
    vessel_labels: 'TEST TANKER; TEST NEW NAME',
    imo_claim_ids: `${SHIP}/imo ${RENAMED}/imo`,
    eu_listed_on: '2024-06-24',
    eu_claim_id: first.claim.claim_id,
  });
});

test('a vessel with no IMO number, and a designation with no official document, are not in the matrix', () => {
  const { rows } = matrixOf(
    recordOf(
      [entity(NO_IMO, 'vessel', 'TEST NO IMO'), entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [value(SHIP, 'imo', '9123456'), value(NO_IMO, 'flag', 'Panama')],
      [
        designation(20, NO_IMO, EU_ACT, ['doc_eu'], '2024-06-24'),
        designation(21, SHIP, EU_ACT, ['doc_news'], '2024-06-24'),
      ],
    ),
  );
  expect(rows).toStrictEqual([]);
});

test('an EU designation with no start date takes the entry into force of its act, and else gives no date', () => {
  const eu = designation(20, SHIP, EU_ACT, ['doc_eu'], null);
  const ofac = designation(21, SHIP, OFAC_LIST, ['doc_sdn'], null);
  const record = recordOf(
    [entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
    [value(SHIP, 'imo', '9123456'), value(EU_ACT, 'entry_into_force', '2024-06-25')],
    [eu, ofac],
  );
  const { file, rows } = matrixOf(record);
  expect(rows[0]).toMatchObject({
    eu_listed_on: '2024-06-25',
    eu_date_from: 'act_entry_into_force',
    eu_date_claim_id: `${EU_ACT}/entry_into_force`,
    eu_claim_id: eu.claim.claim_id,
    ofac_listed_on: '',
    ofac_date_from: 'none',
    ofac_date_claim_id: '',
    ofac_claim_id: ofac.claim.claim_id,
    days_eu_after_ofac: '',
  });
  expect(file.text).toContain('the entry into force of the act that designates');

  // With no entry into force either, the EU listing has no date.
  const bare = matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [value(SHIP, 'imo', '9123456')],
      [eu],
    ),
  );
  expect(bare.rows[0]).toMatchObject({
    eu_listed_on: '',
    eu_date_from: 'none',
    eu_claim_id: eu.claim.claim_id,
  });
});

test('a designation with a date comes before an older designation with no date', () => {
  const dated = designation(21, SHIP, EU_AMENDMENT, ['doc_eu_amendment'], '2025-01-10');
  const { rows } = matrixOf(
    recordOf(
      [entity(SHIP, 'vessel', 'TEST TANKER'), ...ACTS],
      [value(SHIP, 'imo', '9123456')],
      [designation(20, SHIP, EU_ACT, ['doc_eu'], null), dated],
    ),
  );
  expect(rows[0]).toMatchObject({ eu_listed_on: '2025-01-10', eu_claim_id: dated.claim.claim_id });
});
