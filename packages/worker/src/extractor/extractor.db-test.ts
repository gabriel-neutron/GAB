import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import type { RunnerAgent } from '../agents.ts';
import type { Minimiser } from '../minimise.ts';
import type { ReaderConfig } from '../reader-config.ts';
import {
  completionOf,
  depsOf,
  gatewayOf,
  STUB_MODEL,
  type StubGateway,
} from '../runner-fixture.ts';
import { openRunner, type Step } from '../runner.ts';
import { makeExtractor } from './extractor.ts';

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

const DOCUMENT = 'doc_extractor_suite';
const TEXT_SET = 'pdf-fixture@1';

// The first page is longer than the cap, so it gives two chunks, and the second starts at CAP.
const FIRST_CHUNK = 'The tanker Nayara left Sikka. ';
const SECOND_CHUNK = 'Rosneft owns it.';
const CAP = Array.from(FIRST_CHUNK).length;
const PAGES = [FIRST_CHUNK + SECOND_CHUNK];

const CONFIG: ReaderConfig = {
  model: STUB_MODEL,
  family: 'stub-family',
  tokenCap: 10_000,
  turnCap: 10,
  chunkCap: CAP,
};

const NAYARA = {
  act: { op: 'create_entity', type: 'vessel', label: 'Nayara' },
  page: 1,
  start: FIRST_CHUNK.indexOf('Nayara'),
  end: FIRST_CHUNK.indexOf('Nayara') + 'Nayara'.length,
  modality: 'asserts',
};

const ROSNEFT = {
  act: { op: 'create_entity', type: 'company', label: 'Rosneft' },
  page: 1,
  start: 0,
  end: 'Rosneft'.length,
  modality: 'attributes',
  adverse: true,
};

// The model answers the first chunk, then the second, and the same again on a requeue.
const answers = (): StubGateway =>
  gatewayOf((call) =>
    completionOf(JSON.stringify({ claims: [call % 2 === 1 ? NAYARA : ROSNEFT] })),
  );

const PUT = `SELECT public.put_document($1, 'file', 'A test of the extractor',
  'raw/extractor-suite.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-01'::date)`;

const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1";

const jobRow = z.object({
  status: z.string(),
  attempts: z.number().int(),
  failure_reason: z.string().nullable(),
});

interface Held {
  readonly client: PoolClient;
  readonly job: string;
  readonly read: () => Promise<z.infer<typeof jobRow>>;
  readonly step: (agent: RunnerAgent, gateway: StubGateway) => Promise<Step>;
}

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
    const made = z
      .array(z.object({ id: z.uuid() }))
      .length(1)
      .parse(
        (await client.query("SELECT public.enqueue_job($1, 'extract_text') AS id", [DOCUMENT]))
          .rows,
      );
    const job = made[0]?.id ?? '';
    await client.query(OLDEST, [job]);

    const read = async () =>
      jobRow.parse(
        (
          await client.query(
            'SELECT status, attempts, failure_reason FROM public.jobs WHERE id = $1',
            [job],
          )
        ).rows[0],
      );

    const step = async (agent: RunnerAgent, gateway: StubGateway): Promise<Step> => {
      const { deps } = depsOf(client, [agent], gateway);
      await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
      try {
        return await (await openRunner(deps)).step();
      } finally {
        await client.query('RESET SESSION AUTHORIZATION');
      }
    };

    await work({ client, job, read, step });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const proposals = z.array(
  z.object({
    id: z.uuid(),
    src: z.array(z.string()),
    payload: z.object({ label: z.string() }).loose(),
    confidence: z.unknown(),
    model_call_id: z.uuid(),
    idempotency_key: z.string().regex(/^[0-9a-f]{64}$/u),
  }),
);

const proposalsOf = async (held: Held) =>
  proposals.parse(
    (
      await held.client.query(
        `SELECT p.id, p.src::text[] AS src, p.payload, p.confidence, p.model_call_id,
                p.idempotency_key
           FROM public.proposals p JOIN public.model_call m ON m.id = p.model_call_id
          WHERE m.job_id = $1 ORDER BY p.payload ->> 'label'`,
        [held.job],
      )
    ).rows,
  );

const readings = z.array(
  z.object({
    claim_id: z.uuid(),
    doc_id: z.string(),
    text_extractor: z.string(),
    page: z.number(),
    start: z.number(),
    end: z.number(),
    modality: z.string(),
    adverse: z.boolean(),
    reader_no: z.number(),
    reader_kind: z.string(),
    model_call_id: z.uuid(),
    input_form: z.string(),
    idempotency_key: z.string(),
  }),
);

const readingsOf = async (held: Held) =>
  readings.parse(
    (
      await held.client.query(
        `SELECT claim_id, doc_id, text_extractor, page, start, "end", modality, adverse,
                reader_no, reader_kind, model_call_id, input_form, idempotency_key
           FROM public.claim_reading WHERE job_id = $1 ORDER BY start`,
        [held.job],
      )
    ).rows,
  );

const identity: Minimiser = { version: 'identity-test', apply: (text) => text };

test('a two-chunk document gives one proposal and one first reading for each claim', async () => {
  await inTransaction(async (held) => {
    const step = await held.step(makeExtractor(CONFIG, { minimise: identity }), answers());

    expect(step).toStrictEqual({ did: 'done', job: held.job });
    const made = await proposalsOf(held);
    expect(made.map((row) => row.payload.label)).toStrictEqual(['Nayara', 'Rosneft']);
    for (const row of made) {
      expect(row.src).toStrictEqual([DOCUMENT]);
      expect(row.confidence).toBeNull();
    }

    const [nayara, rosneft] = made;
    expect(await readingsOf(held)).toStrictEqual([
      {
        claim_id: nayara?.id,
        doc_id: DOCUMENT,
        text_extractor: TEXT_SET,
        page: 1,
        start: NAYARA.start,
        end: NAYARA.end,
        modality: 'asserts',
        adverse: false,
        reader_no: 1,
        reader_kind: 'llm',
        model_call_id: nayara?.model_call_id,
        input_form: 'text',
        idempotency_key: nayara?.idempotency_key,
      },
      {
        claim_id: rosneft?.id,
        doc_id: DOCUMENT,
        text_extractor: TEXT_SET,
        page: 1,
        start: CAP,
        end: CAP + ROSNEFT.end,
        modality: 'attributes',
        adverse: true,
        reader_no: 1,
        reader_kind: 'llm',
        model_call_id: rosneft?.model_call_id,
        input_form: 'text',
        idempotency_key: rosneft?.idempotency_key,
      },
    ]);
  });
});

test('a requeued job with the same inputs writes no new proposal and no new reading', async () => {
  await inTransaction(async (held) => {
    const extractor = makeExtractor(CONFIG, { minimise: identity });
    let runs = 0;
    const dies: RunnerAgent = {
      ...extractor,
      run: async (context) => {
        runs += 1;
        const result = await extractor.run(context);
        if (runs === 1) throw new Error('the worker stopped after it wrote');
        return result;
      },
    };
    const gateway = answers();

    expect(await held.step(dies, gateway)).toStrictEqual({ did: 'left', job: held.job });
    const proposed = await proposalsOf(held);
    const read = await readingsOf(held);
    expect(proposed).toHaveLength(2);
    expect(read).toHaveLength(2);

    await held.client.query(
      "UPDATE public.jobs SET claimed_at = now() - interval '2 hours' WHERE id = $1",
      [held.job],
    );
    await held.client.query('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await held.client.query('SELECT public.release_expired_claims()');
    await held.client.query('RESET SESSION AUTHORIZATION');

    expect(await held.step(dies, gateway)).toStrictEqual({ did: 'done', job: held.job });
    expect((await proposalsOf(held)).map((row) => row.id).sort()).toStrictEqual(
      proposed.map((row) => row.id).sort(),
    );
    expect((await readingsOf(held)).map((row) => row.idempotency_key).sort()).toStrictEqual(
      read.map((row) => row.idempotency_key).sort(),
    );
  });
});

test('with no minimiser, a job on its third claim fails with no_minimiser and asks no model', async () => {
  await inTransaction(async (held) => {
    await held.client.query('UPDATE public.jobs SET attempts = 2 WHERE id = $1', [held.job]);
    const gateway = answers();

    const step = await held.step(makeExtractor(CONFIG, {}), gateway);

    expect(step).toStrictEqual({ did: 'failed', job: held.job });
    expect(await held.read()).toMatchObject({
      status: 'failed',
      attempts: 3,
      failure_reason: 'no_minimiser',
    });
    expect(gateway.chats()).toBe(0);
  });
});

test('a model that never stops calling a tool fails the job with turn_cap on its third claim', async () => {
  await inTransaction(async (held) => {
    await held.client.query('UPDATE public.jobs SET attempts = 2 WHERE id = $1', [held.job]);
    const lookups = gatewayOf(
      () =>
        new Response(
          JSON.stringify({
            model: STUB_MODEL.model,
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      id: 'call-1',
                      function: {
                        name: 'lookup_entity',
                        arguments: '{"key":"imo","value":"9876543"}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          { status: 200 },
        ),
    );

    const step = await held.step(makeExtractor(CONFIG, { minimise: identity }), lookups);

    expect(step).toStrictEqual({ did: 'failed', job: held.job });
    expect(await held.read()).toMatchObject({ status: 'failed', failure_reason: 'turn_cap' });
    expect(lookups.chats()).toBe(CONFIG.turnCap);
  });
});

test('a spent token cap fails the job with usage_cap on its third claim', async () => {
  await inTransaction(async (held) => {
    await held.client.query('UPDATE public.jobs SET attempts = 2 WHERE id = $1', [held.job]);

    const step = await held.step(
      makeExtractor({ ...CONFIG, tokenCap: 1 }, { minimise: identity }),
      answers(),
    );

    expect(step).toStrictEqual({ did: 'failed', job: held.job });
    expect(await held.read()).toMatchObject({ status: 'failed', failure_reason: 'usage_cap' });
  });
});
