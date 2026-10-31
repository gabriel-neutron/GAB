import { createHash } from 'node:crypto';

import type { RawObject } from '@gab/store';
import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { RunnerAgent } from '../agents.ts';
import { makeMapper } from '../mapper/mapper.ts';
import type { MapperConfig } from '../reader-config.ts';
import { completionOf, depsOf, routerOf, READER, type StubRouter } from '../runner-fixture.ts';
import { openRunner, type Step } from '../runner.ts';
import { dryJoin } from './dry-join.ts';
import { makeLoader } from './loader.ts';

// Seven rows of the SDMX-CSV file of the Eurostat dataset nrg_ti_gasm (imports of natural gas by
// partner country, monthly), as the API gave them on 25 October 2026 for the partner RU. The rows
// are copied word for word: a German month, Greece (EL), the EU total, a provisional value (p) and
// a missing value (m).
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 2 });

afterAll(async () => {
  await pool.end();
});

const FILE = 'doc_estat_gasm';
const TEXT_SET = 'csv-fixture@1';
const SDMX_CSV = 'application/vnd.sdmx.data+csv; version=1.0.0';
const URI = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/nrg_ti_gasm/M..RU..';

const TEXT =
  [
    'DATAFLOW,LAST UPDATE,freq,siec,partner,unit,geo,TIME_PERIOD,OBS_VALUE,OBS_FLAG,CONF_STATUS',
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,DE,2022-01,4771.900,,',
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,DE,2022-02,4488.998,,',
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,EL,2022-01,0.000,,',
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,EU27_2020,2022-01,7046.244,,',
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,IT,2026-09,0.000,p,',
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,MD,2026-01,,m,',
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,ZZ,2022-01,1.000,,',
  ].join('\r\n') + '\r\n';

const CONFIG: MapperConfig = { model: READER, tokenCap: 10_000 };

// What the model gives for the table.
const DRAFT = {
  table: 'nrg_ti_gasm',
  modality: 'asserts',
  publisher: 'Eurostat',
  rows: {
    measure: 'imports_natural_gas',
    value: { column: 'OBS_VALUE' },
    unit: { column: 'unit' },
    period: { column: 'TIME_PERIOD', length: 'month' },
    reporter: { column: 'geo', codes: 'eurostat' },
    partner: { column: 'partner', codes: 'eurostat' },
    product: { column: 'siec', system: 'siec' },
    method: 'imports reported by the importer',
    flag: 'OBS_FLAG',
  },
  relations: [],
};

// The closed list of licence words of the document providers, which a figure takes.
const LICENCES = [
  'public-domain',
  'eu-reuse',
  'ogl-v3',
  'cc0',
  'cc-by-4.0',
  'cc-by-nc-4.0',
  'odbl',
  'copernicus',
  'paid-filing',
  'registration-terms',
  'restricted',
  'commercial-no-redistribution',
  'own',
] as const;

const answerOf = (draft: unknown): Response => completionOf(JSON.stringify({ mapping: draft }));

const noModel = (): StubRouter =>
  routerOf(() => {
    throw new Error('the model was asked, and this test asks none');
  });

const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

const PUT = `SELECT public.put_document($1, 'url', 'Eurostat nrg_ti_gasm', $2, $3, NULL, $4, $5,
  $6::date)`;
const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1";

const one = z.array(z.object({ id: z.string().min(1) })).length(1);

interface Held {
  readonly client: PoolClient;
  readonly stored: RawObject[];
  readonly ask: (text: string, values?: unknown[]) => Promise<unknown[]>;
  readonly idOf: (text: string, values?: unknown[]) => Promise<string>;
  readonly step: (agent: RunnerAgent, router: StubRouter) => Promise<Step>;
  readonly asRole: <T>(role: string, work: () => Promise<T>) => Promise<T>;
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
      asRole,
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

const storeFile = async (held: Held, id: string, text: string, day: string): Promise<void> => {
  await held.ask(PUT, [id, `raw/${id}.csv`, URI, sha256(text), SDMX_CSV, day]);
  await held.ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    id,
    JSON.stringify([text]),
    TEXT_SET,
  ]);
};

// An act is never decided by the transaction that proposed it. The test dates the proposal back
// with the freeze trigger off, as the test of a legacy act does, and the rollback turns it on.
const fromAnEarlierTransaction = async (held: Held, id: string): Promise<void> => {
  await held.ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await held.ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id = $1", [id]);
  await held.ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
};

/** The file is stored, the model maps it, and the operator promotes the mapping. The answer is
 * the mapping and the load that the promotion queued. */
const mappedFile = async (
  held: Held,
  draft: unknown = DRAFT,
  provider: string | null = 'eurostat',
  text: string = TEXT,
): Promise<{ mapping: string; load: string }> => {
  await storeFile(held, FILE, text, '2026-10-25');
  // fetch_document names the provider of a file of the Eurostat API.
  if (provider !== null)
    await held.ask('SELECT public.fill_document_provider($1, $2)', [FILE, provider]);
  const job = await held.asRole('gabriel_app', () =>
    held.idOf("SELECT public.enqueue_job($1, 'map_structured') AS id", [FILE]),
  );
  await held.ask(OLDEST, [job]);
  expect(
    await held.step(
      makeMapper(CONFIG),
      routerOf(() => answerOf(draft)),
    ),
  ).toStrictEqual({ did: 'done', job });
  const mapping = await held.idOf(
    "SELECT id FROM public.proposals WHERE op = 'map_document' AND $1 = ANY (src::text[])",
    [FILE],
  );
  await fromAnEarlierTransaction(held, mapping);
  const load = await held.asRole('gabriel_app', () =>
    held.idOf("SELECT public.promote_unit($1::uuid, 'a test') AS id", [mapping]),
  );
  await held.ask(OLDEST, [load]);
  return { mapping, load };
};

const runLoad = async (held: Held, load: string): Promise<void> => {
  expect(await held.step(makeLoader({ store: storeOf(held) }), noModel())).toStrictEqual({
    did: 'done',
    job: load,
  });
};

const figureRow = z.object({
  reporter_system: z.string(),
  reporter: z.string(),
  partner: z.string().nullable(),
  period: z.string(),
  value: z.string(),
  unit: z.string(),
  product: z.string().nullable(),
  flag: z.string().nullable(),
  licence: z.string(),
  passage: z.string(),
});

const FIGURES = `SELECT o.reporter_system, o.reporter, o.partner, o.period, o.value::text AS value,
       o.unit, o.product, o.flag, o.licence,
       substr(t.text, o.span_start + 1, o.span_end - o.span_start) AS passage
  FROM public.observation o
  JOIN public.document_text t
    ON (t.document_id, t.extractor, t.page) = (o.document_id, o.text_extractor, o.page)
 WHERE o.document_id = $1 ORDER BY o.span_start`;

const figuresOf = async (held: Held, document = FILE) =>
  z.array(figureRow).parse(await held.ask(FIGURES, [document]));

const reportText = (held: Held): string => {
  const [report] = held.stored;
  return report === undefined ? '' : new TextDecoder().decode(report.bytes);
};

test('a promoted mapping of a Eurostat table loads each row as a figure that cites its row', async () => {
  await inTransaction(async (held) => {
    const { load } = await mappedFile(held);

    // The operator reads the dry run before the load, and it writes nothing.
    const mapping = await held.idOf('SELECT mapping::text AS id FROM public.jobs WHERE id = $1', [
      load,
    ]);
    const dry = await held.asRole('gabriel_agent', () =>
      dryJoin({ query: async (text, values) => ({ rows: await held.ask(text, values) }) }, mapping),
    );
    expect(dry.split('\r\n')[0]).toContain('rows 7; figures 5; to the report 2');

    await runLoad(held, load);

    const rows = TEXT.split('\r\n');
    expect(await figuresOf(held)).toStrictEqual(
      [
        ['iso3166', 'DE', '2022-01', '4771.900', null, rows[1]],
        ['iso3166', 'DE', '2022-02', '4488.998', null, rows[2]],
        ['iso3166', 'GR', '2022-01', '0.000', null, rows[3]],
        ['group', 'EU27', '2022-01', '7046.244', null, rows[4]],
        ['iso3166', 'IT', '2026-09', '0.000', 'p', rows[5]],
      ].map(([system, reporter, period, value, flag, passage]) => ({
        reporter_system: system,
        reporter,
        partner: 'RU',
        period,
        value,
        unit: 'MIO_M3',
        product: 'G3000',
        flag,
        licence: 'eu-reuse',
        passage,
      })),
    );

    // The two rows that give no figure go to the report with their reason. No act waits.
    const report = reportText(held);
    expect(report).toContain('read 7; loaded 5; excluded 2; dropped 0');
    expect(report).toContain('the value is empty, and the source marks it ""m""');
    expect(report).toContain('the reporter ""ZZ"" is not a code of the area list (eurostat)');
    expect(
      await held.ask(
        "SELECT count(*)::int AS acts FROM public.proposals WHERE op <> 'map_document' AND $1 = ANY (src::text[])",
        [FILE],
      ),
    ).toStrictEqual([{ acts: 0 }]);
  });
});

// A world price has no reporter and no column of areas. Seven rows of the same shape as the Pink
// Sheet of the World Bank, after the title rows are skipped: a period, then one price.
const WORLD =
  ['Period,Crude oil Brent', '2023M01,82.5', '2023M02,83.1', '2023M03,'].join('\r\n') + '\r\n';

test('a mapping with no reporter loads figures of the world', async () => {
  await inTransaction(async (held) => {
    const world = {
      table: 'pink_sheet',
      modality: 'asserts',
      publisher: 'World Bank',
      rows: {
        measure: 'price_crude_oil_brent',
        value: { column: 'Crude oil Brent' },
        unit: { constant: 'USD per barrel' },
        period: { column: 'Period', length: 'month' },
        method: 'monthly average price',
      },
      relations: [],
    };
    const { load } = await mappedFile(held, world, null, WORLD);
    await runLoad(held, load);
    expect(
      await held.ask(
        `SELECT reporter_system, reporter, period, value::text AS value, licence
           FROM public.observation WHERE document_id = $1 ORDER BY period`,
        [FILE],
      ),
    ).toStrictEqual(
      [
        ['2023-01', '82.5'],
        ['2023-02', '83.1'],
      ].map(([period, value]) => ({
        reporter_system: null,
        reporter: null,
        period,
        value,
        licence: 'restricted',
      })),
    );
    expect(reportText(held)).toContain('read 3; loaded 2; excluded 1');
  });
});

// A wide table (ADR 0032): the months are columns, and the measures are rows. The labels repeat
// under different parents, an annual total sits between the months, a negative value is real, an
// empty cell is not applicable, and "-" is no data. The third row has a quoted label with a comma.
const WIDE =
  [
    'Section,Item,2018-01,2018-02,Total 2018,2018-03',
    'Total,Revenue,100.5,-3.2,97.3,-',
    'Oil,Revenue,40,,40,12.5',
    '"Other, misc",Revenue,7,8,15,9',
    'Gas,Revenue,1,1,2,1',
  ].join('\r\n') + '\r\n';

const WIDE_DRAFT = {
  table: 'revenue',
  modality: 'asserts',
  publisher: 'Ministry of Finance',
  rows: {
    wide: {
      rows: [
        { position: 1, measure: 'revenue_total' },
        { position: 2, measure: 'revenue_oil' },
        { position: 3, measure: 'revenue_other' },
      ],
    },
    unit: { constant: 'billion roubles' },
    method: 'monthly revenue',
  },
  relations: [],
};

test('a wide table loads one figure for each month cell, and each figure cites its cell', async () => {
  await inTransaction(async (held) => {
    const { mapping, load } = await mappedFile(held, WIDE_DRAFT, null, WIDE);
    const dry = await held.asRole('gabriel_agent', () =>
      dryJoin({ query: async (text, values) => ({ rows: await held.ask(text, values) }) }, mapping),
    );
    expect(dry.split('\r\n')[0]).toContain('cells 8; figures 7; to the report 1');

    await runLoad(held, load);
    const found = z
      .array(
        z.object({
          measure: z.string(),
          period: z.string(),
          value: z.string(),
          unit: z.string(),
          reporter: z.string().nullable(),
          passage: z.string(),
        }),
      )
      .parse(
        await held.ask(
          `SELECT o.measure, o.period, o.value::text AS value, o.unit, o.reporter,
                  substr(t.text, o.span_start + 1, o.span_end - o.span_start) AS passage
             FROM public.observation o
             JOIN public.document_text t
               ON (t.document_id, t.extractor, t.page) = (o.document_id, o.text_extractor, o.page)
            WHERE o.document_id = $1 ORDER BY o.measure, o.period`,
          [FILE],
        ),
      );
    expect(found.map((one) => [one.measure, one.period, one.value, one.passage])).toStrictEqual([
      ['revenue_oil', '2018-01', '40', '40'],
      ['revenue_oil', '2018-03', '12.5', '12.5'],
      ['revenue_other', '2018-01', '7', '7'],
      ['revenue_other', '2018-02', '8', '8'],
      ['revenue_other', '2018-03', '9', '9'],
      ['revenue_total', '2018-01', '100.5', '100.5'],
      ['revenue_total', '2018-02', '-3.2', '-3.2'],
    ]);
    expect(found.every((one) => one.unit === 'billion roubles' && one.reporter === null)).toBe(
      true,
    );
    const report = reportText(held);
    expect(report).toContain('read 8; loaded 7; excluded 1');
    expect(report).toContain('the source has no data for 2018-03');
  });
});

// A CSV with a label in quotes that holds a comma and a doubled quote, a quote inside a plain field,
// and text after a closing quote. The door reads each row with the rules of the table reader, so
// each label stays one field and a stray quote moves no record start.
const QUOTED =
  [
    'label,partner,unit,geo,TIME_PERIOD,OBS_VALUE,OBS_FLAG,siec',
    '"Gas, natural ""all""",RU,MIO_M3,DE,2023-05,12.5,p,G3000',
    'Pipe 5" steel,RU,MIO_M3,IT,2023-05,3,,G3000',
    '"a"b",RU,MIO_M3,NL,2023-05,4,,G3000',
    '"""Gas"",",RU,MIO_M3,BE,2023-05,5,,G3000',
    '"Gas, natural ""all""",RU,MIO_M3,FR,2023-05,7,,G3000',
  ].join('\r\n') + '\r\n';

test('a quoted field that holds a comma is one field, and the door reads each cell from its column', async () => {
  await inTransaction(async (held) => {
    const { load } = await mappedFile(held, DRAFT, 'eurostat', QUOTED);
    await runLoad(held, load);
    expect(
      await held.ask(
        `SELECT reporter, period, value::text AS value, unit, product, flag
           FROM public.observation WHERE document_id = $1 ORDER BY reporter`,
        [FILE],
      ),
    ).toStrictEqual([
      {
        reporter: 'BE',
        period: '2023-05',
        value: '5',
        unit: 'MIO_M3',
        product: 'G3000',
        flag: null,
      },
      {
        reporter: 'DE',
        period: '2023-05',
        value: '12.5',
        unit: 'MIO_M3',
        product: 'G3000',
        flag: 'p',
      },
      ...[
        ['FR', '7'],
        ['IT', '3'],
        ['NL', '4'],
      ].map(([reporter, value]) => ({
        reporter,
        period: '2023-05',
        value,
        unit: 'MIO_M3',
        product: 'G3000',
        flag: null,
      })),
    ]);
  });
});

const recordRow = z.array(z.object({ fields: z.array(z.string()).nullable() }));

// The reader of the door follows the table reader of the worker.
test.each([
  ['a CSV row', 'a, b ,c', false, true, ['a', 'b', 'c']],
  ['a quoted field with a comma and a doubled quote', '"x, ""y""",2', false, true, ['x, "y"', '2']],
  ['a TSV row keeps a quote and a comma', 'a "b",c\td', true, true, ['a "b",c', 'd']],
  ['two records as one', 'a,b\r\nc,d', false, true, null],
  ['two quoted records as one', '"a",b\r\n"c",d', false, true, null],
  ['a quote that never closes', '"a,b', false, true, null],
  [
    'a header after a mark of byte order and empty lines',
    '﻿\r\n\r\nA,B\r\n1,2',
    false,
    false,
    ['A', 'B'],
  ],
  ['a cell with the white space of JavaScript', ' 12.5　,x', false, true, ['12.5', 'x']],
] as const)('the door reads %s', async (_name, text, tab, whole, fields) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT public.table_record($1, $2, $3) AS fields', [
      text,
      tab,
      whole,
    ]);
    expect(recordRow.parse(rows)).toStrictEqual([{ fields }]);
  } finally {
    client.release();
  }
});

/** The load of the test, claimed by the worker role, so a test can call the door. */
const runningLoad = async (held: Held): Promise<string> => {
  const { load } = await mappedFile(held);
  const claimed = await held.asRole('gabriel_agent', () =>
    held.ask('SELECT job_id::text AS id FROM public.claim_job()'),
  );
  expect(claimed).toStrictEqual([{ id: load }]);
  return load;
};

const ROWS = TEXT.split('\r\n');

/** The span of one line of the file, as the loader gives it. */
const spanOf = (line: number) => {
  const start = TEXT.indexOf(ROWS[line] ?? '');
  return { start, end: start + (ROWS[line] ?? '').length };
};

const GERMAN_ROW = { subject_id: null, text_extractor: TEXT_SET, page: 1, ...spanOf(1) };

// The code and the sentence of a refusal of the door.
const faultOf = (call: Promise<unknown>): Promise<{ code: string; message: string }> =>
  call.then(
    () => ({ code: 'none', message: 'the door wrote the rows' }),
    (cause: unknown) => z.object({ code: z.string(), message: z.string() }).parse(cause),
  );

const putAsAgent = (held: Held, job: string, rows: unknown[]) =>
  held.asRole('gabriel_agent', () =>
    held.ask('SELECT item, outcome FROM public.put_observations($1::uuid, $2::jsonb)', [
      job,
      JSON.stringify(rows),
    ]),
  );

test('the door writes a figure once, and a second call with the same row writes nothing', async () => {
  await inTransaction(async (held) => {
    const job = await runningLoad(held);
    expect(await putAsAgent(held, job, [GERMAN_ROW])).toStrictEqual([
      { item: 1, outcome: 'written' },
    ]);
    expect(await putAsAgent(held, job, [GERMAN_ROW])).toStrictEqual([{ item: 1, outcome: 'held' }]);
  });
});

const REFUSALS: readonly (readonly [string, Record<string, unknown>, RegExp])[] = [
  ['the header as a row', spanOf(0), /value "OBS_VALUE" is not a number/u],
  ['a span that cuts the last field', { end: spanOf(1).end - 4 }, /line break/u],
  ['a span that cuts the first field', { start: spanOf(1).start + 1 }, /line break/u],
  ['two rows as one', { end: spanOf(2).end }, /not one record/u],
  ['a row with no value', spanOf(6), /value "" is not a number/u],
  ['a row with a code outside the list', spanOf(7), /reporter "ZZ"/u],
  ['a span outside the page', { start: 0, end: 1_000_000 }, /outside the page/u],
  ['a page that is no number', { page: 'one' }, /whole numbers/u],
];

// A quoted field can hold a line break, so a line of the page can be a part of a record.
const BROKEN =
  [
    'label,partner,unit,geo,TIME_PERIOD,OBS_VALUE,OBS_FLAG,siec',
    '"Gas',
    'x,RU,MIO_M3,FR,2023-06,9,,G3000',
    'y",RU,MIO_M3,DE,2023-05,12.5,p,G3000',
  ].join('\r\n') + '\r\n';

test('the door refuses a line inside a quoted field as a row', async () => {
  await inTransaction(async (held) => {
    const { load } = await mappedFile(held, DRAFT, 'eurostat', BROKEN);
    const claimed = await held.asRole('gabriel_agent', () =>
      held.ask('SELECT job_id::text AS id FROM public.claim_job()'),
    );
    expect(claimed).toStrictEqual([{ id: load }]);
    const line = 'x,RU,MIO_M3,FR,2023-06,9,,G3000';
    const start = BROKEN.indexOf(line);
    const fault = await faultOf(
      putAsAgent(held, load, [
        { subject_id: null, text_extractor: TEXT_SET, page: 1, start, end: start + line.length },
      ]),
    );
    expect(fault.code).toBe('22000');
    expect(fault.message).toMatch(/inside a quoted field/u);
  });
});

// A fault of the load is invalid_parameter_value, so the loader stops the job.
test('the door refuses a text set that the load does not read, as a fault of the load', async () => {
  await inTransaction(async (held) => {
    const job = await runningLoad(held);
    const fault = await faultOf(
      putAsAgent(held, job, [{ ...GERMAN_ROW, text_extractor: 'another-set' }]),
    );
    expect(fault.code).toBe('22023');
    expect(fault.message).toMatch(/which the load reads/u);
  });
});

// A fault of one row is data_exception, so the loader sends the row to the report.
test.each(REFUSALS)(
  'the door refuses %s as a fault of one row',
  async (_name, change, sentence) => {
    await inTransaction(async (held) => {
      const job = await runningLoad(held);
      const fault = await faultOf(putAsAgent(held, job, [{ ...GERMAN_ROW, ...change }]));
      expect(fault.code).toBe('22000');
      expect(fault.message).toMatch(sentence);
    });
  },
);

test('the door takes the licence from the provider of the document, and none gives restricted', async () => {
  await inTransaction(async (held) => {
    const { load } = await mappedFile(held, DRAFT, null);
    await runLoad(held, load);
    expect(
      await held.ask(
        'SELECT DISTINCT licence, publisher FROM public.observation WHERE document_id = $1',
        [FILE],
      ),
    ).toStrictEqual([{ licence: 'restricted', publisher: 'Eurostat' }]);
  });
});

test('the door refuses a role that does not run the load', async () => {
  await inTransaction(async (held) => {
    const { load } = await mappedFile(held);
    // A fault of the load is invalid_parameter_value, so the loader stops the job.
    const fault = await faultOf(putAsAgent(held, load, [GERMAN_ROW]));
    expect(fault.code).toBe('22023');
    expect(fault.message).toMatch(/no running load of an accepted mapping/u);
  });
});

test('no role writes the table of figures by hand', async () => {
  const found = z.array(z.object({ role: z.string(), held: z.boolean() }));
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.role, has_table_privilege(r.role, 'public.observation', 'INSERT, UPDATE, DELETE')
                      OR has_table_privilege(r.role, 'public.area_code', 'INSERT, UPDATE, DELETE') AS held
         FROM unnest(ARRAY['gabriel_agent','gabriel_app','gabriel_read','gabriel_research','gabriel_checker']) AS r(role)
        ORDER BY r.role`,
    );
    expect(found.parse(rows).every((one) => !one.held)).toBe(true);
  } finally {
    client.release();
  }
});

const readRow = z.object({ period: z.string(), value: z.string(), licence: z.string() });

const PUBLIC_READ = `SELECT period, value::text AS value, licence FROM api.observation
  WHERE reporter = 'DE' AND publisher = 'Eurostat' ORDER BY period, licence`;

test('the public read shows the newest edition of a figure, and only under an open licence', async () => {
  await inTransaction(async (held) => {
    const { load } = await mappedFile(held);
    await runLoad(held, load);

    // An older edition of the same table gives another value for January 2022: the read hides it.
    await storeFile(held, 'doc_estat_gasm_old', TEXT.replace('4771.900', '4700.000'), '2026-01-05');
    await held.ask(
      `INSERT INTO public.observation
         (measure, value, unit, period, method, publisher, reporter_system, reporter,
          partner_system, partner, product_system, product, licence, document_id, text_extractor,
          page, span_start, span_end, mapping_id, job_id)
       SELECT measure, 4700, unit, period, method, publisher, reporter_system, reporter,
              partner_system,
              partner, product_system, product, licence, 'doc_estat_gasm_old', text_extractor,
              page, span_start, span_end, mapping_id, job_id
         FROM public.observation WHERE document_id = $1 AND reporter = 'DE' AND period = '2022-01'`,
      [FILE],
    );
    // A figure under a restricted licence, for example UN Comtrade, is internal.
    await held.ask(
      `INSERT INTO public.observation
         (measure, value, unit, period, method, publisher, reporter_system, reporter,
          partner_system, partner, product_system, product, licence, document_id, text_extractor,
          page, span_start, span_end, mapping_id, job_id)
       SELECT measure, value, unit, '2023-01', method, publisher, reporter_system, reporter,
              partner_system,
              partner, product_system, product, 'restricted', document_id, text_extractor,
              page, span_start, span_end, mapping_id, job_id
         FROM public.observation WHERE document_id = $1 AND reporter = 'DE' AND period = '2022-01'`,
      [FILE],
    );

    const open = [
      { period: '2022-01', value: '4771.900', licence: 'eu-reuse' },
      { period: '2022-02', value: '4488.998', licence: 'eu-reuse' },
    ];
    expect(
      z.array(readRow).parse(await held.asRole('gabriel_read', () => held.ask(PUBLIC_READ))),
    ).toStrictEqual(open);
    expect(
      z.array(readRow).parse(await held.asRole('gabriel_agent', () => held.ask(PUBLIC_READ))),
    ).toStrictEqual([...open, { period: '2023-01', value: '4771.900', licence: 'restricted' }]);
  });
});

test('a licence word opens a figure exactly when it opens a document, and the lists agree', async () => {
  await inTransaction(async (held) => {
    const { load } = await mappedFile(held);
    await runLoad(held, load);
    const opened: Record<string, { figure: boolean; document: boolean }> = {};
    for (const [index, licence] of LICENCES.entries()) {
      const provider = `licence_test_${String(index)}`;
      const document = `doc_licence_${String(index)}`;
      await held.ask(
        'INSERT INTO public.document_provider (id, name, licence) VALUES ($1, $1, $2)',
        [provider, licence],
      );
      await storeFile(held, document, `${TEXT}# ${licence}\r\n`, '2026-10-25');
      await held.ask('UPDATE public.documents SET provider_id = $1 WHERE id = $2', [
        provider,
        document,
      ]);
      await held.ask(
        `INSERT INTO public.observation
           (measure, value, unit, period, method, publisher, reporter_system, reporter, licence,
            document_id, text_extractor, page, span_start, span_end, mapping_id, job_id)
         SELECT 'licence_probe', 1, 'MIO_M3', $4, 'probe', 'probe', 'iso3166', 'DE', $1, $2,
                text_extractor, page, span_start, span_end, mapping_id, job_id
           FROM public.observation WHERE document_id = $3 LIMIT 1`,
        [licence, document, FILE, String(2000 + index)],
      );
      const [tier] = z
        .array(z.object({ tier: z.string() }))
        .parse(await held.ask('SELECT public.document_tier($1) AS tier', [document]));
      const seen = await held.asRole('gabriel_read', () =>
        held.ask(
          "SELECT 1 FROM api.observation WHERE document_id = $1 AND measure = 'licence_probe'",
          [document],
        ),
      );
      opened[licence] = { figure: seen.length === 1, document: tier?.tier === 'cc-by' };
    }
    for (const [licence, held_] of Object.entries(opened))
      expect({ licence, ...held_ }).toStrictEqual({
        licence,
        figure: held_.document,
        document: held_.document,
      });
  });
});
