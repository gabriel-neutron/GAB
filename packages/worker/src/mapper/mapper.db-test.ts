import { createHash } from 'node:crypto';

import type { RawObject } from '@gab/store';
import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import type { RunnerAgent } from '../agents.ts';
import { makeLoader } from '../loader/loader.ts';
import type { MapperConfig } from '../reader-config.ts';
import { completionOf, depsOf, gatewayOf, READER, type StubGateway } from '../runner-fixture.ts';
import { openRunner, type Step } from '../runner.ts';
import { makeMapper } from './mapper.ts';

// Departure: each test runs in one transaction that rolls back, on one connection that signs as
// the owner to seed and to read, as gabriel_app to promote, and as gabriel_agent while the runner
// works.
const secrets = z.object({
  POSTGRES_PASSWORD: z.string().min(1),
  GABRIEL_DATABASE: z.literal('gabriel_test'),
});
const env = secrets.parse(process.env);
const pool = new Pool({
  connectionString: `postgresql://gabriel:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:5432/${env.GABRIEL_DATABASE}`,
  max: 2,
});

afterAll(async () => {
  await pool.end();
});

const LIST = 'doc_mapper_list';
const SECOND = 'doc_mapper_second';
const TEXT_SET = 'csv-fixture@1';

const NEW_IMO = '9100009';
const KNOWN_IMO = '9100011';
const SPARE_IMO = '9100023';
const OWNER = 'C-100';

const HEADER = 'Vessel Name,IMO No.,Flag State,Owner Number,Notes';

// Four rows. The first is new, the second has a bad check digit, the third has no name, and the
// fourth is a hull that the record holds, owned by a company that the record holds.
const ROWS = [
  `"Nayara Star",${NEW_IMO},Panama,${OWNER},"first, quoted"`,
  'Bad Hull,1234568,Liberia,,',
  `,${SPARE_IMO},Malta,,`,
  `Known Hull,${KNOWN_IMO},Togo,${OWNER},`,
];

const LIST_TEXT = [HEADER, ...ROWS].join('\r\n') + '\r\n';

const SECOND_TEXT = [HEADER, `Other Hull,${SPARE_IMO},Malta,,`].join('\n');

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const HEADER_SIG = sha256(JSON.stringify(HEADER.split(',')));

const codePoints = (text: string): number => Array.from(text).length;

/** Where a row of the list starts and ends, in code points of the page. */
const spanOf = (index: number): { start: number; end: number } => {
  const before = [HEADER, ...ROWS.slice(0, index)].map((line) => line + '\r\n').join('');
  const start = codePoints(before);
  return { start, end: start + codePoints(ROWS[index] ?? '') };
};

const CONFIG: MapperConfig = { model: READER, tokenCap: 10_000 };

// What the model gives. Code adds the signature of the header.
const DRAFT = {
  table: 'list.csv',
  modality: 'asserts',
  rows: {
    entity_type: 'vessel',
    label: 'Vessel Name',
    lookup: [{ key: 'imo', column: 'IMO No.' }],
    attrs: {
      imo: { column: 'IMO No.', cast: { type: 'identifier' } },
      flag: { column: 'Flag State', cast: { type: 'text' } },
    },
  },
  relations: [
    {
      type: 'owned_by',
      row_is: 'src',
      other: { key: 'imo_company_number', column: 'Owner Number' },
    },
  ],
};

const answerOf = (draft: unknown): Response => completionOf(JSON.stringify({ mapping: draft }));

const mapperAnswers = (): StubGateway => gatewayOf(() => answerOf(DRAFT));

const noModel = (): StubGateway =>
  gatewayOf(() => {
    throw new Error('the model was asked, and this test asks none');
  });

const PUT = `SELECT public.put_document($1, 'url', 'A list of hulls', $2, $3, NULL, $4, 'text/csv',
  '2026-10-01'::date)`;

const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1";

const one = z.array(z.object({ id: z.string().min(1) })).length(1);

const jobRow = z.object({
  status: z.string(),
  kind: z.string(),
  mapping: z.uuid().nullable(),
  failure_reason: z.string().nullable(),
});

interface Held {
  readonly client: PoolClient;
  readonly stored: RawObject[];
  readonly ask: (text: string, values?: unknown[]) => Promise<unknown[]>;
  readonly idOf: (text: string, values?: unknown[]) => Promise<string>;
  readonly job: (id: string) => Promise<z.infer<typeof jobRow>>;
  readonly step: (agent: RunnerAgent, gateway: StubGateway) => Promise<Step>;
  readonly asApp: <T>(work: () => Promise<T>) => Promise<T>;
}

const inTransaction = async (work: (held: Held) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ask = async (text: string, values: unknown[] = []): Promise<unknown[]> => {
      const found: { rows: unknown[] } = await client.query(text, values);
      return found.rows;
    };
    const idOf = async (text: string, values: unknown[] = []): Promise<string> =>
      one.parse(await ask(text, values))[0]?.id ?? '';
    const asRole = async <T>(role: string, inner: () => Promise<T>): Promise<T> => {
      await client.query(`SET LOCAL SESSION AUTHORIZATION ${role}`);
      try {
        return await inner();
      } finally {
        await client.query('RESET SESSION AUTHORIZATION');
      }
    };
    const job = async (id: string) =>
      jobRow.parse(
        (
          await ask('SELECT status, kind, mapping, failure_reason FROM public.jobs WHERE id = $1', [
            id,
          ])
        )[0],
      );
    const step = async (agent: RunnerAgent, gateway: StubGateway): Promise<Step> => {
      const { deps } = depsOf(client, [agent], gateway);
      return asRole('gabriel_agent', async () => (await openRunner(deps)).step());
    };
    await work({
      client,
      stored: [],
      ask,
      idOf,
      job,
      step,
      asApp: (inner) => asRole('gabriel_app', inner),
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

const seedDocument = async (held: Held, id: string, uri: string, text: string): Promise<string> => {
  await held.ask(PUT, [id, `raw/${id}.csv`, uri, sha256(text)]);
  await held.ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    id,
    JSON.stringify([text]),
    TEXT_SET,
  ]);
  const job = await held.idOf("SELECT public.enqueue_job($1, 'map_structured') AS id", [id]);
  await held.ask(OLDEST, [job]);
  return job;
};

// An act is never decided by the transaction that proposed it, and each test runs in one
// transaction that rolls back. The test dates the proposal back with the freeze trigger off, as
// the test of a legacy act does, and the rollback turns the trigger on again.
const fromAnEarlierTransaction = async (held: Held, id: string): Promise<void> => {
  await held.ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await held.ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id = $1", [id]);
  await held.ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
};

const promote = async (held: Held, id: string): Promise<string> => {
  await fromAnEarlierTransaction(held, id);
  return held.asApp(() =>
    held.idOf("SELECT public.promote_proposal($1::uuid, 'a test') AS id", [id]),
  );
};

/** An entity in the record, promoted from an act of the operator. */
const recorded = async (
  held: Held,
  type: string,
  label: string,
  attrs: Record<string, string>,
): Promise<string> => {
  const act = await held.asApp(() =>
    held.idOf(
      `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
      [
        JSON.stringify({
          type,
          label,
          attrs: Object.fromEntries(
            Object.entries(attrs).map(([key, v]) => [key, { v, src: ['manual'] }]),
          ),
        }),
      ],
    ),
  );
  return promote(held, act);
};

const mappingRows = z.array(
  z.object({
    id: z.uuid(),
    src: z.array(z.string()),
    target_kind: z.null(),
    model_call_id: z.uuid(),
    payload: z.looseObject({ header_sig: z.string(), table: z.string() }),
  }),
);

const mappingsOf = async (held: Held, document: string) =>
  mappingRows.parse(
    await held.ask(
      `SELECT id, src::text[] AS src, target_kind, model_call_id, payload
         FROM public.proposals WHERE op = 'map_document' AND $1 = ANY (src::text[])`,
      [document],
    ),
  );

const loadedRows = z.array(
  z.object({
    op: z.string(),
    target_id: z.uuid().nullable(),
    label: z.string().nullable(),
    src: z.array(z.string()),
    model_call_id: z.uuid(),
    batch_id: z.uuid().nullable(),
    start: z.number(),
    end: z.number(),
    passage: z.string(),
  }),
);

// Each act of a load, with the passage that its citation names in the stored page.
const loadedOf = async (held: Held, document: string) =>
  loadedRows.parse(
    await held.ask(
      `SELECT p.op, p.target_id, p.payload ->> 'label' AS label, p.src::text[] AS src,
              p.model_call_id, p.batch_id, c.start, c."end",
              substr(t.text, c.start + 1, c."end" - c.start) AS passage
         FROM public.proposals p
         JOIN public.citation c ON c.claim_id = p.id
         JOIN public.document_text t
           ON (t.document_id, t.extractor, t.page) = (c.doc_id, c.text_extractor, c.page)
        WHERE p.op <> 'map_document' AND $1 = ANY (p.src::text[]) AND p.author_role = 'gabriel_agent'
        ORDER BY c.start, p.op DESC`,
      [document],
    ),
  );

const reportRows = z.array(z.object({ id: z.string(), title: z.string(), s3_key: z.string() }));

const reportsOf = async (held: Held, document: string) =>
  reportRows.parse(
    await held.ask(
      `SELECT id, title, s3_key FROM public.documents
        WHERE kind = 'report' AND title LIKE '%' || $1 || '%' ORDER BY id`,
      [document],
    ),
  );

const COUNTS = `SELECT (SELECT count(*) FROM public.entities)::int AS entities,
  (SELECT count(*) FROM public.relations)::int AS relations`;

const callsOf = async (held: Held, job: string): Promise<number> =>
  z
    .array(z.object({ n: z.number() }))
    .parse(
      await held.ask('SELECT count(*)::int AS n FROM public.model_call WHERE job_id = $1', [job]),
    )[0]?.n ?? -1;

interface Mapped {
  readonly mapping: string;
  readonly load: string;
  readonly known: string;
  readonly owner: string;
}

/** The list, mapped by the model and promoted by the operator. Its load waits in the queue, and a
 * test that runs it makes it the oldest job first. */
const mappedList = async (held: Held): Promise<Mapped> => {
  const known = await recorded(held, 'vessel', 'Known Hull', { imo: KNOWN_IMO });
  const owner = await recorded(held, 'company', 'Owner Company', { imo_company_number: OWNER });
  const job = await seedDocument(held, LIST, 'https://www.lists.test/a.csv', LIST_TEXT);
  expect(await held.step(makeMapper(CONFIG), mapperAnswers())).toStrictEqual({ did: 'done', job });
  const [mapping] = await mappingsOf(held, LIST);
  if (mapping === undefined) throw new Error('the mapper proposed no mapping');
  return { mapping: mapping.id, load: await promote(held, mapping.id), known, owner };
};

test('a list whose header does not match gives one map_document act from the model', async () => {
  await inTransaction(async (held) => {
    const job = await seedDocument(held, LIST, 'https://www.lists.test/a.csv', LIST_TEXT);
    const bodies: string[] = [];
    const watched = gatewayOf((_call, body) => {
      bodies.push(body);
      return answerOf(DRAFT);
    });

    expect(await held.step(makeMapper(CONFIG), watched)).toStrictEqual({ did: 'done', job });

    const made = await mappingsOf(held, LIST);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({
      src: [LIST],
      target_kind: null,
      payload: { header_sig: HEADER_SIG, table: 'list.csv' },
    });
    expect(watched.chats()).toBe(1);
    // The model reads the header and the rows, as the sample tool gives them.
    expect(bodies[0]).toContain('Vessel Name');
    expect(bodies[0]).toContain('Nayara Star');
  });
});

test('a mapping that names a column the header lacks goes back to the model once', async () => {
  await inTransaction(async (held) => {
    const job = await seedDocument(held, LIST, 'https://www.lists.test/a.csv', LIST_TEXT);
    const wrong = { ...DRAFT, rows: { ...DRAFT.rows, label: 'Name of the vessel' } };
    const bodies: string[] = [];
    const gateway = gatewayOf((call, body) => {
      bodies.push(body);
      return answerOf(call === 1 ? wrong : DRAFT);
    });

    expect(await held.step(makeMapper(CONFIG), gateway)).toStrictEqual({ did: 'done', job });

    expect(gateway.chats()).toBe(2);
    expect(bodies[1]).toContain('the column \\"Name of the vessel\\" is not in the header');
    expect(await mappingsOf(held, LIST)).toHaveLength(1);
  });
});

test('a mapping that the tool refuses two times fails the job with the sentence of the tool', async () => {
  await inTransaction(async (held) => {
    const job = await seedDocument(held, LIST, 'https://www.lists.test/a.csv', LIST_TEXT);
    const wrong = { ...DRAFT, rows: { ...DRAFT.rows, label: 'Name of the vessel' } };
    const gateway = gatewayOf(() => answerOf(wrong));

    expect(await held.step(makeMapper(CONFIG), gateway)).toStrictEqual({ did: 'failed', job });

    expect((await held.job(job)).failure_reason).toMatch(
      /^the tool refused the mapping: the column "Name of the vessel" is not in the header/u,
    );
    expect(await mappingsOf(held, LIST)).toStrictEqual([]);
  });
});

test('a file that is not a csv fails with a sentence and asks no model', async () => {
  await inTransaction(async (held) => {
    const job = await seedDocument(held, LIST, 'https://www.lists.test/a.csv', LIST_TEXT);
    await held.ask("UPDATE public.documents SET mime = 'application/vnd.ms-excel' WHERE id = $1", [
      LIST,
    ]);
    const gateway = noModel();

    expect(await held.step(makeMapper(CONFIG), gateway)).toStrictEqual({ did: 'failed', job });
    expect((await held.job(job)).failure_reason).toMatch(/reads a CSV table only/u);
    expect(gateway.chats()).toBe(0);
  });
});

test('the promotion of the mapping writes nothing to the graph and queues load_mapped', async () => {
  await inTransaction(async (held) => {
    const before = await held.ask(COUNTS);
    const job = await seedDocument(held, LIST, 'https://www.lists.test/a.csv', LIST_TEXT);
    await held.step(makeMapper(CONFIG), mapperAnswers());
    const [mapping] = await mappingsOf(held, LIST);
    const load = await promote(held, mapping?.id ?? '');

    expect(await held.job(load)).toStrictEqual({
      status: 'queued',
      kind: 'load_mapped',
      mapping: mapping?.id,
      failure_reason: null,
    });
    expect(await held.ask(COUNTS)).toStrictEqual(before);
    expect(load).not.toBe(job);
  });
});

test('the load proposes each row that fits, cited by the span of the row, and reports the rest', async () => {
  await inTransaction(async (held) => {
    const mapped = await mappedList(held);
    await held.ask(OLDEST, [mapped.load]);
    const [mapping] = await mappingsOf(held, LIST);

    expect(await held.step(makeLoader({ store: storeOf(held) }), noModel())).toStrictEqual({
      did: 'done',
      job: mapped.load,
    });

    const loaded = await loadedOf(held, LIST);
    expect(loaded.map((row) => [row.op, row.label, row.target_id])).toStrictEqual([
      ['create_relation', null, null],
      ['create_entity', 'Nayara Star', null],
      ['update_attrs', null, mapped.known],
      ['create_relation', null, null],
    ]);
    // Each act of a row cites the row, names the document and carries the call of the mapping.
    expect(loaded.map((row) => [row.start, row.end])).toStrictEqual([
      [spanOf(0).start, spanOf(0).end],
      [spanOf(0).start, spanOf(0).end],
      [spanOf(3).start, spanOf(3).end],
      [spanOf(3).start, spanOf(3).end],
    ]);
    expect(loaded.map((row) => row.passage)).toStrictEqual([ROWS[0], ROWS[0], ROWS[3], ROWS[3]]);
    for (const row of loaded) {
      expect(row.src).toStrictEqual([LIST]);
      expect(row.model_call_id).toBe(mapping?.model_call_id);
    }
    // The new hull and its owner link are one batch, because the link names the hull.
    expect(loaded[0]?.batch_id).not.toBeNull();
    expect(loaded[0]?.batch_id).toBe(loaded[1]?.batch_id);
    expect(await callsOf(held, mapped.load)).toBe(0);

    const reports = await reportsOf(held, LIST);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.title).toMatch(/4 rows read, 2 loaded, 2 excluded/u);
    expect(held.stored).toHaveLength(1);
    const lines = new TextDecoder().decode(held.stored[0]?.bytes).trim().split('\r\n');
    expect(lines[0]).toBe(
      `# document ${LIST}; mapping ${mapped.mapping}; job ${mapped.load}; read 4; loaded 2; excluded 2`,
    );
    expect(lines[1]).toBe('row,page,start,end,reason');
    expect(lines.slice(2)).toStrictEqual([
      expect.stringMatching(new RegExp(`^2,1,${String(spanOf(1).start)},.*check digit`, 'u')),
      expect.stringMatching(new RegExp(`^3,1,${String(spanOf(2).start)},.*empty`, 'u')),
    ]);
    expect(held.stored[0]?.key).toBe(reports[0]?.s3_key);
  });
});

test('a load that runs two times writes each act and the report once', async () => {
  await inTransaction(async (held) => {
    const mapped = await mappedList(held);
    await held.ask(OLDEST, [mapped.load]);
    const loader = makeLoader({ store: storeOf(held) });
    const twice: RunnerAgent = {
      ...loader,
      run: async (context) => {
        await loader.run(context);
        return loader.run(context);
      },
    };

    expect(await held.step(twice, noModel())).toStrictEqual({ did: 'done', job: mapped.load });

    expect(await loadedOf(held, LIST)).toHaveLength(4);
    expect(await reportsOf(held, LIST)).toHaveLength(1);
  });
});

const pendingActs = z.array(z.object({ id: z.uuid(), batch_id: z.uuid().nullable() }));

/** The operator promotes each act that the first load proposed, a batch as one unit. */
const promoteAllOfTheLoad = async (held: Held): Promise<void> => {
  await held.ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await held.ask(
    `UPDATE public.proposals SET xact = '1'::xid8
      WHERE author_role = 'gabriel_agent' AND op <> 'map_document' AND status = 'pending'`,
  );
  await held.ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
  const pending = pendingActs.parse(
    await held.ask(
      `SELECT id, batch_id FROM public.proposals
        WHERE author_role = 'gabriel_agent' AND op <> 'map_document' AND status = 'pending'
        ORDER BY created_at, id`,
    ),
  );
  const decided = new Set<string>();
  for (const act of pending) {
    if (act.batch_id === null)
      await held.asApp(() =>
        held.ask("SELECT public.promote_proposal($1::uuid, 'a test')", [act.id]),
      );
    else if (!decided.has(act.batch_id)) {
      decided.add(act.batch_id);
      await held.asApp(() =>
        held.ask("SELECT public.decide_batch($1::uuid, 'promote', 'a test')", [act.batch_id]),
      );
    }
  }
};

test('a load after the promotion of the first one proposes no act that changes nothing', async () => {
  await inTransaction(async (held) => {
    const mapped = await mappedList(held);
    await held.ask(OLDEST, [mapped.load]);
    const loader = makeLoader({ store: storeOf(held) });
    await held.step(loader, noModel());
    const first = await loadedOf(held, LIST);
    await promoteAllOfTheLoad(held);
    const graph = await held.ask(COUNTS);

    const again = await held.idOf(
      `INSERT INTO public.jobs (document_id, kind, mapping) VALUES ($1, 'load_mapped', $2::uuid)
       RETURNING id::text AS id`,
      [LIST, mapped.mapping],
    );
    await held.ask(OLDEST, [again]);
    expect(await held.step(loader, noModel())).toStrictEqual({ did: 'done', job: again });

    expect(await loadedOf(held, LIST)).toHaveLength(first.length);
    expect(await held.ask(COUNTS)).toStrictEqual(graph);
    expect(await reportsOf(held, LIST)).toHaveLength(2);
    expect(held.stored[1]?.bytes).toBeDefined();
    const lines = new TextDecoder().decode(held.stored[1]?.bytes).split('\r\n');
    expect(lines[0]).toMatch(/read 4; loaded 2; excluded 2$/u);
  });
});

test('two loads give two reports, each with its own title and counts', async () => {
  await inTransaction(async (held) => {
    const mapped = await mappedList(held);
    await seedDocument(held, SECOND, 'https://lists.test/b.csv', SECOND_TEXT);
    await held.step(makeMapper(CONFIG), noModel());
    const loads = z
      .array(z.object({ id: z.uuid() }))
      .parse(await held.ask("SELECT id FROM public.jobs WHERE kind = 'load_mapped'"));
    expect(loads).toHaveLength(2);
    for (const load of loads) await held.ask(OLDEST, [load.id]);
    const loader = makeLoader({ store: storeOf(held) });

    await held.step(loader, noModel());
    await held.step(loader, noModel());

    const first = await reportsOf(held, LIST);
    const other = await reportsOf(held, SECOND);
    expect(first).toHaveLength(1);
    expect(other).toHaveLength(1);
    expect(first[0]?.id).not.toBe(other[0]?.id);
    expect(first[0]?.title).toMatch(/4 rows read, 2 loaded, 2 excluded/u);
    expect(other[0]?.title).toMatch(/1 rows read, 1 loaded, 0 excluded/u);
    expect(mapped.load).toBeTruthy();
  });
});

test('a second file of the same host and header reuses the mapping and asks no model', async () => {
  await inTransaction(async (held) => {
    const mapped = await mappedList(held);
    const job = await seedDocument(held, SECOND, 'https://lists.test/b.csv', SECOND_TEXT);
    const gateway = noModel();

    expect(await held.step(makeMapper(CONFIG), gateway)).toStrictEqual({ did: 'done', job });

    expect(gateway.chats()).toBe(0);
    expect(await callsOf(held, job)).toBe(0);
    expect(await mappingsOf(held, SECOND)).toStrictEqual([]);
    const queued = await held.ask(
      "SELECT mapping, status FROM public.jobs WHERE document_id = $1 AND kind = 'load_mapped'",
      [SECOND],
    );
    expect(queued).toStrictEqual([{ mapping: mapped.mapping, status: 'queued' }]);
  });
});

test('a second file of another host gets a new mapping act', async () => {
  await inTransaction(async (held) => {
    await mappedList(held);
    const job = await seedDocument(held, SECOND, 'https://other.test/b.csv', SECOND_TEXT);
    const gateway = mapperAnswers();

    expect(await held.step(makeMapper(CONFIG), gateway)).toStrictEqual({ did: 'done', job });
    expect(gateway.chats()).toBe(1);
    expect(await mappingsOf(held, SECOND)).toHaveLength(1);
  });
});

test('a load of a file whose header differs fails with a sentence and writes nothing', async () => {
  await inTransaction(async (held) => {
    const mapped = await mappedList(held);
    const mapJob = await seedDocument(
      held,
      SECOND,
      'https://lists.test/b.csv',
      'Name,IMO\nOther Hull,9100023\n',
    );
    await held.ask('UPDATE public.jobs SET created_at = now() WHERE id = $1', [mapJob]);
    const load = await held.idOf(
      `INSERT INTO public.jobs (document_id, kind, mapping) VALUES ($1, 'load_mapped', $2::uuid)
       RETURNING id::text AS id`,
      [SECOND, mapped.mapping],
    );
    await held.ask(OLDEST, [load]);

    expect(await held.step(makeLoader({ store: storeOf(held) }), noModel())).toStrictEqual({
      did: 'failed',
      job: load,
    });
    expect((await held.job(load)).failure_reason).toMatch(/is not the header of mapping/u);
    expect(await loadedOf(held, SECOND)).toStrictEqual([]);
  });
});
