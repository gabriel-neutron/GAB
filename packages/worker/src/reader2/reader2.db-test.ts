import { openModel, type AgentModel, type Model } from '@gab/model';
import { CATALOGUE } from '@gab/tools/catalogue';
import { callTool } from '@gab/tools/tool';
import { Pool, type PoolClient } from 'pg';
import { afterAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import type { RunnerAgent } from '../agents.ts';
import { makeExtractor } from '../extractor/extractor.ts';
import type { ReaderConfig } from '../reader-config.ts';
import {
  completionOf,
  gatewayOf,
  quotaSpentResponse,
  STUB_MODEL,
  type StubGateway,
} from '../runner-fixture.ts';
import { openRunner, type Step } from '../runner.ts';
import { makeReader2 } from './reader2.ts';

// Departure: each test runs in one transaction that rolls back, on one connection that signs as
// the owner to seed and to read, and as gabriel_agent while the runner works.
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

const GATEWAY_ENV = {
  FREELLMAPI_API_KEY: 'a-stub-key',
  FREELLMAPI_BASE_URL: 'http://100.64.0.1:4001/v1',
};

const DOCUMENT = 'doc_reader2_suite';
const TEXT_SET = 'pdf-fixture@1';

// The page is longer than the cap, so it gives two chunks, and the second starts at CAP.
const FIRST_CHUNK = 'The tanker Nayara left Sikka. ';
const SECOND_CHUNK = 'Rosneft owns it.';
const CAP = Array.from(FIRST_CHUNK).length;
const PAGES = [FIRST_CHUNK + SECOND_CHUNK];

// The first reader puts this string in each of its answers. The second reader must never see it.
const MARKER = 'R1-OUTPUT-MARKER';

const EXTRACTOR_CONFIG: ReaderConfig = {
  model: STUB_MODEL,
  family: 'stub-family',
  tokenCap: 10_000,
  turnCap: 10,
  chunkCap: CAP,
};

const READER2_MODEL: AgentModel = { ...STUB_MODEL, model: 'other-family/other-model' };

const READER2_CONFIG: ReaderConfig = {
  model: READER2_MODEL,
  family: 'other-family',
  tokenCap: 10_000,
  turnCap: 10,
  chunkCap: CAP,
};

const identity = (text: string): string => text;

const extractor = (): RunnerAgent => makeExtractor(EXTRACTOR_CONFIG, { minimise: identity });
const reader2 = (prompt?: string): RunnerAgent =>
  makeReader2(READER2_CONFIG, {
    minimise: identity,
    ...(prompt === undefined ? {} : { prompt }),
  });

const NAYARA = FIRST_CHUNK.indexOf('Nayara');

// The first reader names the vessel with the marker, so its proposal holds the marker.
const firstAnswers = (): StubGateway =>
  gatewayOf((call) =>
    completionOf(
      JSON.stringify({
        claims: [
          call % 2 === 1
            ? {
                act: { op: 'create_entity', type: 'vessel', label: `Nayara ${MARKER}` },
                page: 1,
                start: NAYARA,
                end: NAYARA + 'Nayara'.length,
                modality: 'asserts',
              }
            : {
                act: { op: 'create_entity', type: 'company', label: `Rosneft ${MARKER}` },
                page: 1,
                start: 0,
                end: 'Rosneft'.length,
                modality: 'attributes',
              },
        ],
      }),
    ),
  );

// The second reader gives one reading for each chunk, so each chunk holds a row of its own.
// The first chunk is a planted disagreement: another span and another modality.
const secondAnswers = (): StubGateway =>
  gatewayOf((call) =>
    completionOf(
      JSON.stringify({
        claims: [
          call % 2 === 1
            ? { page: 1, start: 0, end: 'The tanker'.length, modality: 'denies' }
            : { page: 1, start: 0, end: 'Rosneft'.length, modality: 'attributes', adverse: true },
        ],
      }),
      READER2_MODEL.model,
    ),
  );

const PUT = `SELECT public.put_document($1, 'file', 'A test of the second reader',
  'raw/reader2-suite.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-01'::date)`;

const jobRow = z.object({
  status: z.string(),
  attempts: z.number().int(),
  failure_reason: z.string().nullable(),
});

interface Seen {
  readonly bodies: string[];
}

interface Held {
  readonly client: PoolClient;
  readonly first: string;
  readonly second: string;
  readonly read: (job: string) => Promise<z.infer<typeof jobRow>>;
  readonly step: (
    agents: readonly RunnerAgent[],
    gateways: { readonly first: StubGateway; readonly second: StubGateway },
    seen?: Seen,
  ) => Promise<Step>;
  readonly oldest: (job: string) => Promise<void>;
  readonly expire: (job: string) => Promise<void>;
}

const one = z.array(z.object({ id: z.uuid() })).length(1);

const inTransaction = async (work: (held: Held) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(PUT, [DOCUMENT]);
    await client.query('SELECT public.put_document_text($1, $2::jsonb, $3)', [
      DOCUMENT,
      JSON.stringify(PAGES),
      TEXT_SET,
    ]);
    const enqueue = async (kind: string): Promise<string> =>
      one.parse(
        (await client.query('SELECT public.enqueue_job($1, $2) AS id', [DOCUMENT, kind])).rows,
      )[0]?.id ?? '';
    const first = await enqueue('extract_text');
    const second = await enqueue('second_read');

    // Each job of the suite is older than every row of the shared queue, and the given one is
    // the oldest of the two.
    const oldest = async (job: string): Promise<void> => {
      await client.query(
        "UPDATE public.jobs SET created_at = '1970-01-02' WHERE id = ANY($1::uuid[])",
        [[first, second]],
      );
      await client.query("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [job]);
    };

    const read = async (job: string) =>
      jobRow.parse(
        (
          await client.query(
            'SELECT status, attempts, failure_reason FROM public.jobs WHERE id = $1',
            [job],
          )
        ).rows[0],
      );

    const step: Held['step'] = async (agents, gateways, seen) => {
      const open = (settings: AgentModel): Model => {
        const gateway = settings.model === READER2_MODEL.model ? gateways.second : gateways.first;
        return openModel(
          settings,
          (url, init) => {
            if (gateway === gateways.second && typeof init.body === 'string')
              seen?.bodies.push(init.body);
            return gateway.send(url, init);
          },
          GATEWAY_ENV,
        );
      };
      await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
      try {
        const runner = await openRunner({
          db: client,
          agents,
          sleep: () => Promise.resolve(),
          now: () => 0,
          open,
        });
        return await runner.step();
      } finally {
        await client.query('RESET SESSION AUTHORIZATION');
      }
    };

    const expire = async (job: string): Promise<void> => {
      await client.query(
        "UPDATE public.jobs SET claimed_at = now() - interval '2 hours' WHERE id = $1",
        [job],
      );
      await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_app');
      await client.query('SELECT public.release_expired_claims()');
      await client.query('RESET SESSION AUTHORIZATION');
    };

    await work({ client, first, second, read, step, oldest, expire });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const readings = z.array(
  z.object({
    claim_id: z.uuid().nullable(),
    start: z.number(),
    end: z.number(),
    modality: z.string(),
    adverse: z.boolean(),
    reader_no: z.number(),
    reader_kind: z.string(),
    model_call_id: z.uuid(),
    reader_fingerprint: z.string(),
    idempotency_key: z.string(),
  }),
);

const readingsOf = async (held: Held, job: string) =>
  readings.parse(
    (
      await held.client.query(
        `SELECT claim_id, start, "end", modality, adverse, reader_no, reader_kind, model_call_id,
                reader_fingerprint, idempotency_key
           FROM public.claim_reading WHERE job_id = $1 ORDER BY start, "end"`,
        [job],
      )
    ).rows,
  );

const proposalsOf = async (held: Held): Promise<unknown[]> =>
  z.array(z.unknown()).parse(
    (
      await held.client.query(
        `SELECT to_jsonb(p) AS row FROM api.proposal p WHERE $1 = ANY (p.src::text[])
        ORDER BY p.created_at, p.id`,
        [DOCUMENT],
      )
    ).rows,
  );

const servedOf = async (held: Held, job: string): Promise<string[]> =>
  z
    .array(z.object({ outcome: z.string() }))
    .parse(
      (
        await held.client.query(
          'SELECT outcome FROM public.model_call WHERE job_id = $1 ORDER BY created_at',
          [job],
        )
      ).rows,
    )
    .map((row) => row.outcome);

const SECOND_ROWS = [
  {
    claim_id: null,
    start: 0,
    end: 'The tanker'.length,
    modality: 'denies',
    adverse: false,
    reader_no: 2,
    reader_kind: 'llm',
  },
  {
    claim_id: null,
    start: CAP,
    end: CAP + 'Rosneft'.length,
    modality: 'attributes',
    adverse: true,
    reader_no: 2,
    reader_kind: 'llm',
  },
];

describe('the blind second reading', () => {
  test('the second reader receives no output of the first reader when the first is complete', async () => {
    await inTransaction(async (held) => {
      const gateways = { first: firstAnswers(), second: secondAnswers() };
      const agents = [extractor(), reader2()];
      const seen: Seen = { bodies: [] };

      await held.oldest(held.first);
      expect(await held.step(agents, gateways, seen)).toStrictEqual({
        did: 'done',
        job: held.first,
      });
      expect(JSON.stringify(await proposalsOf(held))).toContain(MARKER);

      expect(await held.step(agents, gateways, seen)).toStrictEqual({
        did: 'done',
        job: held.second,
      });
      expect(seen.bodies).toHaveLength(2);
      for (const body of seen.bodies) {
        expect(body).not.toContain(MARKER);
        expect(body).not.toContain('"tools"');
      }
      expect(seen.bodies.join('\n')).toContain('Rosneft owns it.');

      const first = await readingsOf(held, held.first);
      const second = await readingsOf(held, held.second);
      expect(first).toHaveLength(2);
      expect(second).toMatchObject(SECOND_ROWS);
      for (const row of second)
        expect(row.reader_fingerprint).toMatch(/^other-family\/other-model [0-9a-f]{64}$/u);
      const keys = [...first, ...second].map((row) => row.idempotency_key);
      expect(new Set(keys).size).toBe(4);
    });
  });

  test('the second reader receives the same bytes when the first reader has not started', async () => {
    const runs: string[][] = [];
    for (const firstRuns of [true, false])
      await inTransaction(async (held) => {
        const gateways = { first: firstAnswers(), second: secondAnswers() };
        const agents = [extractor(), reader2()];
        const seen: Seen = { bodies: [] };
        if (firstRuns) {
          await held.oldest(held.first);
          await held.step(agents, gateways);
        } else await held.oldest(held.second);

        expect(await held.step(agents, gateways, seen)).toStrictEqual({
          did: 'done',
          job: held.second,
        });
        if (!firstRuns) expect(gateways.first.chats()).toBe(0);
        expect(await readingsOf(held, held.second)).toMatchObject(SECOND_ROWS);
        runs.push(seen.bodies);
      });
    expect(runs[0]).toHaveLength(2);
    expect(runs[1]).toStrictEqual(runs[0]);
  });

  test('a planted disagreement changes no proposal and no order of the queue', async () => {
    await inTransaction(async (held) => {
      const gateways = { first: firstAnswers(), second: secondAnswers() };
      const agents = [extractor(), reader2()];
      await held.oldest(held.first);
      await held.step(agents, gateways);
      const before = await proposalsOf(held);
      expect(before).toHaveLength(2);

      expect(await held.step(agents, gateways)).toStrictEqual({ did: 'done', job: held.second });
      expect((await readingsOf(held, held.second))[0]?.modality).toBe('denies');
      expect((await readingsOf(held, held.first))[0]?.modality).toBe('asserts');
      expect(await proposalsOf(held)).toStrictEqual(before);
    });
  });
});

describe('a requeued second reading', () => {
  const dies = (agent: RunnerAgent): RunnerAgent => {
    let runs = 0;
    return {
      ...agent,
      run: async (context) => {
        runs += 1;
        const result = await agent.run(context);
        if (runs === 1) throw new Error('the worker stopped after it wrote');
        return result;
      },
    };
  };

  test('makes no model call and gives no second row', async () => {
    await inTransaction(async (held) => {
      const gateways = { first: firstAnswers(), second: secondAnswers() };
      const agents = [extractor(), dies(reader2())];
      await held.oldest(held.second);

      expect(await held.step(agents, gateways)).toStrictEqual({ did: 'left', job: held.second });
      const written = await readingsOf(held, held.second);
      expect(written).toHaveLength(2);
      expect(gateways.second.chats()).toBe(2);

      await held.expire(held.second);
      expect(await held.step(agents, gateways)).toStrictEqual({ did: 'done', job: held.second });
      expect(gateways.second.chats()).toBe(2);
      expect(await readingsOf(held, held.second)).toStrictEqual(written);
    });
  });

  test('with a changed prompt file gives a new prompt hash and new rows', async () => {
    await inTransaction(async (held) => {
      const gateways = { first: firstAnswers(), second: secondAnswers() };
      await held.oldest(held.second);

      expect(await held.step([extractor(), dies(reader2())], gateways)).toStrictEqual({
        did: 'left',
        job: held.second,
      });
      const written = await readingsOf(held, held.second);

      await held.expire(held.second);
      const changed = [extractor(), reader2('Read the chunk, and give each span.')];
      expect(await held.step(changed, gateways)).toStrictEqual({ did: 'done', job: held.second });
      expect(gateways.second.chats()).toBe(4);

      const all = await readingsOf(held, held.second);
      expect(all).toHaveLength(4);
      const fingerprints = new Set(all.map((row) => row.reader_fingerprint));
      expect(fingerprints.size).toBe(2);
      expect(new Set(all.map((row) => row.idempotency_key)).size).toBe(4);
      for (const row of written) expect(all).toContainEqual(row);
    });
  });
});

describe('a failure of the second family', () => {
  const outage = (): StubGateway => gatewayOf(() => new Response('down', { status: 503 }));
  const quota = (): StubGateway => gatewayOf(quotaSpentResponse);
  const mismatch = (): StubGateway =>
    gatewayOf(() =>
      completionOf(
        JSON.stringify({ claims: [{ page: 1, start: 0, end: 3, modality: 'asserts' }] }),
        'other-family/a-model-nobody-pinned',
      ),
    );

  for (const [name, gateway, reason, outcome] of [
    ['an outage', outage, 'outage', 'network'],
    ['a spent quota', quota, 'quota', 'quota'],
    ['a served model that is not the pinned model', mismatch, 'model_mismatch', 'served_other'],
  ] as const)
    test(`${name} releases the job with the reason ${reason}, writes nothing and falls back to no model`, async () => {
      await inTransaction(async (held) => {
        const gateways = { first: firstAnswers(), second: gateway() };
        await held.oldest(held.second);

        expect(await held.step([extractor(), reader2()], gateways)).toStrictEqual({
          did: 'released',
          job: held.second,
          reason,
        });
        expect(await held.read(held.second)).toMatchObject({ status: 'queued', attempts: 0 });
        expect(await readingsOf(held, held.second)).toStrictEqual([]);
        expect(await proposalsOf(held)).toStrictEqual([]);
        expect(gateways.first.chats()).toBe(0);
        expect(gateways.second.chats()).toBeGreaterThan(0);
        expect(new Set(await servedOf(held, held.second))).toStrictEqual(new Set([outcome]));
      });
    });

  for (const [name, call] of [
    [
      'document_text for another document',
      { name: 'document_text', arguments: '{"document":"doc_another"}' },
    ],
    [
      'propose_change',
      {
        name: 'propose_change',
        arguments:
          '{"act":{"op":"create_entity","type":"vessel","label":"X"},"documents":["doc_reader2_suite"]}',
      },
    ],
  ] as const)
    test(`a tool call of ${name} runs no tool and writes no row`, async () => {
      await inTransaction(async (held) => {
        const calls = gatewayOf(
          () =>
            new Response(
              JSON.stringify({
                model: READER2_MODEL.model,
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: '',
                      tool_calls: [{ id: 'call-1', function: call }],
                    },
                    finish_reason: 'tool_calls',
                  },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
              }),
              { status: 200 },
            ),
        );
        const gateways = { first: firstAnswers(), second: calls };
        await held.oldest(held.second);

        expect(await held.step([extractor(), reader2()], gateways)).toStrictEqual({
          did: 'left',
          job: held.second,
        });
        expect(await readingsOf(held, held.second)).toStrictEqual([]);
        expect(await proposalsOf(held)).toStrictEqual([]);
        expect(gateways.first.chats()).toBe(0);
      });
    });
});

const enqueueExtract = CATALOGUE.find((tool) => tool.name === 'enqueue_extract');

describe('the enqueue of a second reading', () => {
  const kinds = z.array(z.object({ kind: z.string(), status: z.string() }));

  test('enqueue_extract queues a second_read job beside the extract_text job', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(PUT, [DOCUMENT]);
      await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
      if (enqueueExtract === undefined) throw new Error('the catalogue holds no enqueue_extract');
      const outcome = await callTool(
        enqueueExtract,
        { query: (text, values) => client.query(text, values) },
        { document: DOCUMENT },
      );
      await client.query('RESET SESSION AUTHORIZATION');
      expect(outcome.ok).toBe(true);
      const found = kinds.parse(
        (
          await client.query(
            `SELECT kind, status FROM public.jobs WHERE document_id = $1 AND kind <> 'store_only'
              ORDER BY kind`,
            [DOCUMENT],
          )
        ).rows,
      );
      expect(found).toStrictEqual([
        { kind: 'extract_text', status: 'queued' },
        { kind: 'second_read', status: 'queued' },
      ]);
    } finally {
      try {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }
  });

  test('the kinds of a job are the four work words known today', async () => {
    const found = z.array(z.object({ definition: z.string() })).parse(
      (
        await pool.query(
          `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
              WHERE conname = 'jobs_kind_word'`,
        )
      ).rows,
    );
    expect(found).toHaveLength(1);
    for (const kind of ['store_only', 'extract_text', 'map_structured', 'second_read'])
      expect(found[0]?.definition).toContain(`'${kind}'`);
  });
});
