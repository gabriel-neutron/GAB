// Imports the military units and the organisations of the v1 GeoPackage (#13):
//
//   pnpm import:v1 <project.gpkg> --retrieved-at <YYYY-MM-DD> [--dry-run]
//
// TEMPORARY. Delete this file, its test and its script after the import.
//
// The run writes one text document with one line for each unit and organisation, and stores it
// as gabriel_app. Then it proposes, as gabriel_research, one linked batch for each top formation:
// each element, its point and its link to its parent. Each act cites its own line, so the
// operator reads the line on the review card and promotes or rejects the batch as one unit.
//
// A unit with no source has the sources of its nearest parent with sources (decision of the
// operator, 7 October 2026). The GeoPackage is private: the run reads it from the path that it is
// given and copies nothing into the repository.

import { createHash } from 'node:crypto';
import { argv } from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { machineAct } from '@gab/proposal/machine';
import { writeRequest, type WriteRequest } from '@gab/proposal/request';
import { openStore, putObject } from '@gab/store';
import { checkedDay, storeBytes } from '@gab/worker/ingest';
import { Pool } from 'pg';

import { connectionString } from './db-runtime.ts';

const ORIGINATOR = 'GAB v1 ORBAT (operator)';
const TITLE = 'GAB v1 ORBAT: military units and organisations of the v1 GeoPackage';
const FILE_NAME = 'gab-v1-orbat.txt';

/** One element of the v1 work: a unit or an organisation. */
export interface V1Element {
  readonly id: string;
  readonly kind: 'unit' | 'organisation';
  readonly name: string;
  readonly parentId: string | null;
  readonly fields: readonly (readonly [key: string, value: string])[];
  readonly ownSources: readonly string[];
  readonly point: readonly [lon: number, lat: number] | null;
}

/** An element with its resolved sources and the line that states it. */
export interface V1Line {
  readonly element: V1Element;
  readonly sources: readonly string[];
  readonly sourcesFrom: V1Element | null;
  readonly text: string;
}

// ------------------------------------------------------------------------------ the read -------

const oneLine = (text: string): string => text.replace(/\s+/gu, ' ').trim();

const urlsOf = (cell: unknown): string[] =>
  typeof cell === 'string' ? cell.split(/\s+/u).filter((part) => part !== '') : [];

// External constraint: a GeoPackage geometry is a header of eight bytes, an envelope that bits 1
// to 3 of the flags size, then the WKB. The v1 file holds points only, in EPSG:4326 (x = lon).
const ENVELOPE_BYTES = [0, 32, 48, 48, 64] as const;

/** The longitude and latitude of a GeoPackage point, or null for any other blob. */
export const pointOf = (blob: Uint8Array): readonly [number, number] | null => {
  if (blob.length < 8 || blob[0] !== 0x47 || blob[1] !== 0x50) return null;
  const flags = blob[3] ?? 0;
  const envelope = ENVELOPE_BYTES[(flags >> 1) & 0b111];
  if (envelope === undefined) return null;
  const view = new DataView(blob.buffer, blob.byteOffset + 8 + envelope);
  if (view.byteLength < 21) return null;
  const little = view.getUint8(0) === 1;
  if (view.getUint32(1, little) !== 1) return null;
  const lon = view.getFloat64(5, little);
  const lat = view.getFloat64(13, little);
  if (!(Math.abs(lon) <= 180 && Math.abs(lat) <= 90)) return null;
  return [lon, lat];
};

const text = (value: unknown): string => (typeof value === 'string' ? oneLine(value) : '');

/** The units and the organisations of a v1 GeoPackage, in the order of the file. */
export const readV1 = (path: string): readonly V1Element[] => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const points = new Map<string, readonly [number, number]>();
    for (const row of db.prepare('SELECT entity_id, geometry FROM geometries').all()) {
      const point = row['geometry'] instanceof Uint8Array ? pointOf(row['geometry']) : null;
      if (point !== null && typeof row['entity_id'] === 'string')
        points.set(row['entity_id'], point);
    }
    const units = db
      .prepare(
        `SELECT id, name, parent_id, type, echelon, affiliation, domain, military_unit_id,
                osm_relation_id, notes, sources FROM units ORDER BY rowid`,
      )
      .all()
      .map((row): V1Element => {
        const id = String(row['id']);
        return {
          id,
          kind: 'unit',
          name: text(row['name']),
          parentId: typeof row['parent_id'] === 'string' ? row['parent_id'] : null,
          fields: [
            ['branch', text(row['type'])],
            ['echelon', text(row['echelon'])],
            ['affiliation', text(row['affiliation'])],
            ['domain', text(row['domain'])],
            ['military_unit_number', text(row['military_unit_id'])],
            [
              'osm_id',
              text(row['osm_relation_id']) === '' ? '' : `relation/${text(row['osm_relation_id'])}`,
            ],
            ['note', text(row['notes'])],
          ],
          ownSources: urlsOf(row['sources']),
          point: points.get(id) ?? null,
        };
      });
    const organisations = db
      .prepare(
        'SELECT id, name, parent_id, type, osm_relation_id, notes, sources FROM organisations ORDER BY rowid',
      )
      .all()
      .map((row): V1Element => {
        const id = String(row['id']);
        return {
          id,
          kind: 'organisation',
          name: text(row['name']),
          parentId: typeof row['parent_id'] === 'string' ? row['parent_id'] : null,
          fields: [
            ['organisation_kind', text(row['type'])],
            [
              'osm_id',
              text(row['osm_relation_id']) === '' ? '' : `relation/${text(row['osm_relation_id'])}`,
            ],
            ['note', text(row['notes'])],
          ],
          ownSources: urlsOf(row['sources']),
          point: points.get(id) ?? null,
        };
      });
    return [...units, ...organisations];
  } finally {
    db.close();
  }
};

// ------------------------------------------------------------------------------ the lines ------

const placeOf = (point: readonly [number, number]): string =>
  `${point[1].toFixed(6)} N, ${point[0].toFixed(6)} E`;

/** The elements in tree order, each with its sources and its line. A unit with no source takes
 * the sources of its nearest parent with sources. It throws on an element with no source after
 * that, and on a parent that is not in the file. */
export const linesOf = (elements: readonly V1Element[]): readonly V1Line[] => {
  const byId = new Map(elements.map((one) => [one.id, one] as const));
  const children = new Map<string | null, V1Element[]>();
  for (const one of elements) {
    if (one.parentId !== null && !byId.has(one.parentId))
      throw new Error(`v1 ${one.id} names a parent ${one.parentId} that is not in the file`);
    children.set(one.parentId, [...(children.get(one.parentId) ?? []), one]);
  }
  const lines: V1Line[] = [];
  const visit = (one: V1Element, inherited: V1Element | null, depth: number): void => {
    if (depth > elements.length) throw new Error(`v1 ${one.id} is in a loop of parents`);
    const holder = one.ownSources.length > 0 ? one : inherited;
    if (holder === null) throw new Error(`v1 ${one.id} (${one.name}) has no source and no parent`);
    const parent = one.parentId === null ? null : byId.get(one.parentId);
    const parts = [
      `v1 ${one.kind} ${one.id}`,
      one.name,
      ...one.fields.filter(([, value]) => value !== '').map(([key, value]) => `${key}: ${value}`),
      ...(parent === undefined || parent === null
        ? []
        : [`parent: ${parent.name} (v1 ${parent.id})`]),
      ...(one.point === null ? [] : [`position: ${placeOf(one.point)}`]),
      holder === one ? 'sources:' : `sources of ${holder.name} (v1 ${holder.id}):`,
    ];
    lines.push({
      element: one,
      sources: holder.ownSources,
      sourcesFrom: holder === one ? null : holder,
      text: `${parts.join(' | ')} ${holder.ownSources.join(' ')}`,
    });
    for (const child of children.get(one.id) ?? []) visit(child, holder, depth + 1);
  };
  for (const root of children.get(null) ?? []) visit(root, null, 0);
  if (lines.length !== elements.length) throw new Error('an element of the file is in a loop');
  return lines;
};

/** The bytes of the document: a header, then one line for each element. */
export const documentOf = (lines: readonly V1Line[]): string =>
  [
    'GAB v1 ORBAT, from the GeoPackage of the v1 work (project.gpkg, 4 October 2026).',
    'One line for each military unit and organisation. A unit with no source of its own has the',
    'sources of its nearest parent with sources (decision of the operator, 7 October 2026).',
    '',
    ...lines.map((line) => line.text),
    '',
  ].join('\n');

// ------------------------------------------------------------------------------ the batches ----

/** One act of a batch, with its minted identifier and the line that it cites. */
export interface PlannedItem {
  readonly id: string;
  readonly request: WriteRequest;
  readonly line: V1Line;
}

const attrsOf = (line: V1Line): Record<string, { v: string | string[] }> => ({
  v1_id: { v: line.element.id },
  ...Object.fromEntries(
    line.element.fields
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, { v: value }]),
  ),
  source_urls: { v: [...line.sources] },
});

// A v1 identifier is a uuid, unique in the file, so the new entity keeps it, and the link of an
// element gets a uuid made from it. A second run then names the same acts, and the door returns
// the acts that wait in place of new ones.
const linkIdOf = (element: string): string => {
  const hex = createHash('sha256').update(`v1 subordinate_to ${element}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

/** One batch for each top element with its units that have no sub-unit, and one for each tree
 * under it (an army, a division or a holding): each element, then its link to its parent. A link to the top element
 * names an act of another batch, so the operator promotes the batch of the top element first. */
export const batchesOf = (lines: readonly V1Line[]): readonly (readonly PlannedItem[])[] => {
  const tops = new Set(
    lines.filter((line) => line.element.parentId === null).map((line) => line.element.id),
  );
  const parents = new Set(lines.map((line) => line.element.parentId));
  const batches: PlannedItem[][] = [];
  for (const line of lines) {
    const { element } = line;
    const opensTree = tops.has(element.parentId ?? '') && parents.has(element.id);
    if (element.parentId === null || opensTree) batches.push([]);
    // A unit with no sub-unit under a top element joins the batch of that top element, which
    // stays before the batches of the trees under it.
    const batch =
      tops.has(element.parentId ?? '') && !opensTree
        ? batches.findLast((one) => one[0]?.line.element.id === element.parentId)
        : batches.at(-1);
    if (batch === undefined) throw new Error('the lines are not in tree order');
    batch.push({
      id: element.id,
      line,
      request: writeRequest.parse({
        op: 'create_entity',
        type: element.kind === 'unit' ? 'military_unit' : 'company',
        label: element.name,
        ...(element.point === null
          ? {}
          : { geom: { type: 'Point', coordinates: [...element.point] } }),
        attrs: attrsOf(line),
      }),
    });
    if (element.parentId !== null)
      batch.push({
        id: linkIdOf(element.id),
        line,
        request: writeRequest.parse({
          op: 'create_relation',
          type: 'subordinate_to',
          srcId: element.id,
          dstId: element.parentId,
        }),
      });
  }
  return batches;
};

/** The span of a line in the stored page, in code points, as the citation keeps it. */
export const spanOf = (page: string, line: string): { start: number; end: number } | null => {
  const at = page.indexOf(line);
  if (at === -1 || page.includes(line, at + 1)) return null;
  const start = Array.from(page.slice(0, at)).length;
  return { start, end: start + Array.from(line).length };
};

/** The items of the door for one batch. */
export const doorItems = (
  batch: readonly PlannedItem[],
  document: string,
  page: { readonly extractor: string; readonly number: number; readonly text: string },
): unknown[] =>
  batch.map(({ id, request, line }) => {
    const span = spanOf(page.text, line.text);
    if (span === null)
      throw new Error(`the stored page does not hold the line of v1 ${line.element.id} once`);
    const act = machineAct(request, [document]);
    return {
      id,
      op: act.op,
      payload: act.payload,
      src: act.src,
      target_kind: act.targetKind,
      target_id: act.targetId,
      names: act.names,
      dissent: false,
      dissent_reason: null,
      model_call_id: null,
      originator: ORIGINATOR,
      modality: 'asserts',
      citations: [{ document, text_extractor: page.extractor, page: page.number, ...span }],
    };
  });

// ------------------------------------------------------------------------------ the command ----

const USAGE = 'Usage: pnpm import:v1 <project.gpkg> --retrieved-at <YYYY-MM-DD> [--dry-run]';

const PAGE = `SELECT t.extractor, t.page, t.text FROM public.document_text t
  WHERE t.document_id = $1 AND t.extractor = public.newest_text_extractor($1) ORDER BY t.page`;

const BATCH =
  'SELECT count(*) FILTER (WHERE written)::int AS written FROM public.propose_batch($1::jsonb)';

const PROMOTED = `SELECT count(*)::int AS held FROM api.entity WHERE attrs ? 'v1_id'`;

const main = async (): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: argv.slice(2),
    allowPositionals: true,
    strict: true,
    options: { 'retrieved-at': { type: 'string' }, 'dry-run': { type: 'boolean' } },
  });
  const [path] = positionals;
  if (path === undefined || positionals.length !== 1) {
    console.error(USAGE);
    return 2;
  }
  const retrievedAt = checkedDay(values['retrieved-at']);
  const lines = linesOf(readV1(path));
  const batches = batchesOf(lines);
  const inherited = lines.filter((line) => line.sourcesFrom !== null).length;
  console.log(
    `${lines.length} elements (${inherited} with inherited sources), ${batches.length} batches, ` +
      `${batches.reduce((sum, batch) => sum + batch.length, 0)} acts`,
  );
  for (const batch of batches)
    console.log(`  ${batch[0]?.line.element.name ?? ''}: ${batch.length} acts`);
  if (values['dry-run'] === true) return 0;

  const app = new Pool({ connectionString: connectionString('app') });
  const research = new Pool({ connectionString: connectionString('research') });
  try {
    const held = await research.query<{ held: number }>(PROMOTED);
    if ((held.rows[0]?.held ?? 0) > 0) {
      console.error(
        'The record already holds v1 elements. The import runs once, before any promotion.',
      );
      return 1;
    }
    const raw = openStore();
    const session = await app.connect();
    let stored;
    try {
      stored = await storeBytes({ put: (object) => putObject(raw, object) }, session, {
        bytes: new TextEncoder().encode(documentOf(lines)),
        fileName: FILE_NAME,
        title: TITLE,
        kind: 'file',
        retrievedAt,
        uri: null,
        providerId: null,
        costEur: null,
      });
    } finally {
      session.release();
    }
    console.log(`${stored.status} ${stored.id}`);
    const pages = await research.query<{ extractor: string; page: number; text: string }>(PAGE, [
      stored.id,
    ]);
    let written = 0;
    for (const batch of batches) {
      const page = pages.rows.find((one) =>
        batch.every(({ line }) => spanOf(one.text, line.text) !== null),
      );
      if (page === undefined) throw new Error('no stored page holds each line of a batch');
      const items = doorItems(batch, stored.id, {
        extractor: page.extractor,
        number: page.page,
        text: page.text,
      });
      const result = await research.query<{ written: number }>(BATCH, [JSON.stringify(items)]);
      written += result.rows[0]?.written ?? 0;
      console.log(`  proposed ${batch[0]?.line.element.name ?? ''}`);
    }
    console.log(
      `${written} acts written, ${batches.reduce((s, b) => s + b.length, 0) - written} already waited`,
    );
    return 0;
  } finally {
    await Promise.all([app.end(), research.end()]);
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  });
}
