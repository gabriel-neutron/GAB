// The checks of the v1 import that need no database. The fixture GeoPackage is invented, has the
// column types of the real file, and is written to a temporary folder that each test removes.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, expect, test } from 'vitest';

import { batchesOf, documentOf, linesOf, pointOf, readV1, spanOf } from './import-v1.ts';

const DISTRICT = '00000000-0000-4000-8000-000000000001';
const ARMY = '00000000-0000-4000-8000-000000000002';
const BRIGADE = '00000000-0000-4000-8000-000000000003';
const BATTALION = '00000000-0000-4000-8000-000000000004';
const DEPOT = '00000000-0000-4000-8000-000000000005';
const HOLDING = '00000000-0000-4000-8000-000000000006';

const DOCUMENT = 'a'.repeat(64);

/** A GeoPackage point with no envelope: the header is big endian and the WKB little endian, as in
 * the real file. */
const gpkgPoint = (lon: number, lat: number, srs = 4326): Uint8Array => {
  const bytes = new Uint8Array(8 + 21);
  const view = new DataView(bytes.buffer);
  bytes.set([0x47, 0x50, 0, 0], 0);
  view.setInt32(4, srs, false);
  view.setUint8(8, 1);
  view.setUint32(9, 1, true);
  view.setFloat64(13, lon, true);
  view.setFloat64(21, lat, true);
  return bytes;
};

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const fixture = (): string => {
  const folder = mkdtempSync(join(tmpdir(), 'v1-'));
  folders.push(folder);
  const path = join(folder, 'project.gpkg');
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE units (id TEXT, name TEXT, layer_id TEXT, parent_id TEXT, type TEXT,
    echelon TEXT, affiliation TEXT, domain TEXT, military_unit_id TEXT, osm_relation_id INTEGER,
    notes TEXT, sources TEXT, position_mode TEXT, is_exact_position INTEGER);
    CREATE TABLE organisations (id TEXT, name TEXT, parent_id TEXT, type TEXT,
    osm_relation_id INTEGER, notes TEXT, sources TEXT, position_mode TEXT,
    is_exact_position INTEGER);
    CREATE TABLE geometries (geometry BLOB, id TEXT, layer_id TEXT, entity_id TEXT, type TEXT);`);
  const unit = db.prepare('INSERT INTO units VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const row = (...cells: (string | number | null)[]) => unit.run(...cells);
  row(
    DISTRICT,
    'West District',
    'l-region',
    null,
    'command',
    'Region/Theater',
    'Hostile',
    null,
    null,
    null,
    null,
    'https://a.example/district',
    'none',
    0,
  );
  row(
    ARMY,
    '1st Army',
    'l-army',
    DISTRICT,
    'armored',
    'Army',
    'Hostile',
    'Ground',
    '12345',
    777,
    'HQ in\nthe city',
    'https://a.example/army\nhttps://b.example/army',
    'own',
    1,
  );
  row(
    BRIGADE,
    '2nd Brigade',
    'l-brigade',
    ARMY,
    'infantry',
    'Brigade',
    'Hostile',
    'Ground',
    null,
    null,
    null,
    '',
    'parent',
    0,
  );
  row(
    BATTALION,
    '1st Battalion',
    'l-battalion',
    BRIGADE,
    'infantry',
    'Battalion/squadron',
    'Hostile',
    'Ground',
    null,
    null,
    null,
    null,
    'none',
    0,
  );
  row(
    DEPOT,
    'Depot',
    'l-battalion',
    DISTRICT,
    'logistics',
    'Battalion/squadron',
    'Hostile',
    null,
    null,
    null,
    null,
    null,
    'none',
    0,
  );
  db.prepare('INSERT INTO organisations VALUES (?,?,?,?,?,?,?,?,?)').run(
    HOLDING,
    'Holding JSC',
    null,
    'holding',
    null,
    null,
    'https://c.example/holding',
    'none',
    0,
  );
  const point = db.prepare('INSERT INTO geometries VALUES (?,?,?,?,?)');
  point.run(gpkgPoint(30, 50), 'g0', 'l-other', ARMY, 'point');
  point.run(gpkgPoint(37.5, 55.25), 'g1', 'l-army', ARMY, 'point');
  point.run(gpkgPoint(37.5, 55.25), 'g2', 'l-other', ARMY, 'point');
  db.close();
  return path;
};

test('a GeoPackage point in EPSG:4326 gives its longitude and its latitude', () => {
  expect(pointOf(gpkgPoint(37.5, 55.25))).toStrictEqual([37.5, 55.25]);
  expect(pointOf(gpkgPoint(37.5, 55.25, 3857))).toBeNull();
  expect(pointOf(new Uint8Array([1, 2, 3]))).toBeNull();
  const inside = new Uint8Array(64);
  inside.set(gpkgPoint(1, 2), 10);
  expect(pointOf(inside.subarray(10, 10 + 29))).toStrictEqual([1, 2]);
  expect(pointOf(inside.subarray(10, 10 + 20))).toBeNull();
});

test('a unit with no source has the sources of its nearest parent with sources', () => {
  const lines = linesOf(readV1(fixture()));
  const of = (id: string) => lines.find((line) => line.element.id === id);
  expect(of(BATTALION)?.sources).toStrictEqual([
    'https://a.example/army',
    'https://b.example/army',
  ]);
  expect(of(BATTALION)?.sourcesFrom?.id).toBe(ARMY);
  expect(of(DEPOT)?.sources).toStrictEqual(['https://a.example/district']);
  expect(of(ARMY)?.sourcesFrom).toBeNull();
  expect(of(BATTALION)?.text).toContain(`sources of 1st Army (v1 ${ARMY}): https://a.example/army`);
});

test('each line states the values of its act on one line', () => {
  const lines = linesOf(readV1(fixture()));
  const army = lines.find((line) => line.element.id === ARMY);
  expect(army?.text).toBe(
    `v1 unit ${ARMY} | 1st Army | branch: armored | echelon: Army | affiliation: Hostile | ` +
      'domain: Ground | military_unit_number: 12345 | osm_id: relation/777 | ' +
      'note: HQ in the city | position_precision: exact | ' +
      'other_positions: 50.000000 N, 30.000000 E | ' +
      `parent: West District (v1 ${DISTRICT}) | position: 55.250000 N, 37.500000 E | sources: ` +
      'https://a.example/army https://b.example/army',
  );
  expect(
    documentOf(lines)
      .split('\n')
      .filter((line) => line.startsWith('v1 ')),
  ).toHaveLength(6);
});

test('a unit placed at its parent has no point and an inherited position', () => {
  const brigade = linesOf(readV1(fixture())).find((line) => line.element.id === BRIGADE);
  expect(brigade?.element.point).toBeNull();
  expect(brigade?.text).toContain('position_precision: inherited');
});

test('a top element and its units with no sub-unit are one batch, and each tree under it is one', () => {
  const batches = batchesOf(linesOf(readV1(fixture())), DOCUMENT);
  const names = batches.map((batch) => [...new Set(batch.map((item) => item.line.element.name))]);
  expect(names).toStrictEqual([
    ['West District', 'Depot'],
    ['1st Army', '2nd Brigade', '1st Battalion'],
    ['Holding JSC'],
  ]);
  const [district = [], army = []] = batches;
  expect(army.map((item) => item.request.op)).toStrictEqual([
    'create_entity',
    'create_relation',
    'create_entity',
    'create_relation',
    'create_entity',
    'create_relation',
  ]);
  expect(army[0]?.request).toMatchObject({
    type: 'military_unit',
    label: '1st Army',
    geom: { type: 'Point', coordinates: [37.5, 55.25] },
    attrs: { v1_id: { v: ARMY }, osm_id: { v: 'relation/777' } },
  });
  expect(army[1]?.request).toMatchObject({
    type: 'subordinate_to',
    srcId: army[0]?.id,
    dstId: district[0]?.id,
  });
});

test('an element with the sources of a parent keeps that parent in an attribute', () => {
  const batches = batchesOf(linesOf(readV1(fixture())), DOCUMENT).flat();
  const entityOf = (id: string) =>
    batches.find((item) => item.line.element.id === id && item.request.op === 'create_entity');
  expect(entityOf(BATTALION)?.request).toMatchObject({
    attrs: { sources_from: { v: `1st Army (v1 ${ARMY})` } },
  });
  expect(entityOf(ARMY)?.request).not.toHaveProperty('attrs.sources_from');
});

test('the same document gives the same acts, and another document gives other acts', () => {
  const ids = (document: string) =>
    batchesOf(linesOf(readV1(fixture())), document)
      .flat()
      .map((item) => item.id);
  expect(ids(DOCUMENT)).toStrictEqual(ids(DOCUMENT));
  expect(ids('b'.repeat(64)).some((id) => ids(DOCUMENT).includes(id))).toBe(false);
});

test('the span of a line counts code points', () => {
  expect(spanOf('é😀\nabc\n', 'abc')).toStrictEqual({ start: 3, end: 6 });
  expect(spanOf('abc abc', 'abc')).toBeNull();
});
