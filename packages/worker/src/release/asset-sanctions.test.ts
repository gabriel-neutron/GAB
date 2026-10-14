import { expect, test } from 'vitest';

import { assetSanctions, statusLines } from './asset-sanctions.ts';
import type {
  ReleaseClaim,
  ReleaseDocument,
  ReleaseEntity,
  ReleaseRecord,
  ReleaseRelation,
} from './release-record.ts';

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const LABEL = 'Validated manually by the operator, on 2026-10-08';
const ACT = id(900);

const entity = (n: number, type: string, label: string): ReleaseEntity => ({
  id: id(n),
  type,
  label,
  origin_label: LABEL,
  sources: ['doc_eu'],
  geom: null,
});

const relation = (
  n: number,
  type: string,
  src: number,
  dst: number,
  extra: Partial<ReleaseRelation> = {},
): ReleaseRelation => ({
  id: id(n),
  type,
  src_id: id(src),
  dst_id: id(dst),
  valid_from: null,
  valid_to: null,
  origin_label: LABEL,
  sources: ['doc_eu'],
  ...extra,
});

const claim = (
  relationId: string,
  attribute: string | null,
  value: unknown,
  sources: string[] = ['doc_eu'],
): ReleaseClaim => ({
  claim_id: attribute === null ? relationId : `${relationId}/${attribute}`,
  subject_kind: 'relation',
  subject_id: relationId,
  attribute,
  value,
  origin_label: LABEL,
  sources,
  act_id: ACT,
  passages: [],
});

const document = (docId: string, provider: string | null): [string, ReleaseDocument] => [
  docId,
  { id: docId, title: docId, uri: null, retrieved_at: null, licence: null, provider },
];

// Rosneft Terminal is a facility that a listed operator runs. Taiga Field is a facility that
// two companies hold: one is listed, and one is a derived company. Idle Field has no listed end.
const OPERATOR = 1;
const TERMINAL = 2;
const FIELD = 3;
const LISTED_OWNER = 4;
const MIDDLE = 5;
const IDLE = 6;
const SMALL_OWNER = 7;
const REG_EU = 8;
const REG_OFAC = 9;
const GL = 10;

const RECORD: ReleaseRecord = {
  entities: [
    entity(OPERATOR, 'company', 'Listed Operator'),
    entity(TERMINAL, 'facility', 'Rosneft Terminal'),
    entity(FIELD, 'facility', 'Taiga Field'),
    entity(LISTED_OWNER, 'company', 'Listed Owner'),
    entity(MIDDLE, 'company', 'Middle Company'),
    entity(IDLE, 'facility', 'Idle Field'),
    entity(SMALL_OWNER, 'company', 'Small Owner'),
    entity(REG_EU, 'legal_act', 'Regulation 269/2014'),
    entity(REG_OFAC, 'legal_act', 'SDN notice'),
    entity(GL, 'legal_act', 'General Licence 8'),
  ],
  relations: [
    relation(101, 'operates', OPERATOR, TERMINAL),
    relation(102, 'designated_by', OPERATOR, REG_EU, { valid_from: '2022-02-23' }),
    // The listed owner holds 60% of the middle company, and the middle company holds 51% of
    // the field. GEM estimated the 51%.
    relation(103, 'designated_by', LISTED_OWNER, REG_OFAC, { valid_from: '2022-04-06' }),
    relation(104, 'owns', LISTED_OWNER, MIDDLE),
    relation(105, 'owns', MIDDLE, FIELD),
    relation(106, 'exempted_by', LISTED_OWNER, GL, { valid_from: '2022-06-01' }),
    relation(107, 'owns', SMALL_OWNER, IDLE),
    relation(108, 'owns', LISTED_OWNER, IDLE),
    relation(109, 'exempted_by', OPERATOR, GL, {
      valid_from: '2022-03-01',
      valid_to: '2022-12-01',
    }),
  ],
  claims: [
    claim(id(102), null, null, ['doc_eu']),
    claim(id(103), null, null, ['doc_ofac']),
    claim(id(104), 'share_pct', 60),
    claim(id(105), 'share_pct', 51),
    claim(id(105), 'share_imputed', true),
    claim(id(106), null, null, ['doc_ofac']),
    claim(id(107), 'share_pct', 90),
    claim(id(108), 'share_pct', 10),
  ],
  merges: [],
  documents: new Map([document('doc_eu', 'eu_eurlex'), document('doc_ofac', 'ofac_sdn')]),
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  disclaimer: '',
  natoPairs: null,
};

const byLabel = (record: ReleaseRecord, day: string) =>
  new Map(assetSanctions(record, day).map((one) => [one.assetLabel, one]));

test('an asset with a listed operator is listed, with the regime, the act and the date', () => {
  const terminal = byLabel(RECORD, '2026-10-13').get('Rosneft Terminal');
  expect(terminal?.status).toBe('listed');
  expect(terminal?.designations).toMatchObject([
    {
      entityLabel: 'Listed Operator',
      regime: 'eu',
      actLabel: 'Regulation 269/2014',
      date: '2022-02-23',
    },
  ]);
});

test('an asset that a derived company holds is derived, with the shares and the estimate', () => {
  const field = byLabel(RECORD, '2026-10-13').get('Taiga Field');
  expect(field?.status).toBe('derived');
  expect(field?.heldPct).toBe(51);
  expect(field?.holders).toMatchObject([
    { label: 'Middle Company', holderStatus: 'derived', sharePct: 51, estimated: true },
  ]);
  // The designation at the top of the chain is the OFAC listing of the owner.
  expect(field?.designations).toMatchObject([
    { entityLabel: 'Listed Owner', regime: 'ofac', date: '2022-04-06' },
  ]);
});

test('a general licence shows next to the status, also when it has ended', () => {
  const day = byLabel(RECORD, '2026-10-13');
  expect(day.get('Rosneft Terminal')?.licences).toMatchObject([
    { label: 'General Licence 8', validFrom: '2022-03-01', validTo: '2022-12-01' },
  ]);
  expect(day.get('Taiga Field')?.licences).toMatchObject([
    { label: 'General Licence 8', regime: 'ofac', validFrom: '2022-06-01' },
  ]);
  const lines = assetSanctions(RECORD, '2026-10-13').flatMap((one) =>
    one.assetLabel === 'Taiga Field' ? statusLines(one) : [],
  );
  expect(lines.join('\n')).toContain('51% (estimated by GEM)');
});

test('listed owners below half make no derived status', () => {
  const idle = byLabel(RECORD, '2026-10-13').get('Idle Field');
  expect(idle).toMatchObject({ status: 'none', heldPct: 0, holders: [] });
});

test('a designation that is not in force on the day gives no status', () => {
  expect(byLabel(RECORD, '2022-01-01').get('Rosneft Terminal')?.status).toBe('none');
  const ended: ReleaseRecord = {
    ...RECORD,
    relations: RECORD.relations.map((one) =>
      one.id === id(102) ? { ...one, valid_to: '2023-01-01' } : one,
    ),
  };
  expect(byLabel(ended, '2026-10-13').get('Rosneft Terminal')?.status).toBe('none');
});

test('a designation with no official file names no regime, and an ownership cycle ends', () => {
  const cyclic: ReleaseRecord = {
    ...RECORD,
    relations: [...RECORD.relations, relation(110, 'owns', FIELD, LISTED_OWNER)],
    claims: [...RECORD.claims, claim(id(110), 'share_pct', 100), claim(id(102), null, null, [])],
  };
  const day = byLabel(cyclic, '2026-10-13');
  expect(day.get('Rosneft Terminal')?.designations[0]?.regime).toBeNull();
  expect(day.get('Taiga Field')?.status).toBe('derived');
});
