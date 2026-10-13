import { createHash } from 'node:crypto';

import type { RawObject } from '@gab/store';
import { XLSX_MIME } from '@gab/text/xlsx';
import { workbookOf } from '@gab/text/xlsx-fixture';
import { geojsonArchiveOf } from '@gab/text/archive-fixture';
import { ZIP_MIME } from '@gab/text/geojson';
import { bytesSource } from '@gab/text/zip';
import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { RunnerAgent } from '../agents.ts';
import { makeMapper } from '../mapper/mapper.ts';
import type { MapperConfig } from '../reader-config.ts';
import { completionOf, depsOf, routerOf, READER, type StubRouter } from '../runner-fixture.ts';
import { openRunner, type Step } from '../runner.ts';
import { approveReferenceDataset, parseApproval } from '../reference-dataset-command.ts';
import { makeTextSet } from '../text-set.ts';
import { makeLoader } from './loader.ts';

// A workbook in the shape of a tracker of oil and gas fields, built in memory. It is a fixture and
// holds no row of a real file. The load runs under a mapping that the model proposed, the operator
// promoted and the operator approved as a reference dataset.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 2 });

afterAll(async () => {
  await pool.end();
});

const BOOK = 'doc_gem_book';
const PUBLISHER = 'Global Energy Monitor';
const SHEET = 'Field-level data';
const FILTER = { column: 'Country/Area', value: 'Russia' };
const SET_NAME = 'xlsx-1|sheet=Field-level data|where=Country/Area=Russia';

const HEADER = [
  'Unit name',
  'Country/Area',
  'Fuel type',
  'Status',
  'Location accuracy',
  'Latitude',
  'Longitude',
] as const;

const WORKBOOK = workbookOf({
  About: [['Distributed under a licence']],
  [SHEET]: [
    [...HEADER],
    ['Alpha field', 'Russia', 'oil', 'operating', 'exact', 61.25, 73.5],
    ['Beta field', 'Norway', 'oil', 'operating', 'exact', 60.5, 5.25],
    ['Gamma field', 'Russia', 'gas', 'operating', 'approximate', 55, 37.5],
    ['Known field', 'Russia', 'oil', 'operating', 'exact', 62, 74],
  ],
});

const CONFIG: MapperConfig = { model: READER, tokenCap: 10_000 };

// What the model gives: the table is named as a file, and the publisher is the body behind it.
const DRAFT = {
  table: 'goget-fields.xlsx',
  modality: 'asserts',
  publisher: PUBLISHER,
  rows: {
    entity_type: 'facility',
    label: 'Unit name',
    lookup: [{ key: 'label', column: 'Unit name' }],
    geom: { lon: 'Longitude', lat: 'Latitude' },
    attrs: {
      fuel_type: { column: 'Fuel type', cast: { type: 'text' } },
      status: { column: 'Status', cast: { type: 'text' } },
      position_precision: { column: 'Location accuracy', cast: { type: 'text' } },
    },
    constants: { asset_kind: 'field' },
  },
  relations: [],
};

const answerOf = (draft: unknown): Response => completionOf(JSON.stringify({ mapping: draft }));

const noModel = (): StubRouter =>
  routerOf(() => {
    throw new Error('the model was asked, and this test asks none');
  });

const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

const PUT = `SELECT public.put_document($1, 'file', 'A tracker', $2, $3, NULL, $4, $5,
  '2026-10-01'::date)`;
const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1";

const one = z.array(z.object({ id: z.string().min(1) })).length(1);

interface Held {
  readonly client: PoolClient;
  readonly stored: RawObject[];
  readonly ask: (text: string, values?: unknown[]) => Promise<unknown[]>;
  readonly idOf: (text: string, values?: unknown[]) => Promise<string>;
  readonly step: (agent: RunnerAgent, router: StubRouter) => Promise<Step>;
  readonly asApp: <T>(work: () => Promise<T>) => Promise<T>;
  readonly asAgent: <T>(work: () => Promise<T>) => Promise<T>;
}

const inTransaction = async (work: (held: Held) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // A test turns the freeze trigger off with ALTER TABLE, which takes a SHARE ROW EXCLUSIVE
    // lock. Each transaction takes it first, so two test files never wait for each other.
    await client.query('LOCK TABLE public.proposals IN SHARE ROW EXCLUSIVE MODE');
    const ask = async (text: string, values: unknown[] = []): Promise<unknown[]> => {
      const found: { rows: unknown[] } = await client.query(text, values);
      return found.rows;
    };
    const asRole = async <T>(role: string, inner: () => Promise<T>): Promise<T> => {
      await client.query(`SET LOCAL SESSION AUTHORIZATION ${role}`);
      try {
        return await inner();
      } finally {
        // After a refusal the transaction is aborted, and the reset would hide the refusal.
        await client.query('RESET SESSION AUTHORIZATION').catch(() => undefined);
      }
    };
    await work({
      client,
      stored: [],
      ask,
      idOf: async (text, values = []) => one.parse(await ask(text, values))[0]?.id ?? '',
      step: async (agent, router) => {
        const { deps } = depsOf(client, [agent], router);
        return asRole('gabriel_agent', async () => (await openRunner(deps)).step());
      },
      asApp: (inner) => asRole('gabriel_app', inner),
      asAgent: (inner) => asRole('gabriel_agent', inner),
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const storeOf = (held: Held) => ({
  put: (object: RawObject): Promise<string> => {
    held.stored.push(object);
    return Promise.resolve(object.key);
  },
});

const asQueryable = (held: Held) => ({
  query: async (text: string, values?: unknown[]) => ({ rows: await held.ask(text, values) }),
});

// The workbook is stored as the ingestion door stores it, and a later text set of the same
// document sorts as the newest one: the mapper and the loader must still read the named set.
const storeWorkbook = async (held: Held, bytes: Uint8Array = WORKBOOK): Promise<string> => {
  await held.ask(PUT, [
    BOOK,
    `raw/${BOOK}.xlsx`,
    'https://tracker.test/fields.xlsx',
    sha256(bytes),
    XLSX_MIME,
  ]);
  const made = await makeTextSet(
    { db: asQueryable(held), open: () => Promise.resolve(bytesSource(bytes)) },
    { document: BOOK, sheet: SHEET, filter: FILTER },
  );
  await held.ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    BOOK,
    JSON.stringify(['Other,Header\r\n1,2\r\n']),
    'zz-later-set',
  ]);
  return made.name;
};

// An act is never decided by the transaction that proposed it. The test dates the proposal back
// with the freeze trigger off, as the test of a legacy act does, and the rollback turns it on.
const fromAnEarlierTransaction = async (held: Held, id: string): Promise<void> => {
  await held.ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await held.ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id = $1", [id]);
  await held.ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
};

const mappedWorkbook = async (held: Held, draft: unknown = DRAFT): Promise<string> => {
  await storeWorkbook(held);
  const job = await held.asApp(() =>
    held.idOf("SELECT public.enqueue_job($1, 'map_structured', $2) AS id", [BOOK, SET_NAME]),
  );
  await held.ask(OLDEST, [job]);
  expect(
    await held.step(
      makeMapper(CONFIG),
      routerOf(() => answerOf(draft)),
    ),
  ).toStrictEqual({
    did: 'done',
    job,
  });
  const mapping = await held.idOf(
    "SELECT id FROM public.proposals WHERE op = 'map_document' AND $1 = ANY (src::text[])",
    [BOOK],
  );
  await fromAnEarlierTransaction(held, mapping);
  const load = await held.asApp(() =>
    held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [mapping]),
  );
  await held.ask(OLDEST, [load]);
  return load;
};

const approve = (held: Held, name = 'GEM'): Promise<unknown[]> =>
  held.asApp(() => held.ask('SELECT public.approve_reference_dataset($1, $2) AS id', [BOOK, name]));

const runLoad = async (held: Held, load: string): Promise<void> => {
  expect(await held.step(makeLoader({ store: storeOf(held) }), noModel())).toStrictEqual({
    did: 'done',
    job: load,
  });
};

const actRow = z.object({
  label: z.string().nullable(),
  status: z.string(),
  decided_as: z.string().nullable(),
  decided_by: z.string().nullable(),
  decision_origin: z.string().nullable(),
  originator: z.string(),
  text_extractor: z.string(),
  page: z.number(),
  passage: z.string(),
  origin_label: z.string().nullable(),
});

const actsOf = async (held: Held) =>
  z.array(actRow).parse(
    await held.ask(
      `SELECT p.payload->>'label' AS label, p.status, p.decided_as, p.decided_by,
              p.decision_origin, p.originator, c.text_extractor, c.page,
              substr(t.text, c.start + 1, c."end" - c.start) AS passage,
              (SELECT a.origin_label FROM api.proposal a WHERE a.id = p.id) AS origin_label
         FROM public.proposals p
         JOIN public.citation c ON c.claim_id = p.id
         JOIN public.document_text t
           ON (t.document_id, t.extractor, t.page) = (c.doc_id, c.text_extractor, c.page)
        WHERE p.op = 'create_entity' AND p.author_role = 'gabriel_agent'
          AND $1 = ANY (p.src::text[])
        ORDER BY c.start`,
      [BOOK],
    ),
  );

const pointRow = z.object({
  label: z.string(),
  lon: z.number(),
  lat: z.number(),
  kind: z.string(),
  precision: z.string(),
  fuel: z.string(),
});

const pointsOf = async (held: Held) =>
  z.array(pointRow).parse(
    await held.ask(
      `SELECT e.label, public.ST_X(e.geom) AS lon, public.ST_Y(e.geom) AS lat,
              e.attrs #>> '{asset_kind,v}' AS kind, e.attrs #>> '{position_precision,v}' AS precision,
              e.attrs #>> '{fuel_type,v}' AS fuel
         FROM public.entities e WHERE e.attrs ? 'asset_kind' ORDER BY e.label`,
    ),
  );

const recordKnownField = async (held: Held): Promise<string> => {
  const act = await held.asApp(() =>
    held.idOf(
      `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
      [
        JSON.stringify({
          type: 'facility',
          label: 'Known field',
          attrs: { osm_id: { v: 'n1', src: ['manual'] } },
        }),
      ],
    ),
  );
  await fromAnEarlierTransaction(held, act);
  return held.asApp(() => held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [act]));
};

test('the Russian fields of an approved edition load as points with their kind, precision, origin and citations', async () => {
  await inTransaction(async (held) => {
    const known = await recordKnownField(held);
    const load = await mappedWorkbook(held);
    expect(
      await held.ask('SELECT kind, text_set FROM public.jobs WHERE id = $1', [load]),
    ).toStrictEqual([{ kind: 'load_mapped', text_set: SET_NAME }]);
    await approve(held);
    // The same file and the same filter give the same set, with the same rows, each time.
    expect(
      await makeTextSet(
        { db: asQueryable(held), open: () => Promise.resolve(bytesSource(WORKBOOK)) },
        { document: BOOK, sheet: SHEET, filter: FILTER },
      ),
    ).toStrictEqual({ name: SET_NAME, status: 'known', rows: 3 });

    await runLoad(held, load);

    // The Norwegian row is not in the text set, and the row of the known name writes nothing.
    expect(await pointsOf(held)).toStrictEqual([
      {
        label: 'Alpha field',
        lon: 73.5,
        lat: 61.25,
        kind: 'field',
        precision: 'exact',
        fuel: 'oil',
      },
      {
        label: 'Gamma field',
        lon: 37.5,
        lat: 55,
        kind: 'field',
        precision: 'approximate',
        fuel: 'gas',
      },
    ]);
    // The author of a row is the publisher, the rule accepted the row, and the origin says so.
    const acts = await actsOf(held);
    expect(acts.map((act) => act.label)).toStrictEqual(['Alpha field', 'Gamma field']);
    for (const act of acts) {
      expect(act).toMatchObject({
        status: 'accepted',
        decided_as: 'rule',
        decided_by: 'rule reference_dataset v1',
        decision_origin: 'reference dataset GEM, approved by the operator',
        originator: PUBLISHER,
        text_extractor: SET_NAME,
        page: 1,
      });
      expect(act.origin_label).toMatch(
        /^Reference dataset GEM, approved by the operator — GAB did not check it, on \d{4}-/u,
      );
    }
    expect(acts.map((act) => act.passage)).toStrictEqual([
      'Alpha field,Russia,oil,operating,exact,61.25,73.5',
      'Gamma field,Russia,gas,operating,approximate,55,37.5',
    ]);

    // The known name finds an entity by its name only, so the load writes nothing for it.
    expect(
      await held.ask("SELECT attrs ? 'asset_kind' AS typed FROM public.entities WHERE id = $1", [
        known,
      ]),
    ).toStrictEqual([{ typed: false }]);
    const lines = new TextDecoder().decode(held.stored[0]?.bytes).trim().split('\r\n');
    expect(lines[0]).toMatch(/read 3; loaded 2; excluded 1$/u);
    expect(lines[2]).toContain(`entity ${known} by its name only`);
  });
});

test('a row waits until the operator approves the edition, and the approval accepts it', async () => {
  await inTransaction(async (held) => {
    const load = await mappedWorkbook(held);

    await runLoad(held, load);

    expect(await pointsOf(held)).toStrictEqual([]);
    expect((await actsOf(held)).map((act) => act.status)).toStrictEqual([
      'pending',
      'pending',
      'pending',
    ]);

    await approve(held);

    expect((await actsOf(held)).map((act) => act.status)).toStrictEqual([
      'accepted',
      'accepted',
      'accepted',
    ]);
    expect((await pointsOf(held)).map((row) => row.label)).toStrictEqual([
      'Alpha field',
      'Gamma field',
      'Known field',
    ]);
  });
});

test('an approval is written once, and only the operator opens the door', async () => {
  await inTransaction(async (held) => {
    await storeWorkbook(held);

    expect(await approve(held)).toStrictEqual([{ id: true }]);
    expect(await approve(held)).toStrictEqual([{ id: false }]);
    // A refusal aborts the transaction, so each one runs inside a savepoint.
    await held.ask('SAVEPOINT refused');
    await expect(approve(held, 'Another dataset')).rejects.toThrow(/written once/u);
    await held.ask('ROLLBACK TO SAVEPOINT refused');
    await expect(
      held.asAgent(() => held.ask('SELECT public.approve_reference_dataset($1, $2)', [BOOK, 'X'])),
    ).rejects.toThrow(/permission denied/u);
  });
});

test('a row whose value disagrees with the record is a doubt, and an agreeing row is accepted', async () => {
  await inTransaction(async (held) => {
    // The record holds two facilities by an OpenStreetMap identifier, each one with a status.
    const entity = async (label: string, osm: string): Promise<string> => {
      const act = await held.asApp(() =>
        held.idOf(
          `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
          [
            JSON.stringify({
              type: 'facility',
              label,
              attrs: {
                osm_id: { v: osm, src: ['manual'] },
                status: { v: 'operating', src: ['manual'] },
              },
            }),
          ],
        ),
      );
      await fromAnEarlierTransaction(held, act);
      return held.asApp(() =>
        held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [act]),
      );
    };
    const retired = await entity('Delta field', 'n10');
    const agreeing = await entity('Epsilon field', 'n11');
    const book = workbookOf({
      [SHEET]: [
        ['Unit name', 'Country/Area', 'OSM id', 'Status'],
        ['Delta field', 'Russia', 'n10', 'retired'],
        ['Epsilon field', 'Russia', 'n11', 'operating'],
      ],
    });
    await storeWorkbook(held, book);
    const job = await held.asApp(() =>
      held.idOf("SELECT public.enqueue_job($1, 'map_structured', $2) AS id", [BOOK, SET_NAME]),
    );
    await held.ask(OLDEST, [job]);
    const draft = {
      ...DRAFT,
      rows: {
        ...DRAFT.rows,
        lookup: [{ key: 'osm_id', column: 'OSM id' }],
        geom: undefined,
        attrs: { status: { column: 'Status', cast: { type: 'text' } } },
      },
    };
    await held.step(
      makeMapper(CONFIG),
      routerOf(() => answerOf(draft)),
    );
    const mapping = await held.idOf(
      "SELECT id FROM public.proposals WHERE op = 'map_document' AND $1 = ANY (src::text[])",
      [BOOK],
    );
    await fromAnEarlierTransaction(held, mapping);
    const load = await held.asApp(() =>
      held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [mapping]),
    );
    await held.ask(OLDEST, [load]);
    await approve(held);

    await runLoad(held, load);

    const stateOf = async (entity: string) =>
      held.ask(
        `SELECT p.status, public.unit_rule(p.unit_id) AS rule
           FROM public.proposals p WHERE p.op = 'update_attrs' AND p.target_id = $1`,
        [entity],
      );
    expect(await stateOf(retired)).toStrictEqual([{ status: 'pending', rule: 'doubt' }]);
    expect(await stateOf(agreeing)).toStrictEqual([{ status: 'accepted', rule: null }]);
    const said = await held.ask(
      `SELECT f.faults->0->>'kind' AS kind, f.faults->0->>'said' AS said
         FROM public.unit_faults(ARRAY(SELECT p.unit_id FROM public.proposals p
                                        WHERE p.op = 'update_attrs' AND p.target_id = $1)) f`,
      [retired],
    );
    expect(said).toStrictEqual([
      {
        kind: 'record_disagrees',
        said: 'The record holds status operating, and the reference dataset gives retired',
      },
    ]);
    expect(
      await held.ask(
        `SELECT e.attrs #>> '{asset_kind,v}' AS kind, e.attrs #>> '{status,v}' AS status
           FROM public.entities e WHERE e.id IN ($1, $2) ORDER BY e.label`,
        [retired, agreeing],
      ),
    ).toStrictEqual([
      { kind: null, status: 'operating' },
      { kind: 'field', status: 'operating' },
    ]);
  });
});

test('a forged act with the model call of the mapping is not accepted on a document with no load', async () => {
  await inTransaction(async (held) => {
    await mappedWorkbook(held);
    const call = await held.idOf(
      "SELECT model_call_id::text AS id FROM public.proposals WHERE op = 'map_document'",
    );
    // A second edition is approved, but no load of the mapping ever ran on it.
    const other = 'doc_gem_forged';
    const text = 'Unit name\r\nZeta field\r\n';
    await held.ask(PUT, [
      other,
      `raw/${other}.xlsx`,
      'https://tracker.test/other.xlsx',
      sha256(text),
      XLSX_MIME,
    ]);
    await held.ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
      other,
      JSON.stringify([text]),
      'xlsx-1|sheet=Other',
    ]);
    await held.asApp(() =>
      held.ask('SELECT public.approve_reference_dataset($1, $2)', [other, 'GEM']),
    );

    const item = {
      id: crypto.randomUUID(),
      op: 'create_entity',
      payload: { type: 'facility', label: 'Zeta field' },
      src: [other],
      names: [],
      dissent: false,
      model_call_id: call,
      originator: PUBLISHER,
      modality: 'asserts',
      citations: [
        { document: other, text_extractor: 'xlsx-1|sheet=Other', page: 1, start: 11, end: 21 },
      ],
    };
    await held.asAgent(() =>
      held.ask('SELECT * FROM public.propose_batch($1::jsonb)', [JSON.stringify([item])]),
    );

    expect(
      await held.ask('SELECT status FROM public.proposals WHERE id = $1', [item.id]),
    ).toStrictEqual([{ status: 'pending' }]);
  });
});

test('the approve command reads its words, and approves through the door of the operator', async () => {
  expect(parseApproval(['approve', BOOK, '--name', ' GEM '])).toStrictEqual({
    document: BOOK,
    name: 'GEM',
  });
  expect(() => parseApproval(['approve', BOOK])).toThrow(/--name/u);
  expect(() => parseApproval(['load', BOOK, '--name', 'GEM'])).toThrow(/approve/u);

  await inTransaction(async (held) => {
    await storeWorkbook(held);
    const db = asQueryable(held);
    expect(await held.asApp(() => approveReferenceDataset(db, BOOK, 'GEM'))).toBe(true);
    expect(await held.asApp(() => approveReferenceDataset(db, BOOK, 'GEM'))).toBe(false);
    await expect(held.asAgent(() => approveReferenceDataset(db, BOOK, 'GEM'))).rejects.toThrow(
      /permission denied/u,
    );
  });
});

test('the mapper refuses a text set that is no table of a workbook', async () => {
  await inTransaction(async (held) => {
    await storeWorkbook(held);
    const job = await held.asApp(() =>
      held.idOf("SELECT public.enqueue_job($1, 'map_structured', $2) AS id", [
        BOOK,
        'zz-later-set',
      ]),
    );
    await held.ask(OLDEST, [job]);
    const router = noModel();

    expect(await held.step(makeMapper(CONFIG), router)).toStrictEqual({ did: 'failed', job });
    expect(router.chats()).toBe(0);
  });
});

// A route archive in the shape of the published files: one GeoJSON layer, a system entry, and a
// segment that has no route. The record holds the Druzhba pipeline as one entity already.
const ARCHIVE_DOC = 'doc_gem_routes';
const LAYER = 'GEM-oil-pipelines.geojson';
const LAYER_SET = `geojson-1|layer=${LAYER}|where=Countries=Russia`;
const ROUTE = {
  type: 'LineString',
  coordinates: [
    [49.1, 55.2],
    [50.3, 56.4],
    [51.5, 57.1],
  ],
};
const ARCHIVE = geojsonArchiveOf({
  [LAYER]: [
    {
      properties: {
        ProjectID: 'P0001',
        Segment: 'Druzhba',
        Pipeline: 'Druzhba',
        Status: 'operating',
        CapacityBOEd: 1,
        LengthKnownKm: 1,
        Countries: 'Russia',
      },
      geometry: ROUTE,
    },
    {
      properties: {
        ProjectID: 'P0004',
        Segment: 'Druzhba north',
        Pipeline: 'Druzhba',
        Status: 'operating',
        CapacityBOEd: 1200000,
        LengthKnownKm: 3900.5,
        Countries: 'Russia',
      },
      geometry: ROUTE,
    },
    {
      properties: {
        ProjectID: 'P0002',
        Segment: 'Fjord line',
        Pipeline: 'Fjord',
        Status: 'operating',
        CapacityBOEd: 1,
        LengthKnownKm: 2,
        Countries: 'Norway',
      },
      geometry: ROUTE,
    },
    {
      properties: {
        ProjectID: 'P0003',
        Segment: 'Taiga link',
        Pipeline: 'Taiga',
        Status: 'proposed',
        CapacityBOEd: null,
        LengthKnownKm: null,
        Countries: 'Russia',
      },
      geometry: null,
    },
  ],
});
const ROUTE_DRAFT = {
  table: 'GEM-oil-pipelines.zip',
  modality: 'asserts',
  publisher: PUBLISHER,
  rows: {
    entity_type: 'facility',
    label: 'Segment',
    lookup: [{ key: 'gem_project_id', column: 'ProjectID' }],
    geom: { geojson: 'geometry' },
    attrs: {
      gem_project_id: { column: 'ProjectID', cast: { type: 'identifier' } },
      pipeline_name: { column: 'Pipeline', cast: { type: 'text' } },
      status: { column: 'Status', cast: { type: 'text' } },
      capacity_boed: { column: 'CapacityBOEd', cast: { type: 'number', scale: 0 } },
      length_km: { column: 'LengthKnownKm', cast: { type: 'number', scale: 3 } },
    },
    constants: { asset_kind: 'pipeline_segment' },
  },
  relations: [],
};

const segmentRow = z.object({
  label: z.string(),
  kind: z.string().nullable(),
  geometry: z.string().nullable(),
  project: z.string().nullable(),
  pipeline: z.string().nullable(),
  capacity: z.string().nullable(),
  length: z.string().nullable(),
});

test('the segments of a route archive load as lines, and a pipeline of the record is not merged with a segment', async () => {
  await inTransaction(async (held) => {
    // The record holds the Druzhba pipeline as one entity, with the name that the first segment has.
    const druzhbaAct = await held.asApp(() =>
      held.idOf(
        `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
        [
          JSON.stringify({
            type: 'facility',
            label: 'Druzhba',
            attrs: { osm_id: { v: 'r1', src: ['manual'] } },
          }),
        ],
      ),
    );
    await fromAnEarlierTransaction(held, druzhbaAct);
    await held.asApp(() =>
      held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [druzhbaAct]),
    );
    const druzhba = await held.idOf(
      "SELECT id::text AS id FROM public.entities WHERE label = 'Druzhba'",
    );

    await held.ask(PUT, [
      ARCHIVE_DOC,
      `raw/${ARCHIVE_DOC}.zip`,
      'https://tracker.test/routes.zip',
      sha256(ARCHIVE),
      ZIP_MIME,
    ]);
    const opened = { open: () => Promise.resolve(bytesSource(ARCHIVE)) };
    const made = await makeTextSet(
      { db: asQueryable(held), ...opened },
      { document: ARCHIVE_DOC, layer: LAYER, filter: { column: 'Countries', value: 'Russia' } },
    );
    // The system entry and the text file are no layer, and the feature with no route keeps its row.
    expect(made).toStrictEqual({ name: LAYER_SET, status: 'stored', rows: 3 });
    await expect(
      makeTextSet(
        { db: asQueryable(held), ...opened },
        { document: ARCHIVE_DOC, layer: 'README.txt' },
      ),
    ).rejects.toThrow(/no layer named/u);

    const job = await held.asApp(() =>
      held.idOf("SELECT public.enqueue_job($1, 'map_structured', $2) AS id", [
        ARCHIVE_DOC,
        LAYER_SET,
      ]),
    );
    await held.ask(OLDEST, [job]);
    expect(
      await held.step(
        makeMapper(CONFIG),
        routerOf(() => answerOf(ROUTE_DRAFT)),
      ),
    ).toStrictEqual({ did: 'done', job });
    const mapping = await held.idOf(
      "SELECT id FROM public.proposals WHERE op = 'map_document' AND $1 = ANY (src::text[])",
      [ARCHIVE_DOC],
    );
    await fromAnEarlierTransaction(held, mapping);
    const load = await held.asApp(() =>
      held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [mapping]),
    );
    await held.ask(OLDEST, [load]);
    await held.asApp(() =>
      held.ask('SELECT public.approve_reference_dataset($1, $2) AS id', [ARCHIVE_DOC, 'GEM']),
    );

    await runLoad(held, load);

    // The segment that has the name of the pipeline of the record waits as a doubt: the rule of a
    // duplicate name keeps it out, and nothing merges it with the pipeline.
    expect(
      await held.ask(
        `SELECT p.payload->>'label' AS label, p.status, public.unit_rule(p.unit_id) AS rule
           FROM public.proposals p
          WHERE p.op = 'create_entity' AND p.payload->'attrs'->'gem_project_id'->>'v' = 'P0001'`,
      ),
    ).toStrictEqual([{ label: 'Druzhba', status: 'pending', rule: 'doubt' }]);
    const segments = z.array(segmentRow).parse(
      await held.ask(
        `SELECT e.label, e.attrs #>> '{asset_kind,v}' AS kind,
                public.ST_GeometryType(e.geom) AS geometry,
                e.attrs #>> '{gem_project_id,v}' AS project,
                e.attrs #>> '{pipeline_name,v}' AS pipeline,
                e.attrs #>> '{capacity_boed,v}' AS capacity,
                e.attrs #>> '{length_km,v}' AS length
           FROM public.entities e WHERE e.attrs ? 'asset_kind' ORDER BY project DESC`,
      ),
    );
    expect(segments).toStrictEqual([
      {
        label: 'Druzhba north',
        kind: 'pipeline_segment',
        geometry: 'ST_LineString',
        project: 'P0004',
        pipeline: 'Druzhba',
        capacity: '1200000',
        length: '3900.5',
      },
      {
        label: 'Taiga link',
        kind: 'pipeline_segment',
        geometry: null,
        project: 'P0003',
        pipeline: 'Taiga',
        capacity: null,
        length: null,
      },
    ]);
    // The pipeline of the record stays one entity of its own, with no kind and no route.
    expect(
      await held.ask(
        `SELECT e.id::text = $1 AS same, e.geom IS NULL AS no_route, e.attrs ? 'asset_kind' AS typed
           FROM public.entities e WHERE e.attrs ? 'osm_id'`,
        [druzhba],
      ),
    ).toStrictEqual([{ same: true, no_route: true, typed: false }]);
  });
});
