// The checks of the v1 import that need no database. The fixture GeoPackage is invented and is
// written to a temporary folder by the test.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { expect, test } from 'vitest';

import { batchesOf, documentOf, linesOf, pointOf, readV1, spanOf } from './import-v1.ts';

const DISTRICT = '00000000-0000-4000-8000-000000000001';
const ARMY = '00000000-0000-4000-8000-000000000002';
const BRIGADE = '00000000-0000-4000-8000-000000000003';
const BATTALION = '00000000-0000-4000-8000-000000000004';
const DEPOT = '00000000-0000-4000-8000-000000000005';
const HOLDING = '00000000-0000-4000-8000-000000000006';

/** A GeoPackage point with no envelope, little endian. */
const gpkgPoint = (lon: number, lat: number): Uint8Array => {
  const bytes = new Uint8Array(8 + 21);
  bytes.set([0x47, 0x50, 0, 0x01, 0xe6, 0x10, 0, 0], 0);
  const view = new DataView(bytes.buffer, 8);
  view.setUint8(0, 1);
  view.setUint32(1, 1, true);
  view.setFloat64(5, lon, true);
  view.setFloat64(13, lat, true);
  return bytes;
};

const fixture = (): string => {
  const path = join(mkdtempSync(join(tmpdir(), 'v1-')), 'project.gpkg');
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE units (id TEXT, name TEXT, parent_id TEXT, type TEXT, echelon TEXT,
    affiliation TEXT, domain TEXT, military_unit_id TEXT, osm_relation_id TEXT, notes TEXT,
    sources TEXT);
    CREATE TABLE organisations (id TEXT, name TEXT, parent_id TEXT, type TEXT,
    osm_relation_id TEXT, notes TEXT, sources TEXT);
    CREATE TABLE geometries (geometry BLOB, id TEXT, layer_id TEXT, entity_id TEXT, type TEXT);`);
  const unit = db.prepare('INSERT INTO units VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  unit.run(
    DISTRICT,
    'West District',
    null,
    'command',
    'Region/Theater',
    'Hostile',
    null,
    null,
    null,
    null,
    'https://a.example/district',
  );
  unit.run(
    ARMY,
    '1st Army',
    DISTRICT,
    'armored',
    'Army',
    'Hostile',
    'Ground',
    '12345',
    '777',
    'HQ in\nthe city',
    'https://a.example/army\nhttps://b.example/army',
  );
  unit.run(
    BRIGADE,
    '2nd Brigade',
    ARMY,
    'infantry',
    'Brigade',
    'Hostile',
    'Ground',
    null,
    null,
    null,
    '',
  );
  unit.run(
    BATTALION,
    '1st Battalion',
    BRIGADE,
    'infantry',
    'Battalion/squadron',
    'Hostile',
    'Ground',
    null,
    null,
    null,
    null,
  );
  unit.run(
    DEPOT,
    'Depot',
    DISTRICT,
    'logistics',
    'Battalion/squadron',
    'Hostile',
    null,
    null,
    null,
    null,
    null,
  );
  db.prepare('INSERT INTO organisations VALUES (?,?,?,?,?,?,?)').run(
    HOLDING,
    'Holding JSC',
    null,
    'holding',
    null,
    null,
    'https://c.example/holding',
  );
  db.prepare('INSERT INTO geometries VALUES (?,?,?,?,?)').run(
    gpkgPoint(37.5, 55.25),
    'g1',
    'l1',
    ARMY,
    'point',
  );
  db.close();
  return path;
};

test('a GeoPackage point gives its longitude and its latitude', () => {
  expect(pointOf(gpkgPoint(37.5, 55.25))).toStrictEqual([37.5, 55.25]);
  expect(pointOf(new Uint8Array([1, 2, 3]))).toBeNull();
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
      'domain: Ground | military_unit_number: 12345 | osm_id: relation/777 | note: HQ in the city | ' +
      `parent: West District (v1 ${DISTRICT}) | position: 55.250000 N, 37.500000 E | sources: ` +
      'https://a.example/army https://b.example/army',
  );
  expect(
    documentOf(lines)
      .split('\n')
      .filter((line) => line.startsWith('v1 ')),
  ).toHaveLength(6);
});

test('a top element and its units with no sub-unit are one batch, and each tree under it is one', () => {
  const batches = batchesOf(linesOf(readV1(fixture())));
  const names = batches.map((batch) => [...new Set(batch.map((item) => item.line.element.name))]);
  expect(names).toStrictEqual([
    ['West District', 'Depot'],
    ['1st Army', '2nd Brigade', '1st Battalion'],
    ['Holding JSC'],
  ]);
  const army = batches[1] ?? [];
  expect(army.map((item) => item.request.op)).toStrictEqual([
    'create_entity',
    'create_relation',
    'create_entity',
    'create_relation',
    'create_entity',
    'create_relation',
  ]);
  expect(army[0]?.id).toBe(ARMY);
  expect(army[0]?.request).toMatchObject({
    type: 'military_unit',
    label: '1st Army',
    geom: { type: 'Point', coordinates: [37.5, 55.25] },
  });
  expect(army[1]?.request).toMatchObject({ type: 'subordinate_to', srcId: ARMY, dstId: DISTRICT });
});

test('a second plan names the same acts, so a second run writes nothing twice', () => {
  const ids = () =>
    batchesOf(linesOf(readV1(fixture())))
      .flat()
      .map((item) => item.id);
  expect(ids()).toStrictEqual(ids());
});

test('the span of a line counts code points', () => {
  expect(spanOf('é😀\nabc\n', 'abc')).toStrictEqual({ start: 3, end: 6 });
  expect(spanOf('abc abc', 'abc')).toBeNull();
});
