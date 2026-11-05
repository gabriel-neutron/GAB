// The Baltic AIS collector, offline: a web that answers from a table, a store in memory and a
// database that is a map of hashes. No test reaches the source.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { memoryStore } from '@gab/tools/fetch-fixture';
import { hashOf } from '@gab/tools/store-answer';
import type { WebAnswer } from '@gab/tools/tool';
import { hashDatabase, stubWeb, text, type Asked } from '@gab/tools/web-stub';
import { afterAll, expect, test } from 'vitest';

import { pull, report, type Line } from './ais-collector.ts';

const folder = mkdtempSync(join(tmpdir(), 'ais-collector-'));
afterAll(() => {
  rmSync(folder, { recursive: true, force: true });
});

// The spacing is the spacing of the source. A stored answer keeps it.
const VESSELS = '[ {\n  "imo" : 9505584,\n  "destination" : "RU ULU"\n} ]';
const LOCATIONS = '{\n  "type" : "FeatureCollection",\n  "features" : [ { "mmsi" : 1 } ]\n}';

const reachOf = (answer: (asked: Asked) => WebAnswer | Error) => ({
  store: memoryStore(),
  web: stubWeb(answer),
  now: () => new Date('2026-11-05T22:00:00Z'),
});

const answers = (asked: Asked) =>
  text(asked.url.pathname.endsWith('vessels') ? VESSELS : LOCATIONS);

const linesOf = (own: string) =>
  readFileSync(join(own, 'ais-checkpoint.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Line);

const pulled = async (name: string, answer: (asked: Asked) => WebAnswer | Error) => {
  const own = join(folder, name);
  const reach = reachOf(answer);
  const clean = await pull(hashDatabase(), reach, own);
  return { clean, lines: linesOf(own), reach };
};

test('a pull stores each answer byte for byte and asks with gzip', async () => {
  const { clean, lines, reach } = await pulled('stored', answers);
  expect(clean).toBe(true);
  expect(lines.map((line) => [line.endpoint, line.status, line.rows])).toEqual([
    ['vessels', 'stored', 1],
    ['locations', 'stored', 1],
  ]);
  expect(new TextDecoder().decode(reach.store.puts[0]?.bytes)).toBe(VESSELS);
  expect(lines[0]?.sha256).toBe(hashOf(new TextEncoder().encode(VESSELS)));
  expect(reach.web.asked[0]?.headers).toMatchObject({ 'accept-encoding': 'gzip' });
});

test('a failed answer logs its reason, stores nothing and the other answer goes on', async () => {
  const { clean, lines, reach } = await pulled('failed', (asked) =>
    asked.url.pathname.endsWith('vessels') ? text('down', 503) : text(LOCATIONS),
  );
  expect(clean).toBe(false);
  expect(lines[0]).toMatchObject({ status: 'failed', reason: 'Digitraffic Marine answered 503' });
  expect(lines[1]).toMatchObject({ status: 'stored' });
  expect(reach.store.puts).toHaveLength(1);
});

test.each([
  ['empty', '[]'],
  ['error', '{"error":"x","message":"y"}'],
])('an answer with no row (%s) is no snapshot', async (name, body) => {
  const { lines, reach } = await pulled(name, () => text(body));
  expect(lines[0]).toMatchObject({
    status: 'failed',
    reason: 'Digitraffic Marine gave an answer with no row',
  });
  expect(reach.store.puts).toHaveLength(0);
});

test('a fault of the database logs its code and not its text', async () => {
  const own = join(folder, 'database');
  const fault = Object.assign(new Error('postgres://user:secret@host'), { code: 'ECONNREFUSED' });
  await pull({ query: () => Promise.reject(fault) }, reachOf(answers), own);
  const file = readFileSync(join(own, 'ais-checkpoint.jsonl'), 'utf8');
  expect(file).toContain('ECONNREFUSED');
  expect(file).not.toContain('secret');
});

const NOW = new Date('2026-11-05T12:00:00Z');
const hoursBefore = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const line = (hours: number, status: Line['status'] = 'stored', reason?: string): Line[] =>
  (['vessels', 'locations'] as const).map((endpoint) => ({
    at: hoursBefore(hours),
    endpoint,
    status,
    ...(reason === undefined ? {} : { reason }),
  }));
const hourly = (from: number, to: number) =>
  Array.from({ length: from - to + 1 }, (_, index) => line(from - index)).flat();

test('hourly lines over the whole window are clean', () => {
  expect(report(hourly(48, 0), 48, NOW).clean).toBe(true);
});

test('one missed pull is inside two periods', () => {
  expect(report([...hourly(48, 11), ...hourly(9, 0)], 48, NOW).clean).toBe(true);
});

test('a time with no line has no reason, so the report is not clean', () => {
  const found = report([...hourly(48, 20), ...hourly(10, 0)], 48, NOW);
  expect(found.clean).toBe(false);
  expect(found.endpoints[0]?.noReason).toEqual([{ from: hoursBefore(20), to: hoursBefore(10) }]);
});

test('a window that the lines do not fill is not clean', () => {
  expect(report(hourly(10, 0), 48, NOW).clean).toBe(false);
  expect(report(hourly(48, 10), 48, NOW).clean).toBe(false);
});

test('failed pulls with a reason keep the report clean and name the gap', () => {
  const failed = [5, 4, 3, 2].flatMap((hours) => line(hours, 'failed', 'the server is down'));
  const found = report([...hourly(48, 6), ...failed, ...hourly(1, 0)], 48, NOW);
  expect(found.clean).toBe(true);
  expect(found.endpoints[0]?.failed).toBe(4);
  expect(found.endpoints[0]?.reasoned[0]).toMatchObject({
    from: hoursBefore(6),
    to: hoursBefore(1),
    reasons: Array<string>(4).fill('the server is down'),
  });
});

test('a gap is over two periods only past the grace', () => {
  const at = (minutes: number): Line[] =>
    line(0).map((own) => ({
      ...own,
      at: new Date(NOW.getTime() - minutes * 60_000).toISOString(),
    }));
  const around = (gap: number) => [...hourly(48, 3), ...at(180 - gap), ...hourly(0, 0)];
  expect(report(around(125), 48, NOW).endpoints[0]?.noReason).toEqual([]);
  expect(report(around(126), 48, NOW).endpoints[0]?.noReason).toHaveLength(1);
});

test('lines out of order do not hide a gap', () => {
  const lines = [...hourly(10, 0), ...hourly(48, 20)];
  expect(report(lines, 48, NOW).endpoints[0]?.noReason).toHaveLength(1);
});

test('a window of failed pulls alone is not clean', () => {
  const failed = Array.from({ length: 49 }, (_, hours) => line(hours, 'failed', 'down')).flat();
  expect(report(failed, 48, NOW).clean).toBe(false);
});
