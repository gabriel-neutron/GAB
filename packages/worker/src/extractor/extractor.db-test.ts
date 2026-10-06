import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import type { RunnerAgent } from '../agents.ts';
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

// The first page is longer than the cap, so it gives two chunks.
const FIRST_CHUNK = 'The tanker Nayara left Sikka. ';
const SECOND_CHUNK = 'Rosneft owns it.';
const CAP = Array.from(FIRST_CHUNK).length;
const PAGE = FIRST_CHUNK + SECOND_CHUNK;

const CONFIG: ReaderConfig = {
  model: STUB_MODEL,
  family: 'stub-family',
  tokenCap: 10_000,
  turnCap: 10,
  chunkCap: CAP,
};

const itemOf = (ref: string, label: string, type: string, excerpt: string) => ({
  ref,
  act: { op: 'create_entity', type, label },
  originator: 'The port authority',
  modality: 'asserts',
  evidence: [{ document: DOCUMENT, page: 1, excerpt }],
});

const NAYARA = itemOf('nayara', 'Nayara', 'vessel', 'The tanker Nayara');
const ROSNEFT = itemOf('rosneft', 'Rosneft', 'company', 'Rosneft owns it');
const INVENTED = itemOf('ghost', 'Ghost', 'vessel', 'The tanker Ghost');

const answerOf = (items: readonly unknown[]): Response => completionOf(JSON.stringify({ items }));

const PUT = `SELECT public.put_document($1, 'file', 'A test of the extractor',
  'raw/extractor-suite.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-01'::date)`;

const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1";

const jobRow = z.object({
  status: z.string(),
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
      JSON.stringify([PAGE]),
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
        (await client.query('SELECT status, failure_reason FROM public.jobs WHERE id = $1', [job]))
          .rows[0],
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

const cited = z.array(
  z.object({
    label: z.string(),
    src: z.array(z.string()),
    originator: z.string(),
    dissent: z.boolean(),
    called: z.boolean(),
    page: z.number(),
    passage: z.string(),
    modality: z.string(),
  }),
);

// Each proposal of the job, with the passage that its citation names in the stored page.
const citedOf = async (held: Held) =>
  cited.parse(
    (
      await held.client.query(
        `SELECT p.payload ->> 'label' AS label, p.src::text[] AS src, p.originator, p.dissent,
                m.job_id = $1 AS called, c.page, c.modality,
                substr(t.text, c.start + 1, c."end" - c.start) AS passage
           FROM public.proposals p
           JOIN public.model_call m ON m.id = p.model_call_id
           JOIN public.citation c ON c.claim_id = p.id
           JOIN public.document_text t
             ON (t.document_id, t.extractor, t.page) = (c.doc_id, c.text_extractor, c.page)
          WHERE $2 = ANY (p.src::text[]) ORDER BY p.payload ->> 'label'`,
        [held.job, DOCUMENT],
      )
    ).rows,
  );

test('the text goes to the model as it is, and each item becomes a proposal with its passage', async () => {
  await inTransaction(async (held) => {
    const bodies: string[] = [];
    const gateway = gatewayOf((call, body) => {
      bodies.push(body);
      return answerOf([call === 1 ? NAYARA : ROSNEFT]);
    });

    expect(await held.step(makeExtractor(CONFIG), gateway)).toStrictEqual({
      did: 'done',
      job: held.job,
    });
    expect(bodies[0]).toContain(JSON.stringify(FIRST_CHUNK).slice(1, -1));
    expect(await citedOf(held)).toStrictEqual([
      {
        label: 'Nayara',
        src: [DOCUMENT],
        originator: 'The port authority',
        dissent: false,
        called: true,
        page: 1,
        passage: 'The tanker Nayara',
        modality: 'asserts',
      },
      {
        label: 'Rosneft',
        src: [DOCUMENT],
        originator: 'The port authority',
        dissent: false,
        called: true,
        page: 1,
        passage: 'Rosneft owns it',
        modality: 'asserts',
      },
    ]);
  });
});

test('a refused batch goes back to the model once with its fault, and the corrected one is kept', async () => {
  await inTransaction(async (held) => {
    const bodies: string[] = [];
    const answers = [[INVENTED], [NAYARA], [ROSNEFT]];
    const gateway = gatewayOf((call, body) => {
      bodies.push(body);
      return answerOf(answers[call - 1] ?? []);
    });

    expect(await held.step(makeExtractor(CONFIG), gateway)).toStrictEqual({
      did: 'done',
      job: held.job,
    });
    expect(bodies[1]).toContain('item ghost');
    expect((await citedOf(held)).map((row) => row.label)).toStrictEqual(['Nayara', 'Rosneft']);
  });
});

test('a batch that is refused twice proposes nothing, and the job goes on', async () => {
  await inTransaction(async (held) => {
    const answers = [[INVENTED], [INVENTED], [ROSNEFT]];
    const gateway = gatewayOf((call) => answerOf(answers[call - 1] ?? []));

    expect(await held.step(makeExtractor(CONFIG), gateway)).toStrictEqual({
      did: 'done',
      job: held.job,
    });
    expect((await citedOf(held)).map((row) => row.label)).toStrictEqual(['Rosneft']);
  });
});

test('a model that never stops calling a tool fails the job with turn_cap', async () => {
  await inTransaction(async (held) => {
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

    const step = await held.step(makeExtractor(CONFIG), lookups);

    expect(step).toStrictEqual({ did: 'failed', job: held.job });
    expect(await held.read()).toMatchObject({ status: 'failed', failure_reason: 'turn_cap' });
    expect(lookups.chats()).toBe(CONFIG.turnCap);
  });
});

test('a spent token cap fails the job with usage_cap', async () => {
  await inTransaction(async (held) => {
    const step = await held.step(
      makeExtractor({ ...CONFIG, tokenCap: 1 }),
      gatewayOf(() => answerOf([NAYARA])),
    );

    expect(step).toStrictEqual({ did: 'failed', job: held.job });
    expect(await held.read()).toMatchObject({ status: 'failed', failure_reason: 'usage_cap' });
  });
});
