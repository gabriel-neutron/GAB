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
): Promise<{ mapping: string; load: string }> => {
  await storeFile(held, FILE, TEXT, '2026-10-25');
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

/** The load of the test, claimed by the worker role, so a test can call the door. */
const runningLoad = async (held: Held): Promise<string> => {
  const { load } = await mappedFile(held);
  const claimed = await held.asRole('gabriel_agent', () =>
    held.ask('SELECT job_id::text AS id FROM public.claim_job()'),
  );
  expect(claimed).toStrictEqual([{ id: load }]);
  return load;
};

const GERMAN_ROW = (() => {
  const start = TEXT.indexOf(
    'ESTAT:NRG_TI_GASM(1.0),23/10/26 23:00:00,M,G3000,RU,MIO_M3,DE,2022-01',
  );
  const end = TEXT.indexOf('\r\n', start);
  return {
    value_text: '4771.900',
    unit_text: 'MIO_M3',
    period_text: '2022-01',
    reporter_text: 'DE',
    partner_text: 'RU',
    product_text: 'G3000',
    flag_text: null,
    subject_id: null,
    text_extractor: TEXT_SET,
    page: 1,
    start,
    end,
  };
})();

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
  ['a value that the row does not hold', { value_text: '1' }, /value "1" as one field/u],
  ['a reporter that the row does not hold', { reporter_text: 'FR' }, /reporter "FR"/u],
  ['a period that the row does not hold', { period_text: '2019-01' }, /period "2019-01"/u],
  ['a unit that the row does not hold', { unit_text: 'TJ_GCV' }, /unit "TJ_GCV"/u],
  ['a span outside the page', { start: 0, end: 1_000_000 }, /outside the page/u],
  ['a page that is no number', { page: 'one' }, /whole numbers/u],
];

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
