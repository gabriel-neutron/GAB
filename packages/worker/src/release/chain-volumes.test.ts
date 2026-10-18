import { expect, test } from 'vitest';

import { chainVolumes } from './chain-volumes.ts';
import type {
  ReleaseDocument,
  ReleaseEntity,
  ReleaseRecord,
  ReleaseRelation,
} from './release-record.ts';
import { readReleaseTable } from './release-table.ts';
import { readVolumeTable } from './volume-table.ts';

// A small record and a small volume table made for the test. The assets, the figures and the
// documents are not data of the research.
const LABEL = 'Validated manually by the operator, on 2026-10-08';
const id = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const FIELD = id(1);
const PIPE = id(2);
const PORT = id(3);
const ABSORBED = id(4);
const TWIN = id(5);
const OTHER_TWIN = id(6);
const CRUDE_LINK = id(11);
const PRODUCTS_LINK = id(12);

const PROPOSED = 'Proposed — not checked';

const relation = (
  key: string,
  type: string,
  from: string,
  to: string,
  label = LABEL,
): ReleaseRelation => ({
  id: key,
  type,
  src_id: from,
  dst_id: to,
  valid_from: null,
  valid_to: null,
  origin_label: label,
  sources: ['doc_link'],
});

const entity = (key: string, label: string): ReleaseEntity => ({
  id: key,
  type: 'facility',
  label,
  origin_label: LABEL,
  sources: [],
  geom: null,
});

const document = (key: string, title: string): ReleaseDocument => ({
  id: key,
  title,
  uri: `https://test.example.org/${key}`,
  retrieved_at: '2026-10-01',
  licence: null,
  provider: null,
});

const RECORD: ReleaseRecord = {
  entities: [
    entity(FIELD, 'Test field'),
    entity(PIPE, 'Test pipe'),
    entity(PORT, 'Test port'),
    entity(TWIN, 'Test twin'),
    entity(OTHER_TWIN, 'Test  Twin'),
  ],
  relations: [
    relation(CRUDE_LINK, 'crude_flows_to', FIELD, PIPE),
    relation(PRODUCTS_LINK, 'products_flow_to', PIPE, PORT),
    relation(id(13), 'owns', FIELD, PORT),
  ],
  claims: [],
  merges: [
    {
      act_id: id(20),
      action: 'merge',
      day: '2026-10-02',
      absorbed_id: ABSORBED,
      survivor_id: PIPE,
      resolves_to: PIPE,
      origin_label: LABEL,
    },
  ],
  documents: new Map([
    ['doc_flow', document('doc_flow', 'A test flow report')],
    ['doc_capacity', document('doc_capacity', 'A test capacity page')],
  ]),
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  disclaimer: 'The disclaimer.',
  natoPairs: null,
};

const TABLE = readVolumeTable(
  [
    'actif_amont,actif_aval,produit,periode,valeur,minimum,maximum,unite,classe,document,page,note',
    `${FIELD},${PIPE},brut,2026-07,120,,,kb/j,observé,doc_flow,2,`,
    `${FIELD},${ABSORBED},brut,2026-07,300,,,kb/j,capacité,doc_capacity,1,`,
    `${PIPE},${PORT},produits,2026-07,40,30,50,kt/mois,estimé,doc_flow,4,a test note`,
    `${PIPE},${PORT},brut,2026-07,10,,,kb/j,observé,doc_flow,5,`,
    `Test segment A,Test segment B,brut,2026-07,600,,,kb/j,capacité,doc_capacity,,`,
    `${FIELD},${PIPE},brut,2026-07,99,,,kb/j,observé,doc_hidden,,`,
    `${FIELD},${PIPE},brut,2026-07,99,,,kb/j,,doc_flow,,`,
  ].join('\r\n'),
);

const rowsOf = (text: string): Record<string, string>[] => {
  const read = readReleaseTable(text);
  return read.rows.map((row) =>
    Object.fromEntries(read.header.map((name, at) => [name, row[at] ?? ''])),
  );
};

test('joins each row to the physical link of its two assets and its product', () => {
  const { file } = chainVolumes(RECORD, TABLE, 'A test preamble.');
  expect(file.path).toBe('volumes.csv');
  const rows = rowsOf(file.text);
  expect(rows.map((one) => [one['relation_id'], one['class'], one['value'], one['unit']])).toEqual([
    [CRUDE_LINK, 'observed', '120', 'kb/j'],
    [CRUDE_LINK, 'capacity', '300', 'kb/j'],
    [PRODUCTS_LINK, 'estimated', '40', 'kt/mois'],
    ['', 'observed', '10', 'kb/j'],
    ['', 'capacity', '600', 'kb/j'],
  ]);
  expect(rows[2]).toMatchObject({
    upstream: PIPE,
    downstream: PORT,
    product: 'products',
    period: '2026-07',
    minimum: '30',
    maximum: '50',
    document_id: 'doc_flow',
    document_title: 'A test flow report',
    document_address: 'https://test.example.org/doc_flow',
    page: '4',
    note: 'a test note',
  });
});

test('never adds a capacity to a flow: each row keeps its own value', () => {
  const rows = rowsOf(chainVolumes(RECORD, TABLE, '').file.text);
  const ofCrude = rows.filter((one) => one['relation_id'] === CRUDE_LINK);
  expect(ofCrude.map((one) => one['value'])).toEqual(['120', '300']);
});

test('rejects a row whose document is not a public document of the release, with the earlier rejections', () => {
  const { rejected } = chainVolumes(RECORD, TABLE, '');
  expect(rejected.map((one) => one.line)).toEqual([7, 8]);
  expect(rejected[0]?.why).toMatch(/doc_hidden/u);
  expect(rejected[1]?.why).toMatch(/class/u);
});

test('writes a file with no row when the release has no volume table', () => {
  const { file, rejected } = chainVolumes(RECORD, null, '');
  expect(rowsOf(file.text)).toEqual([]);
  expect(rejected).toEqual([]);
  expect(file.text).toMatch(/no volume table/u);
});

test('joins a row to the accepted link when a proposed link has the same two assets and product', () => {
  const record: ReleaseRecord = {
    ...RECORD,
    // The proposed link comes first in the order of the identifiers.
    relations: [relation(id(10), 'crude_flows_to', FIELD, PIPE, PROPOSED), ...RECORD.relations],
  };
  const rows = rowsOf(chainVolumes(record, TABLE, '').file.text);
  expect(rows[0]?.['relation_id']).toBe(CRUDE_LINK);
});

test('joins a row to the proposed link when no accepted link has its two assets and product', () => {
  const record: ReleaseRecord = {
    ...RECORD,
    relations: [relation(id(10), 'crude_flows_to', FIELD, PIPE, PROPOSED)],
  };
  const rows = rowsOf(chainVolumes(record, TABLE, '').file.text);
  expect(rows[0]?.['relation_id']).toBe(id(10));
});

test('names an asset by the exact label of one entity of the record, in any case and spacing', () => {
  const table = readVolumeTable(
    [
      'actif_amont,actif_aval,produit,periode,valeur,minimum,maximum,unite,classe,document,page,note',
      'TEST  Field,test pipe,brut,2026-07,120,,,kb/j,observé,doc_flow,2,',
      'Test field,Test twin,brut,2026-07,80,,,kb/j,observé,doc_flow,3,',
    ].join('\r\n'),
  );
  const { file, unjoined } = chainVolumes(RECORD, table, '');
  const rows = rowsOf(file.text);
  expect(rows.map((one) => [one['relation_id'], one['upstream'], one['downstream']])).toEqual([
    [CRUDE_LINK, FIELD, PIPE],
    // Two entities have the label "test twin": the row keeps the name and joins no link.
    ['', FIELD, 'Test twin'],
  ]);
  expect(unjoined.map((one) => one.line)).toEqual([3]);
  expect(unjoined[0]?.why).toMatch(/2 entities of the record have the label "Test twin"/u);
});

test('joins a gas row to the gas link of its two assets', () => {
  const gas = { ...RECORD, relations: [relation(id(14), 'gas_flows_to', FIELD, PIPE)] };
  const table = readVolumeTable(
    [
      'actif_amont,actif_aval,produit,periode,valeur,minimum,maximum,unite,classe,document,page,note',
      `${FIELD},${PIPE},gaz,2026-07,900,,,GWh/mois,observé,doc_flow,8,`,
    ].join('\r\n'),
  );
  const [row] = rowsOf(chainVolumes(gas, table, 'A test preamble.').file.text);
  expect(row).toMatchObject({ relation_id: id(14), product: 'gas' });
});
