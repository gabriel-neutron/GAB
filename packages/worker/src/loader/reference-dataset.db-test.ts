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
import { dryJoin } from './dry-join.ts';
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

    // The Norwegian row is not in the text set, and the row of the known name waits as a doubt.
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

    // The known name finds an entity by its name only, so its facts wait for the operator.
    expect(
      await held.ask("SELECT attrs ? 'asset_kind' AS typed FROM public.entities WHERE id = $1", [
        known,
      ]),
    ).toStrictEqual([{ typed: false }]);
    expect(
      await held.ask(
        `SELECT p.status, p.found_by, public.unit_rule(p.unit_id) AS rule,
                (SELECT f.faults->0->>'said' FROM public.unit_faults(ARRAY[p.unit_id]) f) AS said
           FROM public.proposals p WHERE p.op = 'update_attrs' AND p.target_id = $1`,
        [known],
      ),
    ).toStrictEqual([
      {
        status: 'pending',
        found_by: 'label',
        rule: 'doubt',
        said: 'The load found Known field by its name only',
      },
    ]);
    const lines = new TextDecoder().decode(held.stored[0]?.bytes).trim().split('\r\n');
    expect(lines[0]).toMatch(/read 3; loaded 3; excluded 0$/u);
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

test('a row sets a missing geometry, a different point is a doubt that writes nothing, and a promotion keeps the old point', async () => {
  await inTransaction(async (held) => {
    const entity = async (label: string, osm: string, geom?: unknown): Promise<string> => {
      const act = await held.asApp(() =>
        held.idOf(
          `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
          [
            JSON.stringify({
              type: 'facility',
              label,
              ...(geom === undefined ? {} : { geom }),
              attrs: { osm_id: { v: osm, src: ['manual'] } },
            }),
          ],
        ),
      );
      await fromAnEarlierTransaction(held, act);
      return held.asApp(() =>
        held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [act]),
      );
    };
    const bare = await entity('Iota field', 'n20');
    const moved = await entity('Kappa field', 'n21', { type: 'Point', coordinates: [20, 10] });
    const same = await entity('Lambda field', 'n22', { type: 'Point', coordinates: [22, 12] });
    const book = workbookOf({
      [SHEET]: [
        ['Unit name', 'Country/Area', 'OSM id', 'Latitude', 'Longitude'],
        ['Iota field', 'Russia', 'n20', 61.5, 73.25],
        ['Kappa field', 'Russia', 'n21', 11, 21],
        ['Lambda field', 'Russia', 'n22', 12, 22],
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
        attrs: {},
        constants: undefined,
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

    const placeOf = (id: string) =>
      held.ask(
        `SELECT public.ST_X(e.geom) AS lon, public.ST_Y(e.geom) AS lat, e.sources::text[] AS sources
           FROM public.entities e WHERE e.id = $1`,
        [id],
      );
    const actOf = (id: string) =>
      held.ask(
        `SELECT p.status, p.found_by, public.unit_rule(p.unit_id) AS rule,
                p.prior_value -> 'geom' AS prior
           FROM public.proposals p WHERE p.op = 'update_entity' AND p.target_id = $1`,
        [id],
      );

    // An entity with no point gets the point of the row, by a proposal that the rule accepts.
    expect(await placeOf(bare)).toStrictEqual([{ lon: 73.25, lat: 61.5, sources: [BOOK] }]);
    expect(await actOf(bare)).toStrictEqual([
      { status: 'accepted', found_by: 'osm_id', rule: null, prior: null },
    ]);
    // The point of the record is not the point of the row, so the row waits as a doubt.
    expect(await placeOf(moved)).toStrictEqual([{ lon: 20, lat: 10, sources: ['manual'] }]);
    expect(await actOf(moved)).toStrictEqual([
      { status: 'pending', found_by: 'osm_id', rule: 'doubt', prior: null },
    ]);
    expect(
      await held.ask(
        `SELECT f.faults->0->>'kind' AS kind, f.faults->0->>'said' AS said
           FROM public.unit_faults(ARRAY(SELECT p.unit_id FROM public.proposals p
                                          WHERE p.op = 'update_entity' AND p.target_id = $1)) f`,
        [moved],
      ),
    ).toStrictEqual([
      {
        kind: 'record_disagrees',
        said: 'The record holds another geometry than the reference dataset gives',
      },
    ]);
    // The same point writes no act.
    expect(await actOf(same)).toStrictEqual([]);

    // The operator promotes the doubt: the point is replaced, the old point stays in the history,
    // and the source list of the row is the list of the act.
    const unit = await held.idOf(
      "SELECT unit_id AS id FROM public.proposals WHERE op = 'update_entity' AND target_id = $1",
      [moved],
    );
    await fromAnEarlierTransaction(held, unit);
    await held.asApp(() => held.ask("SELECT public.promote_unit($1::uuid, 'a test')", [unit]));
    expect(await placeOf(moved)).toStrictEqual([{ lon: 21, lat: 11, sources: [BOOK] }]);
    expect(await actOf(moved)).toStrictEqual([
      {
        status: 'accepted',
        found_by: 'osm_id',
        rule: null,
        prior: { type: 'Point', coordinates: [20, 10] },
      },
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

// An entity table in the shape of the GEM ownership workbook. The register column holds a tax
// number or a registration number as a number of the workbook, and the LEI column holds "not
// found" where GEM found no LEI. The record holds three of the companies already.
const ENTITY_SHEET = 'Entities';
const ENTITY_SET = 'xlsx-1|sheet=Entities|where=Country=Russia';
const ENTITY_BOOK = workbookOf({
  [ENTITY_SHEET]: [
    ['Entity ID', 'Name', 'Country', 'Registry ID', 'LEI', 'Parent'],
    ['E100001', 'Rosneft', 'Russia', 105012345, 'not found', ''],
    ['E100002', 'Lukoil', 'Russia', 1027700035769, 'not found', 'Novatek'],
    ['E100003', 'Novatek', 'Russia', 6316031581, '2138008R6GCRVBDFA581', ''],
    ['E100004', 'Arctic New Co', 'Russia', '', '', 'Novatek'],
    ['E100005', 'Oslo Co', 'Norway', 912345678, '', ''],
  ],
});
const ENTITY_DRAFT = {
  table: 'GEM-ownership.xlsx',
  modality: 'asserts',
  publisher: PUBLISHER,
  rows: {
    entity_type: 'company',
    label: 'Name',
    lookup: [
      { key: 'label', column: 'Name' },
      { key: 'tax_id', column: 'Registry ID' },
      { key: 'registration_number', column: 'Registry ID' },
      { key: 'gem_entity_id', column: 'Entity ID' },
    ],
    attrs: {
      gem_entity_id: { column: 'Entity ID', cast: { type: 'identifier' } },
      tax_id: { column: 'Registry ID', cast: { type: 'ru_register' } },
      registration_number: { column: 'Registry ID', cast: { type: 'ru_register' } },
      lei: { column: 'LEI', cast: { type: 'identifier' } },
    },
  },
  relations: [{ type: 'owns', row_is: 'dst', other: { key: 'label', column: 'Parent' } }],
};

const recorded = async (
  held: Held,
  label: string,
  attrs: Readonly<Record<string, string>>,
): Promise<string> => {
  const act = await held.asApp(() =>
    held.idOf(
      `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
      [
        JSON.stringify({
          type: 'company',
          label,
          attrs: Object.fromEntries(
            Object.entries(attrs).map(([key, v]) => [key, { v, src: ['manual'] }]),
          ),
        }),
      ],
    ),
  );
  await fromAnEarlierTransaction(held, act);
  return held.asApp(() => held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [act]));
};

const companyRow = z.object({
  label: z.string(),
  gem: z.string().nullable(),
  tax: z.string().nullable(),
  registration: z.string().nullable(),
  lei: z.string().nullable(),
});

test('a GEM company finds the record company by its tax number, and a name match or another value is a doubt', async () => {
  await inTransaction(async (held) => {
    // The record keeps the tax number with its leading zero, and the workbook lost it.
    const rosneft = await recorded(held, 'Rosneft Oil Company', { tax_id: '0105012345' });
    const lukoil = await recorded(held, 'Lukoil', {});
    const novatek = await recorded(held, 'Novatek', {
      tax_id: '6316031581',
      lei: '549300LCJ1UJXHYBWI24',
    });
    await held.ask(PUT, [
      BOOK,
      `raw/${BOOK}.xlsx`,
      'https://tracker.test/ownership.xlsx',
      sha256(ENTITY_BOOK),
      XLSX_MIME,
    ]);
    await makeTextSet(
      { db: asQueryable(held), open: () => Promise.resolve(bytesSource(ENTITY_BOOK)) },
      { document: BOOK, sheet: ENTITY_SHEET, filter: { column: 'Country', value: 'Russia' } },
    );
    const job = await held.asApp(() =>
      held.idOf("SELECT public.enqueue_job($1, 'map_structured', $2) AS id", [BOOK, ENTITY_SET]),
    );
    await held.ask(OLDEST, [job]);
    await held.step(
      makeMapper(CONFIG),
      routerOf(() => answerOf(ENTITY_DRAFT)),
    );
    const mapping = await held.idOf(
      "SELECT id FROM public.proposals WHERE op = 'map_document' AND $1 = ANY (src::text[])",
      [BOOK],
    );

    // Before the promotion, the dry join says which key finds each row, and it writes nothing.
    const count = 'SELECT count(*)::int AS acts FROM public.proposals';
    const before = await held.ask(count);
    const join = await held.asAgent(() => dryJoin(asQueryable(held), mapping));
    expect(await held.ask(count)).toStrictEqual(before);
    expect(join.trim().split('\r\n')).toStrictEqual([
      `# dry join of mapping ${mapping}; document ${BOOK}; text set ${ENTITY_SET}; rows 4; ` +
        'by identifier 2; by name only 1; creates 1; more than one 0',
      'row,label,key,entity,outcome',
      `1,Rosneft,tax_id,${rosneft},finds`,
      `2,Lukoil,label,${lukoil},finds by name only`,
      `3,Novatek,tax_id,${novatek},finds`,
      '4,Arctic New Co,,,creates',
    ]);

    await fromAnEarlierTransaction(held, mapping);
    const load = await held.asApp(() =>
      held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [mapping]),
    );
    await held.ask(OLDEST, [load]);
    await runLoad(held, load);

    // Before the approval the table is no reference, and its other value is a doubt too.
    expect(
      await held.ask(
        `SELECT public.unit_rule(p.unit_id) AS rule,
                (SELECT f.faults->0->>'said' FROM public.unit_faults(ARRAY[p.unit_id]) f) AS said
           FROM public.proposals p WHERE p.op = 'update_attrs' AND p.target_id = $1`,
        [novatek],
      ),
    ).toStrictEqual([
      {
        rule: 'doubt',
        said: 'The record holds lei 549300LCJ1UJXHYBWI24, and the loaded row gives 2138008R6GCRVBDFA581',
      },
    ]);
    await approve(held);

    const stateOf = async (entity: string) =>
      held.ask(
        `SELECT p.status, p.found_by, public.unit_rule(p.unit_id) AS rule,
                (SELECT f.faults->0->>'kind' FROM public.unit_faults(ARRAY[p.unit_id]) f) AS fault
           FROM public.proposals p WHERE p.op = 'update_attrs' AND p.target_id = $1`,
        [entity],
      );
    expect(await stateOf(rosneft)).toStrictEqual([
      { status: 'accepted', found_by: 'tax_id', rule: null, fault: null },
    ]);
    expect(await stateOf(lukoil)).toStrictEqual([
      { status: 'pending', found_by: 'label', rule: 'doubt', fault: 'name_only_match' },
    ]);
    expect(await stateOf(novatek)).toStrictEqual([
      { status: 'pending', found_by: 'tax_id', rule: 'doubt', fault: 'record_disagrees' },
    ]);

    // "not found" is no LEI, and a registration number never loads as a tax number.
    expect(
      z.array(companyRow).parse(
        await held.ask(
          `SELECT e.label, e.attrs #>> '{gem_entity_id,v}' AS gem, e.attrs #>> '{tax_id,v}' AS tax,
                  e.attrs #>> '{registration_number,v}' AS registration,
                  e.attrs #>> '{lei,v}' AS lei
             FROM public.entities e
            WHERE e.id = ANY ($1::uuid[]) OR e.label = 'Arctic New Co' ORDER BY e.label`,
          [[rosneft, lukoil, novatek]],
        ),
      ),
    ).toStrictEqual([
      { label: 'Arctic New Co', gem: 'E100004', tax: null, registration: null, lei: null },
      { label: 'Lukoil', gem: null, tax: null, registration: null, lei: null },
      {
        label: 'Novatek',
        gem: null,
        tax: '6316031581',
        registration: null,
        lei: '549300LCJ1UJXHYBWI24',
      },
      {
        label: 'Rosneft Oil Company',
        gem: 'E100001',
        tax: '0105012345',
        registration: null,
        lei: null,
      },
    ]);
    expect(
      await held.ask(
        `SELECT p.payload->'attrs' AS attrs FROM public.proposals p
          WHERE p.op = 'update_attrs' AND p.target_id = $1`,
        [lukoil],
      ),
    ).toStrictEqual([
      {
        attrs: {
          gem_entity_id: { v: 'E100002', src: [BOOK] },
          registration_number: { v: '1027700035769', src: [BOOK] },
        },
      },
    ]);
    const report = new TextDecoder().decode(held.stored[0]?.bytes);
    expect(report).toMatch(/read 4; loaded 4; excluded 0\r\n/u);
    expect(report).toContain('gives no lei: ""not found"" is not a LEI in its legal form');
    expect(report).not.toContain('is a tax number, and not a registration number');
    // The entity of a name match gets no relation, and a new entity gets its owner.
    expect(report).toContain('relation not loaded: the row finds its entity by its name only');
    expect(
      await held.ask(
        `SELECT n.payload->>'label' AS owned FROM public.proposals p
           JOIN public.proposals n ON n.id = (p.payload->>'dst_id')::uuid
          WHERE p.op = 'create_relation' AND p.payload->>'src_id' = $1`,
        [novatek],
      ),
    ).toStrictEqual([{ owned: 'Arctic New Co' }]);
  });
});

// A workbook in the shape of the GEM ownership workbook: an entity sheet, and an ownership sheet
// where each row is one link with its share. GEM estimated one share, one holder is no entity,
// and one holder is a company that the Russian set of the entity sheet does not hold.
const OWNERSHIP_SHEET = 'Ownership';
const OWNERSHIP_SET = 'xlsx-1|sheet=Ownership';
const OWNERSHIP_HEADER = [
  'Subject ID',
  'Subject',
  'Holder ID',
  'Holder',
  'Share',
  'Imputed',
  'URL',
];
const OWNERSHIP_BOOK = workbookOf({
  [ENTITY_SHEET]: [
    ['Entity ID', 'Name', 'Country', 'Registry ID', 'LEI', 'Parent'],
    ['E200001', 'Rosneftegaz', 'Russia', 7705630445, '', ''],
    ['E200002', 'Rosneft', 'Russia', 7706107510, '', ''],
    ['E200003', 'QH Oil Investments', 'Russia', '', '', ''],
    ['E200009', 'Oslo Co', 'Norway', '', '', ''],
  ],
  [OWNERSHIP_SHEET]: [
    [...OWNERSHIP_HEADER],
    ['E200002', 'Rosneft', 'E200001', 'Rosneftegaz', 40.4, 'FALSE', 'https://gem.test/a'],
    ['E200002', 'Rosneft', 'E200003', 'QH Oil Investments', 18.46, 'TRUE', 'https://gem.test/b'],
    ['E200002', 'Rosneft', 'E200008', 'small shareholder(s)', 41.14, 'TRUE', ''],
    ['E200002', 'Rosneft', 'E200009', 'Oslo Co', 0.5, 'FALSE', ''],
  ],
});

const COMPANY_DRAFT = {
  ...ENTITY_DRAFT,
  rows: {
    ...ENTITY_DRAFT.rows,
    lookup: [{ key: 'gem_entity_id', column: 'Entity ID' }],
    attrs: {
      gem_entity_id: { column: 'Entity ID', cast: { type: 'identifier' } },
      tax_id: { column: 'Registry ID', cast: { type: 'ru_register' } },
      registration_number: { column: 'Registry ID', cast: { type: 'ru_register' } },
    },
  },
  relations: [],
};

const LINK_DRAFT = {
  table: 'GEM-ownership.xlsx, ownership',
  modality: 'asserts',
  publisher: PUBLISHER,
  rows: {
    relation_type: 'owns',
    src: {
      entity_type: 'company',
      name: 'Holder',
      lookup: [{ key: 'gem_entity_id', column: 'Holder ID' }],
    },
    dst: {
      entity_type: 'company',
      name: 'Subject',
      lookup: [{ key: 'gem_entity_id', column: 'Subject ID' }],
    },
    attrs: {
      share_pct: { column: 'Share', cast: { type: 'number', scale: 4 } },
      share_imputed: { column: 'Imputed', cast: { type: 'boolean' } },
      source_url: { column: 'URL', cast: { type: 'text' } },
    },
  },
  relations: [],
};

/** Maps one text set of the stored workbook, and promotes the mapping. Returns the mapping and
 * the load job. */
const mapAndPromote = async (
  held: Held,
  set: string,
  draft: unknown,
): Promise<{ mapping: string; load: string }> => {
  const job = await held.asApp(() =>
    held.idOf("SELECT public.enqueue_job($1, 'map_structured', $2) AS id", [BOOK, set]),
  );
  await held.ask(OLDEST, [job]);
  expect(
    await held.step(
      makeMapper(CONFIG),
      routerOf(() => answerOf(draft)),
    ),
  ).toStrictEqual({ did: 'done', job });
  const mapping = await held.idOf(
    `SELECT p.id FROM public.proposals p
      WHERE p.op = 'map_document' AND $1 = ANY (p.src::text[])
        AND public.mapping_text_set(p.id) = $2`,
    [BOOK, set],
  );
  await fromAnEarlierTransaction(held, mapping);
  const load = await held.asApp(() =>
    held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [mapping]),
  );
  await held.ask(OLDEST, [load]);
  return { mapping, load };
};

const linkRow = z.object({
  holder: z.string(),
  subject: z.string(),
  share: z.number().nullable(),
  imputed: z.boolean().nullable(),
  url: z.string().nullable(),
  status: z.string(),
  decided_by: z.string().nullable(),
  originator: z.string(),
  passage: z.string(),
});

test('a relation table loads the ownership links between GEM companies, with the share and its flag', async () => {
  await inTransaction(async (held) => {
    await held.ask(PUT, [
      BOOK,
      `raw/${BOOK}.xlsx`,
      'https://tracker.test/ownership.xlsx',
      sha256(OWNERSHIP_BOOK),
      XLSX_MIME,
    ]);
    const open = () => Promise.resolve(bytesSource(OWNERSHIP_BOOK));
    await makeTextSet(
      { db: asQueryable(held), open },
      { document: BOOK, sheet: ENTITY_SHEET, filter: { column: 'Country', value: 'Russia' } },
    );
    expect(
      await makeTextSet(
        { db: asQueryable(held), open },
        { document: BOOK, sheet: OWNERSHIP_SHEET },
      ),
    ).toMatchObject({ name: OWNERSHIP_SET, rows: 4 });
    await approve(held);

    // The companies load first, by their GEM identifier.
    const companies = await mapAndPromote(held, ENTITY_SET, COMPANY_DRAFT);
    await runLoad(held, companies.load);
    const idOf = (label: string): Promise<string> =>
      held.idOf('SELECT id FROM public.entities WHERE label = $1', [label]);
    const [rosneftegaz, rosneft, qh] = [
      await idOf('Rosneftegaz'),
      await idOf('Rosneft'),
      await idOf('QH Oil Investments'),
    ];

    // Then the links. The dry join says which key finds each end, and writes nothing.
    const links = await mapAndPromote(held, OWNERSHIP_SET, LINK_DRAFT);
    const join = await held.asAgent(() => dryJoin(asQueryable(held), links.mapping));
    expect(join.trim().split('\r\n')).toStrictEqual([
      `# dry join of mapping ${links.mapping}; document ${BOOK}; text set ${OWNERSHIP_SET}; ` +
        'rows 4; links 2; to the report 2',
      'row,src_key,src_entity,src_outcome,dst_key,dst_entity,dst_outcome,outcome',
      `1,gem_entity_id,${rosneftegaz},finds,gem_entity_id,${rosneft},finds,links`,
      `2,gem_entity_id,${qh},finds,gem_entity_id,${rosneft},finds,links`,
      `3,,,"the src ""small shareholder(s)"" is not an entity",gem_entity_id,${rosneft},finds,goes to the report`,
      `4,,,not in the record,gem_entity_id,${rosneft},finds,goes to the report`,
    ]);
    const entities = 'SELECT count(*)::int AS entities FROM public.proposals WHERE op = $1';
    const before = await held.ask(entities, ['create_entity']);

    await runLoad(held, links.load);

    // A row of a relation table creates no entity.
    expect(await held.ask(entities, ['create_entity'])).toStrictEqual(before);
    expect(
      z.array(linkRow).parse(
        await held.ask(
          `SELECT s.label AS holder, d.label AS subject,
                  (r.attrs #>> '{share_pct,v}')::numeric::float8 AS share,
                  (r.attrs #>> '{share_imputed,v}')::boolean AS imputed,
                  r.attrs #>> '{source_url,v}' AS url,
                  p.status, p.decided_by, p.originator,
                  substr(t.text, c.start + 1, c."end" - c.start) AS passage
             FROM public.relations r
             JOIN public.proposals p ON p.id = r.promoted_from
             JOIN public.entities s ON s.id = r.src_id
             JOIN public.entities d ON d.id = r.dst_id
             JOIN public.citation c ON c.claim_id = p.id
             JOIN public.document_text t
               ON (t.document_id, t.extractor, t.page) = (c.doc_id, c.text_extractor, c.page)
            WHERE r.type = 'owns' ORDER BY s.label`,
        ),
      ),
    ).toStrictEqual([
      {
        holder: 'QH Oil Investments',
        subject: 'Rosneft',
        share: 18.46,
        imputed: true,
        url: 'https://gem.test/b',
        status: 'accepted',
        decided_by: 'rule reference_dataset v1',
        originator: PUBLISHER,
        passage: 'E200002,Rosneft,E200003,QH Oil Investments,18.46,TRUE,https://gem.test/b',
      },
      {
        holder: 'Rosneftegaz',
        subject: 'Rosneft',
        share: 40.4,
        imputed: false,
        url: 'https://gem.test/a',
        status: 'accepted',
        decided_by: 'rule reference_dataset v1',
        originator: PUBLISHER,
        passage: 'E200002,Rosneft,E200001,Rosneftegaz,40.4,FALSE,https://gem.test/a',
      },
    ]);

    // A holder that is no entity, and a holder that the record does not hold, go to the report.
    const report = new TextDecoder().decode(held.stored[1]?.bytes).trim().split('\r\n');
    expect(report[0]).toMatch(/read 4; loaded 2; excluded 2$/u);
    expect(report.slice(2)).toStrictEqual([
      expect.stringMatching(
        /^3,1,\d+,\d+,"relation not loaded: the src ""small shareholder\(s\)"" is not an entity"$/u,
      ),
      expect.stringMatching(
        /^4,1,\d+,\d+,"relation not loaded: the src ""Oslo Co"" is not in the record"$/u,
      ),
    ]);
  });
});

// A workbook in the shape of the GEM workbooks of the hydrocarbon map: companies, assets with
// their operator, LNG terminals with an owner cell, and the ownership of pipeline segments.
const HC_BOOK = workbookOf({
  [ENTITY_SHEET]: [
    ['Entity ID', 'Name', 'Country', 'Registry ID', 'LEI', 'Parent'],
    ['E200001', 'Rosneftegaz', 'Russia', 7705630445, '', ''],
    ['E200002', 'Novatek', 'Russia', 6316031581, '', ''],
  ],
  Assets: [
    ['Project ID', 'Unit name', 'Operator ID', 'Latitude', 'Longitude'],
    ['P0001', 'Segment A', 'E200001', 61, 73],
    ['P0002', 'Segment B', 'E200099', 62, 74],
  ],
  LNG: [
    ['Terminal ID', 'Terminal', 'Owners', 'Capacity', 'Group share', 'Latitude', 'Longitude'],
    ['L0001', 'Yamal LNG', 'Novatek [E200002] 60%; New Gas Co [E200555] 40%', 16.5, 75.5, 71, 72],
    ['L0002', 'Names LNG', 'Novatek 60%; Shell 40%', 5, 10, 51, 143],
  ],
  Owners: [
    ['Project ID', 'Owner ID', 'Share'],
    ['P0001', 'E200001', 100],
  ],
});

const assetDraft = (kind: string, id: string, label: string) => ({
  table: 'GEM assets',
  modality: 'asserts',
  publisher: PUBLISHER,
  rows: {
    entity_type: 'facility',
    label,
    lookup: [{ key: 'gem_project_id', column: id }],
    geom: { lon: 'Longitude', lat: 'Latitude' },
    attrs: { gem_project_id: { column: id, cast: { type: 'identifier' } } } as Record<
      string,
      unknown
    >,
    constants: { asset_kind: kind },
  },
  relations: [] as unknown[],
});

test('an asset finds its operator company, an LNG owner cell with identifiers splits, and a cell of names does not', async () => {
  await inTransaction(async (held) => {
    await held.ask(PUT, [
      BOOK,
      `raw/${BOOK}.xlsx`,
      'https://tracker.test/hydrocarbons.xlsx',
      sha256(HC_BOOK),
      XLSX_MIME,
    ]);
    const open = () => Promise.resolve(bytesSource(HC_BOOK));
    const sets = { db: asQueryable(held), open };
    await makeTextSet(sets, {
      document: BOOK,
      sheet: ENTITY_SHEET,
      filter: { column: 'Country', value: 'Russia' },
    });
    for (const sheet of ['Assets', 'LNG', 'Owners'])
      await makeTextSet(sets, { document: BOOK, sheet });
    await approve(held);

    await runLoad(held, (await mapAndPromote(held, ENTITY_SET, COMPANY_DRAFT)).load);
    const idOf = (label: string): Promise<string> =>
      held.idOf('SELECT id FROM public.entities WHERE label = $1', [label]);
    const rosneftegaz = await idOf('Rosneftegaz');

    // An asset finds its operator company by the identifier of the company, and an operator that
    // the record does not hold goes to the report.
    const assets = assetDraft('pipeline_segment', 'Project ID', 'Unit name');
    assets.relations = [
      {
        type: 'operates',
        row_is: 'dst',
        other: { key: 'gem_entity_id', column: 'Operator ID' },
        other_type: 'company',
      },
    ];
    await runLoad(held, (await mapAndPromote(held, 'xlsx-1|sheet=Assets', assets)).load);
    const segmentA = await idOf('Segment A');
    expect(
      await held.ask(
        `SELECT s.label AS operator, d.label AS asset FROM public.relations r
           JOIN public.entities s ON s.id = r.src_id JOIN public.entities d ON d.id = r.dst_id
          WHERE r.type = 'operates' AND d.label LIKE 'Segment %'`,
      ),
    ).toStrictEqual([{ operator: 'Rosneftegaz', asset: 'Segment A' }]);
    expect(new TextDecoder().decode(held.stored[1]?.bytes)).toContain(
      'relation not loaded: the other end is not in the record',
    );

    // An owner cell with an identifier and a share for each owner splits. An owner that the record
    // lacks is created with its identifier. A group share stays an attribute.
    const lng = assetDraft('lng_plant', 'Terminal ID', 'Terminal');
    lng.rows.attrs = {
      ...lng.rows.attrs,
      capacity_mtpa: { column: 'Capacity', cast: { type: 'number', scale: 2 } },
      group_share_pct: { column: 'Group share', cast: { type: 'number', scale: 2 } },
    };
    lng.relations = [
      {
        type: 'owns',
        row_is: 'dst',
        other: { key: 'gem_entity_id', column: 'Owners' },
        other_type: 'company',
        split: { separator: ';' },
      },
    ];
    await runLoad(held, (await mapAndPromote(held, 'xlsx-1|sheet=LNG', lng)).load);
    expect(
      await held.ask(
        `SELECT s.label AS owner, d.label AS terminal,
                (r.attrs #>> '{share_pct,v}')::numeric::float8 AS share
           FROM public.relations r
           JOIN public.entities s ON s.id = r.src_id JOIN public.entities d ON d.id = r.dst_id
          WHERE r.type = 'owns' AND d.attrs ? 'asset_kind' ORDER BY s.label`,
      ),
    ).toStrictEqual([
      { owner: 'New Gas Co', terminal: 'Yamal LNG', share: 40 },
      { owner: 'Novatek', terminal: 'Yamal LNG', share: 60 },
    ]);
    expect(
      await held.ask(
        `SELECT e.attrs #>> '{gem_entity_id,v}' AS gem FROM public.entities e
          WHERE e.label = 'New Gas Co'`,
      ),
    ).toStrictEqual([{ gem: 'E200555' }]);
    // The terminal is a point with its capacity, and its group share is an attribute only.
    expect(
      await held.ask(
        `SELECT label, ST_GeometryType(geom) AS geometry, attrs #>> '{capacity_mtpa,v}' AS capacity,
                attrs #>> '{group_share_pct,v}' AS group_share
           FROM public.entities WHERE attrs @> '{"asset_kind":{"v":"lng_plant"}}' ORDER BY label`,
      ),
    ).toStrictEqual([
      { label: 'Names LNG', geometry: 'ST_Point', capacity: '5', group_share: '10' },
      { label: 'Yamal LNG', geometry: 'ST_Point', capacity: '16.5', group_share: '75.5' },
    ]);
    // A cell of names does not split: the terminal loads with no owner, and the report says why.
    expect(
      await held.ask(
        `SELECT count(*)::int AS links FROM public.relations r
           JOIN public.entities d ON d.id = r.dst_id WHERE d.label = 'Names LNG'`,
      ),
    ).toStrictEqual([{ links: 0 }]);
    expect(new TextDecoder().decode(held.stored[2]?.bytes)).toContain(
      'relation not loaded: the owner cell does not split: ""Novatek 60%""',
    );

    // The ownership sheet links a pipeline segment to its direct owner, by identifier.
    const owners = {
      table: 'GEM asset ownership',
      modality: 'asserts',
      publisher: PUBLISHER,
      rows: {
        relation_type: 'owns',
        src: {
          entity_type: 'company',
          lookup: [{ key: 'gem_entity_id', column: 'Owner ID' }],
        },
        dst: {
          entity_type: 'facility',
          lookup: [{ key: 'gem_project_id', column: 'Project ID' }],
        },
        attrs: { share_pct: { column: 'Share', cast: { type: 'number', scale: 4 } } },
      },
      relations: [],
    };
    await runLoad(held, (await mapAndPromote(held, 'xlsx-1|sheet=Owners', owners)).load);
    expect(
      await held.ask(
        `SELECT r.dst_id = $1 AS segment, r.src_id = $2 AS owner,
                (r.attrs #>> '{share_pct,v}')::numeric::float8 AS share
           FROM public.relations r WHERE r.type = 'owns' AND r.dst_id = $1`,
        [segmentA, rosneftegaz],
      ),
    ).toStrictEqual([{ segment: true, owner: true, share: 100 }]);
  });
});
