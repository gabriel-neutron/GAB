import { readCsv } from '@gab/tools/csv';
import { expect, test } from 'vitest';

import { criticalNodes } from './critical-nodes.ts';
import { CriticalNodesSheetFault, type SheetRow } from './critical-nodes-sheet.ts';
import type { NatoPair } from './nato-pair.ts';
import type {
  ReleaseClaim,
  ReleaseEntity,
  ReleaseRecord,
  ReleaseRelation,
} from './release-record.ts';

const LABEL = 'Validated manually by the operator, on 2026-10-08';
const ACT = '00000000-0000-4000-8000-0000000000ac';
const id = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const TERMINAL = id(1);
const TRADER = id(2);
const TANKER = id(3);
const PLAIN = id(4);
const LIST = id(10);
const CONTROLLED = id(11);

const entity = (key: string, type: string, label: string): ReleaseEntity => ({
  id: key,
  type,
  label,
  origin_label: LABEL,
  sources: ['doc_news'],
  geom: null,
});

const claim = (claimId: string, subject: string, attribute: string | null): ReleaseClaim => ({
  claim_id: claimId,
  subject_kind: attribute === null ? 'relation' : 'entity',
  subject_id: subject,
  attribute,
  value: null,
  origin_label: LABEL,
  sources: ['doc_news'],
  act_id: ACT,
  passages: [],
});

const designation = (n: number, from: string): ReleaseRelation => ({
  id: id(n),
  type: 'designated_by',
  src_id: from,
  dst_id: LIST,
  valid_from: null,
  valid_to: null,
  origin_label: LABEL,
  sources: ['doc_news'],
});

// The terminal and the trader each have a designation. A vessel that the trader controls has one,
// and it does not count for the trader.
const RELATIONS = [
  designation(20, TERMINAL),
  designation(21, TRADER),
  designation(22, CONTROLLED),
  { ...designation(23, TRADER), type: 'owns', dst_id: CONTROLLED },
];

const record = (natoPairs: ReadonlyMap<string, NatoPair> | null = null): ReleaseRecord => ({
  entities: [
    entity(TERMINAL, 'facility', 'Test terminal'),
    entity(TRADER, 'company', 'Test trader'),
    entity(TANKER, 'vessel', 'Test tanker'),
    entity(PLAIN, 'company', 'A plain company'),
    entity(LIST, 'legal_act', 'Test list'),
    entity(CONTROLLED, 'vessel', 'Controlled tanker'),
  ],
  relations: RELATIONS,
  claims: [
    ...RELATIONS.map((one) => claim(one.id, one.id, null)),
    claim(`${TERMINAL}/throughput`, TERMINAL, 'throughput'),
    claim(`${TANKER}/flag`, TANKER, 'flag'),
    claim(`${TANKER}/imo`, TANKER, 'imo'),
  ],
  merges: [],
  documents: new Map(),
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  disclaimer: 'The disclaimer.',
  natoPairs,
});

const row = (line: number, nodeId: string, more: Partial<SheetRow> = {}): SheetRow => ({
  line,
  nodeId,
  condition: null,
  claimIds: [],
  controller: '',
  bypassPattern: '',
  ...more,
});

const SHEET: readonly SheetRow[] = [
  row(2, TANKER, { condition: 'c', claimIds: [`${TANKER}/flag`, `${TANKER}/imo`] }),
  row(3, TANKER, { condition: 'b', controller: 'Test trader' }),
  row(4, TERMINAL, {
    condition: 'b',
    claimIds: [`${TERMINAL}/throughput`],
    bypassPattern: 'Loads at night',
  }),
  row(5, TRADER, { controller: 'A person of the test' }),
  row(6, TERMINAL, { controller: 'The state of the test' }),
  row(7, PLAIN),
];

const tableOf = (text: string): Record<string, string>[] => {
  const body = text
    .slice(1)
    .split('\r\n')
    .filter((line) => !line.startsWith('#'))
    .join('\r\n');
  const [header, ...rows] = readCsv(body).map((one) => one.fields);
  return rows.map((one) =>
    Object.fromEntries((header ?? []).map((name, at) => [name, one[at] ?? ''])),
  );
};

test('the table gives the three conditions of each node, and retains a node with two ticks', () => {
  const file = criticalNodes(record(), SHEET, 'The preamble.');
  expect(file.path).toBe('critical-nodes.csv');
  expect(file.text).toContain('# The preamble.');
  expect(file.text).toContain('# Candidate nodes: 4. Retained: 2.');
  expect(tableOf(file.text)).toStrictEqual([
    {
      node_id: TANKER,
      node_label: 'Test tanker',
      node_type: 'vessel',
      controller: 'Test trader',
      bypass_pattern: '',
      a_sanctions_exposure: 'no tick',
      a_claim_ids: '',
      b_production_or_throughput: 'not sourced',
      b_claim_ids: '',
      c_bypass_routing: 'sourced',
      c_claim_ids: `${TANKER}/flag ${TANKER}/imo`,
      ticks: '2',
      sourced_ticks: '1',
      retained: 'true',
    },
    {
      node_id: TERMINAL,
      node_label: 'Test terminal',
      node_type: 'facility',
      controller: 'The state of the test',
      bypass_pattern: 'Loads at night',
      a_sanctions_exposure: 'sourced',
      a_claim_ids: id(20),
      b_production_or_throughput: 'sourced',
      b_claim_ids: `${TERMINAL}/throughput`,
      c_bypass_routing: 'no tick',
      c_claim_ids: '',
      ticks: '2',
      sourced_ticks: '2',
      retained: 'true',
    },
    {
      node_id: PLAIN,
      node_label: 'A plain company',
      node_type: 'company',
      controller: '',
      bypass_pattern: '',
      a_sanctions_exposure: 'no tick',
      a_claim_ids: '',
      b_production_or_throughput: 'no tick',
      b_claim_ids: '',
      c_bypass_routing: 'no tick',
      c_claim_ids: '',
      ticks: '0',
      sourced_ticks: '0',
      retained: 'false',
    },
    {
      node_id: TRADER,
      node_label: 'Test trader',
      node_type: 'company',
      controller: 'A person of the test',
      bypass_pattern: '',
      // The designation of the controlled vessel does not count for the trader.
      a_sanctions_exposure: 'sourced',
      a_claim_ids: id(21),
      b_production_or_throughput: 'no tick',
      b_claim_ids: '',
      c_bypass_routing: 'no tick',
      c_claim_ids: '',
      ticks: '1',
      sourced_ticks: '1',
      retained: 'false',
    },
  ]);
  // S1: with the pair off, no column and no word of the pair.
  expect(file.text).not.toMatch(/nato|NATO|\b[A-F][1-6]\b/u);
});

test('with the pair on, each tick gives the pair of each of its claims', () => {
  const pairs = new Map<string, NatoPair>([
    [`${TANKER}/imo`, { letter: 'A', digit: 1 }],
    [id(20), { letter: 'B', digit: 2 }],
  ]);
  const rows = tableOf(criticalNodes(record(pairs), SHEET, '').text);
  expect(
    rows.map((one) => [one['a_nato_pairs'], one['b_nato_pairs'], one['c_nato_pairs']]),
  ).toStrictEqual([
    ['', '', 'none A1'],
    ['B2', 'none', ''],
    ['', '', ''],
    ['none', '', ''],
  ]);
});

test('with no sheet, the table has its header and no row', () => {
  const file = criticalNodes(record(), null, '');
  expect(tableOf(file.text)).toStrictEqual([]);
  expect(file.text).toContain('no sheet of candidate nodes');
  expect(file.text).toContain('node_id,node_label,node_type');
});

test.each([
  [
    row(4, TANKER, { condition: 'b', claimIds: ['00000000-0000-4000-8000-0000000000ff/x'] }),
    /Line 4: the claim .*\/x is not a public claim/u,
  ],
  [row(5, id(99)), /Line 5: the node .* is not a public entity/u],
])('a sheet that names what the release does not hold is refused', (bad, message) => {
  expect(() => criticalNodes(record(), [...SHEET, bad], '')).toThrow(CriticalNodesSheetFault);
  expect(() => criticalNodes(record(), [...SHEET, bad], '')).toThrow(message);
});

test('two different controllers of one node are refused', () => {
  const bad = row(9, TANKER, { condition: null, controller: 'Another one' });
  expect(() => criticalNodes(record(), [...SHEET, bad], '')).toThrow(
    /Line 9: the node .* has a different controller/u,
  );
});
