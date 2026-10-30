import { expect, test } from 'vitest';

import type { ReleaseClaim, ReleaseRecord, ReleaseRelation } from './release-record.ts';
import {
  comparisonLines,
  DataFault,
  idsOfImo,
  portCallsOf,
  regionOf,
  tankerPeriods,
  tankerSet,
  type PortCall,
  type Tanker,
} from './tanker-port-calls.ts';

const ACT = '00000000-0000-4000-8000-000000000004';
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const claim = (subject: string, attribute: string, value: unknown): ReleaseClaim => ({
  claim_id: `${subject}/${attribute}`,
  subject_kind: 'entity',
  subject_id: subject,
  attribute,
  value,
  origin_label: 'x',
  sources: [],
  act_id: ACT,
  passages: [],
});

const designated = (n: number, vessel: string, from: string | null): ReleaseRelation => ({
  id: uuid(n),
  type: 'designated_by',
  src_id: vessel,
  dst_id: uuid(999),
  valid_from: from,
  valid_to: null,
  origin_label: 'x',
  sources: [],
});

const record = (claims: ReleaseClaim[], relations: ReleaseRelation[]): ReleaseRecord =>
  ({ claims, relations }) as unknown as ReleaseRecord;

test('the tanker set keeps the rule types, the first dated designation and one row for each IMO', () => {
  const [a, b, c, d, e, f] = [1, 2, 3, 4, 5, 6].map(uuid) as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const set = tankerSet(
    record(
      [
        claim(a, 'vessel_type', 'Oil Tanker'),
        claim(a, 'imo', '9000001'),
        claim(b, 'vessel_type', 'Chemical Tanker'),
        claim(b, 'imo', '9000002'),
        claim(c, 'vessel_type', 'LNG Tanker'),
        claim(c, 'imo', '9000003'),
        claim(d, 'vessel_type', 'Shuttle Tanker'),
        claim(d, 'imo', '9000004'),
        // The same IMO number as a: the earlier J0 stays.
        claim(e, 'vessel_type', 'Crude Oil Tanker'),
        claim(e, 'imo', '9000001'),
        // No dated designation.
        claim(f, 'vessel_type', 'Crude Oil Tanker'),
        claim(f, 'imo', '9000006'),
      ],
      [
        designated(1, a, '2023-05-01'),
        designated(2, a, '2022-03-01'),
        designated(3, b, '2022-03-01'),
        designated(4, c, '2022-03-01'),
        designated(5, d, '2024-01-10'),
        designated(6, e, '2021-01-01'),
        designated(7, f, null),
      ],
    ),
  );
  expect(set).toEqual([
    { imo: '9000001', j0: '2021-01-01' },
    { imo: '9000004', j0: '2024-01-10' },
  ]);
});

test('the region comes from the country of the anchorage', () => {
  expect(['FRA', 'RUS', 'CHN', 'TUR', 'IND', 'EGY'].map(regionOf)).toEqual([
    'EU',
    'Russia',
    'China',
    'Turkey',
    'India',
    'other',
  ]);
});

test('the mapping file gives the vessel ids of each IMO number and refuses a wrong line', () => {
  expect(idsOfImo('imo,vessel_id\n9000001,a\n9000001,b\n9000002,c\n')).toEqual(
    new Map([
      ['9000001', ['a', 'b']],
      ['9000002', ['c']],
    ]),
  );
  expect(() => idsOfImo('imo;id\n')).toThrow(DataFault);
  expect(() => idsOfImo('imo,vessel_id\n12,a\n')).toThrow(DataFault);
  expect(() => idsOfImo('imo,vessel_id\n9000001,a\n9000002,a\n')).toThrow(DataFault);
});

test('a stored answer gives its port visits and refuses a port visit with no country', () => {
  const entry = (flag: string | null) => ({
    id: 'e1',
    type: 'port_visit',
    start: '2025-01-02T10:00:00.000Z',
    vessel: { id: 'v1' },
    port_visit: { startAnchorage: { id: 'rus-x', flag } },
  });
  const text = (flag: string | null) =>
    JSON.stringify({
      metadata: { vessels: ['v1'] },
      entries: [entry(flag), { id: 'e2', type: 'gap', start: '2025-01-03T00:00:00Z' }],
    });
  expect(portCallsOf(text('RUS'), 'doc_1')).toEqual({
    vessels: ['v1'],
    calls: [{ eventId: 'e1', vesselId: 'v1', day: '2025-01-02', country: 'RUS' }],
  });
  expect(() => portCallsOf(text(null), 'doc_1')).toThrow(DataFault);
  expect(() => portCallsOf('not json', 'doc_1')).toThrow(DataFault);
});

const J0 = '2025-01-01';
const tankers: readonly Tanker[] = [
  { imo: '9000001', j0: J0 },
  { imo: '9000002', j0: J0 },
  // J0 late: its period +16 ends after the end of the data.
  { imo: '9000003', j0: '2025-12-01' },
];
const ids = new Map([
  ['9000001', ['a']],
  ['9000002', ['b']],
]);
const call = (eventId: string, vesselId: string, day: string, country: string): PortCall => ({
  eventId,
  vesselId,
  day,
  country,
});

test('the periods count a vessel only when the whole period ends by the end of the data', () => {
  const periods = tankerPeriods(
    tankers,
    ids,
    [
      call('1', 'a', '2024-12-31', 'RUS'), // period -1
      call('2', 'a', '2025-01-01', 'RUS'), // period 0
      call('3', 'a', '2025-01-15', 'RUS'), // period 0, same pair
      call('4', 'a', '2025-01-20', 'FRA'), // period 0, a second pair
      call('5', 'b', '2025-01-30', 'CHN'), // period 0 (day 29)
      call('6', 'b', '2025-01-31', 'CHN'), // period 1
      call('4', 'b', '2025-01-02', 'IND'), // a repeated event id is read once
      call('7', 'unknown', '2025-01-02', 'IND'), // a vessel outside the set
    ],
    '2026-10-26',
  );
  const at = (m: number) => periods.find((one) => one.m === m);
  expect(periods).toHaveLength(23);
  expect(at(-1)).toMatchObject({ counted: 3, seen: 1, pairTotal: 1 });
  expect(at(0)).toMatchObject({ counted: 3, seen: 2, pairTotal: 3 });
  expect(at(0)?.pairs).toMatchObject({ Russia: 1, EU: 1, China: 1, India: 0, other: 0 });
  expect(at(1)).toMatchObject({ counted: 3, seen: 1 });
  // 2025-12-01 + 30 * 11 + 29 days is after 2026-10-26, so period +11 drops the third tanker.
  expect(at(10)?.counted).toBe(3);
  expect(at(11)?.counted).toBe(2);
  // The two first tankers end the data inside period +20, so period +16 holds both.
  expect(at(16)?.counted).toBe(2);
});

test('the comparison puts the previous values next to the new ones', () => {
  const lines = comparisonLines(tankerPeriods(tankers, ids, [call('1', 'a', '2025-01-01', 'RUS')]));
  expect(lines[0]).toContain('previous');
  expect(lines).toContain('A\t0\t27.7\t33.3');
  expect(lines).toContain('B Russia\t+6\t53.2\t');
});
