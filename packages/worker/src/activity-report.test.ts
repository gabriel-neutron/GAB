import { expect, test } from 'vitest';

import {
  answerOf,
  buildActivityReport,
  flaresOf,
  operatorsOf,
  type Asset,
  type Detection,
} from './activity-report.ts';

const asset = (
  id: string,
  label: string,
  kind: string,
  latitude: number,
  longitude: number,
  operators: string[] = [],
): Asset => ({
  id,
  label,
  kind,
  latitude,
  longitude,
  operators: new Set(operators),
});

// Two fields share the name "Twin". A third asset is a refinery. A fourth is an LNG plant.
const assets = [
  asset('f1', 'Alpha Oil and Gas Field', 'field', 60, 70, ['c1']),
  asset('f2', 'Twin Oil and Gas Field', 'field', 61, 71, ['c2']),
  asset('f3', 'Twin North Oil and Gas Field', 'field', 62, 72, ['c3']),
  asset('r1', 'Ryazan refinery', 'refinery', 54.6, 39.7),
  asset('l1', 'Yamal LNG', 'lng_plant', 71.25, 72.05),
];

const NL = String.fromCharCode(13, 10);
const HEAD =
  'id,lat,lon,Country,BCM,MMSCFD,Year,Field type,Operator,Field name,Location,Flare Level,Flaring Vol (million m3)';
const flareRow = (
  id: string,
  lat: number,
  lon: number,
  year: number,
  bcm: number,
  type: string,
  operator: string,
  field: string,
): string =>
  `${id},${String(lat)},${String(lon)},Russia,${String(bcm)},0,${String(year)},${type},${operator},${field},ONSHORE,Small,0`;
const flares = flaresOf(
  [
    HEAD,
    flareRow('a', 60.001, 70.001, 2024, 0.5, 'OIL', 'Acme', 'Alpha'),
    flareRow('a', 60.001, 70.001, 2025, 0.4, 'OIL', 'Acme', 'Alpha'),
    flareRow('t', 61.5, 71.5, 2025, 0.3, 'OIL', 'Nobody', 'Twin'),
    flareRow('l', 71.25, 72.05, 2025, 1.2, 'LNG', 'Yamal', 'Yamal'),
  ].join('\r\n'),
);

const pixel = (
  day: string,
  latitude: number,
  longitude: number,
  over: Partial<Detection> = {},
): Detection => ({
  latitude,
  longitude,
  day,
  time: '0100',
  satellite: 'N',
  night: true,
  megawatts: 1,
  kelvin: 300,
  type: '0',
  ...over,
});
const answer = (detections: Detection[]) => ({
  box: [39.65, 54.55, 39.75, 54.65] as const,
  from: '2026-01-01',
  to: '2026-09-30',
  detections,
});
const flareBox = {
  box: [70, 60, 70.1, 60.1] as const,
  from: '2026-01-01',
  to: '2026-09-30',
  detections: [pixel('2026-02-03', 60.001, 70.001)],
};

const report = buildActivityReport({
  today: '2026-10-05',
  assets,
  flares,
  answers: [
    answer([
      pixel('2026-02-03', 54.6, 39.7), // activity
      pixel('2026-03-05', 54.6, 39.7), // inside the window after the strike
      pixel('2026-03-05', 54.6, 39.7, { time: '0300' }),
    ]),
    flareBox,
  ],
  strikes: [{ ref: 's', day: '2026-03-04', until: '2026-03-04', latitude: 54.6, longitude: 39.7 }],
  operators: operatorsOf(
    'name,status,gem_entity_id,record_candidate\nAcme,sure,E1,11111111-1111-1111-1111-111111111111 Acme',
  ),
});
const line = (label: string): string =>
  report.lines.find((one) => one.startsWith(`${label}\t`)) ?? '';

test('the report names its method, its thresholds and its date', () => {
  expect(report.lines[0]).toContain('2026-10-05');
  expect(report.lines.join('\n')).toMatch(/Method:.*\n.*Thresholds \(FIRMS calibration\)/u);
});

test('a refinery counts its activity night, and a strike night is kept apart', () => {
  expect(line('Ryazan refinery')).toContain('2026-02: 1');
  expect(line('Ryazan refinery')).toContain('2026-03: 0 (+1 strike)');
  expect(line('Ryazan refinery')).toContain('active');
});

test('a field takes the volume and the nights of its flares', () => {
  expect(line('Alpha Oil and Gas Field')).toContain('flaring');
  expect(line('Alpha Oil and Gas Field')).toContain('bcm 2024 0.5000, 2025 0.4000');
  expect(line('Alpha Oil and Gas Field')).toContain('2026-02: 1');
});

test('a flare that two fields can claim goes to review and joins no field', () => {
  expect(report.review).toHaveLength(1);
  expect(report.review[0]).toContain('Twin');
  expect(line('Twin Oil and Gas Field')).toContain('no flare matched');
});

test('an LNG plant takes the volume of its LNG flares and no FIRMS count', () => {
  expect(line('Yamal LNG')).toContain('bcm 2024 0.0000, 2025 1.2000');
  expect(line('Yamal LNG')).not.toContain('nights');
});

test('a month with no stored answer is unread, not zero', () => {
  expect(line('Ryazan refinery')).toContain('2026-01: 0');
  const none = buildActivityReport({
    today: '2026-10-05',
    assets: assets.filter((one) => one.kind === 'refinery'),
    flares: [],
    answers: [],
    strikes: [],
    operators: new Map(),
  });
  expect(none.lines.at(-1)).toContain('FIRMS unread');
});

test('only a sure operator row joins; the address of an answer gives its box and days', () => {
  expect([
    ...operatorsOf(
      'name,status,gem_entity_id,record_candidate\nA,probable,,11111111-1111-1111-1111-111111111111 A',
    ).keys(),
  ]).toEqual([]);
  const stored = answerOf(
    'https://firms.modaps.eosdis.nasa.gov/api/area/csv/1,2,3,4/2026-01-01/2026-01-31',
    'latitude,longitude,acq_date,acq_time,satellite,frp,daynight,bright_ti4,type\n2.5,1.5,2026-01-02,0100,N,5,N,330,0',
  );
  expect(stored?.box).toEqual([1, 2, 3, 4]);
  expect(stored?.detections).toHaveLength(1);
});

test('a month that two stored answers cover together is read', () => {
  const half = (from: string, to: string) => ({ ...answer([]), from, to });
  const split = buildActivityReport({
    today: '2026-02-20',
    assets: assets.filter((one) => one.kind === 'refinery'),
    flares: [],
    answers: [half('2026-01-01', '2026-01-15'), half('2026-01-16', '2026-02-19')],
    strikes: [],
    operators: new Map(),
  });
  expect(split.lines.at(-1)).toContain('2026-01: 0 2026-02: 0');
});

test('a sure operator narrows a flare to the field that the operator runs', () => {
  const company = '11111111-1111-1111-1111-111111111111';
  const two = [
    asset('g1', 'Beta Oil and Gas Field', 'field', 60, 70, [company]),
    asset('g2', 'Beta Oil and Gas Field', 'field', 60.01, 70.01, ['other']),
  ];
  const beta = flaresOf([HEAD, flareRow('b', 60, 70, 2025, 0.1, 'OIL', 'Acme', 'Beta')].join(NL));
  const run = (operators: Map<string, string>) =>
    buildActivityReport({
      today: '2026-10-05',
      assets: two,
      flares: beta,
      answers: [],
      strikes: [],
      operators,
    });
  expect(run(new Map()).review).toHaveLength(1);
  const narrowed = run(
    operatorsOf(`name,status,gem_entity_id,record_candidate${NL}Acme,sure,E1,${company} Acme`),
  );
  expect(narrowed.review).toHaveLength(0);
  expect(narrowed.lines.filter((one) => one.includes('	flaring	'))).toHaveLength(1);
});

test('a short flare name never matches inside a longer field name', () => {
  const far = [asset('h1', 'Alphabet Oil and Gas Field', 'field', 50, 40)];
  const result = buildActivityReport({
    today: '2026-10-05',
    assets: far,
    flares: flares.filter((one) => one.field === 'Alpha'),
    answers: [],
    strikes: [],
    operators: new Map(),
  });
  expect(result.lines.at(-1)).toContain('no flare matched');
});
