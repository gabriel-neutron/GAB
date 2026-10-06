import { readFileSync } from 'node:fs';

import { openModel, type AgentModel, type Model } from '@gab/model';
import { extractText } from '@gab/text';
import { Pool, type PoolClient } from 'pg';
import { afterAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import type { RunnerAgent } from '../agents.ts';
import { makeExtractor } from '../extractor/extractor.ts';
import { MINIMISER_VERSION, READER_MINIMISER } from '../minimise.ts';
import type { ReaderConfig } from '../reader-config.ts';
import { makeReader2 } from '../reader2/reader2.ts';
import { completionOf, gatewayOf, STUB_MODEL, type StubGateway } from '../runner-fixture.ts';
import { openRunner, type Step } from '../runner.ts';
import { makeEvidenceAgent } from './evidence.ts';

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

const DOCUMENT = 'doc_evidence_suite';

// An invented page. The master, his date of birth and his address are not real, and they are
// here so that the test can see that no model reads them.
const SENTENCE = 'The tanker Nayara Star (IMO 9123453) left Sikka on 3 May 2026.';
const PERSONAL =
  'Its master, Ivan Petrov, born 3 February 1970, address: 12 Harbour Street, Sikka.';
const PAGE = `Port bulletin. ${SENTENCE} ${PERSONAL}`;

const codePoints = (text: string): number => Array.from(text).length;

const spanOf = (text: string, part: string): { start: number; end: number } => {
  const start = codePoints(text.slice(0, text.indexOf(part)));
  return { start, end: start + codePoints(part) };
};

const FIRST: ReaderConfig = {
  model: STUB_MODEL,
  family: 'stub-family',
  tokenCap: 10_000,
  turnCap: 10,
  chunkCap: 10_000,
};

const SECOND_MODEL: AgentModel = { ...STUB_MODEL, model: 'other-family/other-model' };

const SECOND: ReaderConfig = { ...FIRST, model: SECOND_MODEL, family: 'other-family' };

const agents = (): RunnerAgent[] => [
  makeExtractor(FIRST, { minimise: READER_MINIMISER }),
  makeReader2(SECOND, { minimise: READER_MINIMISER }),
  makeEvidenceAgent(),
];

const VESSEL = {
  op: 'create_entity',
  type: 'vessel',
  label: 'Nayara Star',
  attrs: { imo: { v: '9123453' } },
};

const firstAnswer = (page: string, part: string): StubGateway =>
  gatewayOf(() =>
    completionOf(
      JSON.stringify({
        claims: [{ act: VESSEL, page: 1, ...spanOf(page, part), modality: 'asserts' }],
      }),
    ),
  );

const secondAnswer = (page: string, part: string): StubGateway =>
  gatewayOf(() =>
    completionOf(
      JSON.stringify({ claims: [{ page: 1, ...spanOf(page, part), modality: 'asserts' }] }),
      SECOND_MODEL.model,
    ),
  );

interface Seed {
  readonly pages: readonly string[];
  readonly mime: string;
  readonly textSet: string;
  readonly kinds: readonly string[];
}

interface Held {
  readonly client: PoolClient;
  readonly jobs: Readonly<Record<string, string>>;
  readonly bodies: string[];
  readonly step: (gateways: { first: StubGateway; second: StubGateway }) => Promise<Step>;
  readonly status: (job: string) => Promise<{ status: string; failure_reason: string | null }>;
}

const one = z.array(z.object({ id: z.uuid() })).length(1);

const inTransaction = async (seed: Seed, work: (held: Held) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT public.put_document($1, 'url', 'A test of the checks', 'raw/evidence-suite', $2, NULL,
         NULL, $3, '2026-05-04'::date)`,
      [DOCUMENT, 'https://example.org/bulletin', seed.mime],
    );
    await client.query('SELECT public.put_document_text($1, $2::jsonb, $3)', [
      DOCUMENT,
      JSON.stringify(seed.pages),
      seed.textSet,
    ]);
    const jobs: Record<string, string> = {};
    for (const [index, kind] of seed.kinds.entries()) {
      const id =
        one.parse(
          (await client.query('SELECT public.enqueue_job($1, $2) AS id', [DOCUMENT, kind])).rows,
        )[0]?.id ?? '';
      // The jobs of the suite are older than each row of the shared queue, in the given order.
      await client.query('UPDATE public.jobs SET created_at = $2::timestamptz WHERE id = $1', [
        id,
        `1970-01-01 00:00:0${String(index)}`,
      ]);
      jobs[kind] = id;
    }
    const bodies: string[] = [];

    const step: Held['step'] = async (gateways) => {
      const open = (settings: AgentModel): Model => {
        const gateway = settings.model === SECOND_MODEL.model ? gateways.second : gateways.first;
        return openModel(
          settings,
          (url, init) => {
            if (typeof init.body === 'string') bodies.push(init.body);
            return gateway.send(url, init);
          },
          GATEWAY_ENV,
        );
      };
      await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
      try {
        const runner = await openRunner({
          db: client,
          agents: agents(),
          sleep: () => Promise.resolve(),
          now: () => 0,
          open,
        });
        return await runner.step();
      } finally {
        await client.query('RESET SESSION AUTHORIZATION');
      }
    };

    const status: Held['status'] = async (job) =>
      z
        .object({ status: z.string(), failure_reason: z.string().nullable() })
        .parse(
          (
            await client.query('SELECT status, failure_reason FROM public.jobs WHERE id = $1', [
              job,
            ])
          ).rows[0],
        );

    await work({ client, jobs, bodies, step, status });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const checks = z.array(
  z.object({
    span_result: z.string(),
    support: z.string(),
    counts: z.boolean(),
    held: z.record(z.string(), z.string()),
    ocr: z.boolean(),
  }),
);

const checksOf = async (held: Held) =>
  checks.parse(
    (
      await held.client.query(
        `SELECT span_result, support, counts, held, ocr FROM public.citation_check
          WHERE doc_id = $1 ORDER BY created_at`,
        [DOCUMENT],
      )
    ).rows,
  );

const FREE_TEXT: Seed = {
  pages: [PAGE],
  mime: 'text/html',
  textSet: 'html-live-1',
  kinds: ['extract_text', 'second_read', 'evidence_check'],
};

describe('the checks after two readers of free text', () => {
  test('both readers read a minimised page, and the span of each claim passes on the untouched page', async () => {
    await inTransaction(FREE_TEXT, async (held) => {
      const gateways = { first: firstAnswer(PAGE, SENTENCE), second: secondAnswer(PAGE, SENTENCE) };
      // The queue holds the checks back while a reader of the document waits.
      expect(await held.step(gateways)).toStrictEqual({
        did: 'done',
        job: held.jobs['extract_text'],
      });
      expect(await held.step(gateways)).toStrictEqual({
        did: 'done',
        job: held.jobs['second_read'],
      });
      expect(await held.step(gateways)).toStrictEqual({
        did: 'done',
        job: held.jobs['evidence_check'],
      });

      expect(held.bodies.length).toBeGreaterThanOrEqual(2);
      for (const body of held.bodies) {
        expect(body).not.toContain('3 February 1970');
        expect(body).not.toContain('12 Harbour Street');
        expect(body).toContain('Nayara Star');
      }
      expect(await checksOf(held)).toStrictEqual([
        { span_result: 'pass', support: 'value', counts: true, held: {}, ocr: false },
      ]);

      const calls = z
        .array(z.object({ minimiser: z.string(), personal_categories: z.array(z.string()) }))
        .parse(
          (
            await held.client.query(
              `SELECT m.minimiser, m.personal_categories FROM public.model_call m
                 JOIN public.jobs j ON j.id = m.job_id WHERE j.document_id = $1`,
              [DOCUMENT],
            )
          ).rows,
        );
      expect(calls).toStrictEqual([
        { minimiser: MINIMISER_VERSION, personal_categories: [] },
        { minimiser: MINIMISER_VERSION, personal_categories: [] },
      ]);
    });
  });

  test('a notice of suspicion with a date of birth and an address gives claim rows with neither', async () => {
    await inTransaction(FREE_TEXT, async (held) => {
      const person = {
        op: 'create_entity',
        type: 'person',
        label: 'Ivan Petrov',
        attrs: { date_of_birth: { v: '1970-02-03' }, address: { v: '12 Harbour Street' } },
      };
      const gateways = {
        first: gatewayOf(() =>
          completionOf(
            JSON.stringify({
              claims: [{ act: person, page: 1, ...spanOf(PAGE, PERSONAL), modality: 'asserts' }],
            }),
          ),
        ),
        second: secondAnswer(PAGE, SENTENCE),
      };
      await held.step(gateways);
      const rows = z
        .array(z.object({ payload: z.unknown() }))
        .parse(
          (
            await held.client.query(
              'SELECT payload FROM public.proposals WHERE $1::text::doc_id = ANY (src)',
              [DOCUMENT],
            )
          ).rows,
        );
      const text = JSON.stringify(rows);
      expect(text).not.toContain('1970-02-03');
      expect(text).not.toContain('12 Harbour Street');
    });
  });

  test('with a second job that failed, the claim is held with no_second_reading and the job does not complete', async () => {
    await inTransaction(FREE_TEXT, async (held) => {
      const gateways = { first: firstAnswer(PAGE, SENTENCE), second: secondAnswer(PAGE, SENTENCE) };
      await held.step(gateways);
      await held.client.query(
        `UPDATE public.jobs SET status = 'failed', attempts = 3, claimed_by = 'gabriel_agent',
           claimed_at = now(), finished_at = now(), failure_reason = 'outage' WHERE id = $1`,
        [held.jobs['second_read']],
      );
      // The third claim of the check job is its last, so the stop ends it as failed.
      await held.client.query('UPDATE public.jobs SET attempts = 2 WHERE id = $1', [
        held.jobs['evidence_check'],
      ]);
      expect(await held.step(gateways)).toStrictEqual({
        did: 'failed',
        job: held.jobs['evidence_check'],
      });
      expect(await held.status(held.jobs['evidence_check'] ?? '')).toStrictEqual({
        status: 'failed',
        failure_reason: 'no_second_reading',
      });
      expect((await checksOf(held)).map((row) => row.held['reading'])).toStrictEqual([
        'no_second_reading',
      ]);
    });
  });

  for (const [name, second] of [
    ['an outage', gatewayOf(() => new Response('down', { status: 503 }))],
    [
      'a served model that is not the pinned model',
      gatewayOf(() =>
        completionOf(JSON.stringify({ claims: [] }), 'other-family/a-model-nobody-pinned'),
      ),
    ],
  ] as const)
    test(`with ${name} of the second family, the second job goes back to the queue and the checks wait`, async () => {
      await inTransaction(FREE_TEXT, async (held) => {
        const gateways = { first: firstAnswer(PAGE, SENTENCE), second };
        await held.step(gateways);
        expect(await held.step(gateways)).toMatchObject({
          did: 'released',
          job: held.jobs['second_read'],
        });
        // The second job is queued again, so the claim door holds the checks back: the next claim
        // takes the second job again, and the checks never complete with one reading.
        expect(await held.step(gateways)).toMatchObject({ job: held.jobs['second_read'] });
        expect(await held.status(held.jobs['evidence_check'] ?? '')).toMatchObject({
          status: 'queued',
        });
        expect(await checksOf(held)).toStrictEqual([]);
      });
    });

  test('a claim with no first reading on the document gets no check row, and the job goes on', async () => {
    await inTransaction(FREE_TEXT, async (held) => {
      const gateways = { first: firstAnswer(PAGE, SENTENCE), second: secondAnswer(PAGE, SENTENCE) };
      // A research proposal cites the document, and no reader read it.
      await held.client.query('SET LOCAL SESSION AUTHORIZATION gabriel_research');
      await held.client.query(
        `SELECT public.propose_change('create_entity', '{"type":"vessel","label":"Sikka Spirit"}'::jsonb,
           ARRAY[$1]::text[])`,
        [DOCUMENT],
      );
      await held.client.query('RESET SESSION AUTHORIZATION');
      await held.step(gateways);
      await held.step(gateways);
      expect(await held.step(gateways)).toStrictEqual({
        did: 'done',
        job: held.jobs['evidence_check'],
      });
      expect(await checksOf(held)).toHaveLength(1);
    });
  });
});

describe('the checks of a structured issuer entry', () => {
  const ROW =
    '36001,"NAYARA STAR","vessel","RUSSIA-EO14024","-0-","UBCD7","Crude Oil Tanker","-0-","-0-",' +
    '"Russia","-0-","Vessel Registration Identification IMO 9123453; MMSI 273456789."';

  for (const [name, row, held] of [
    ['agrees with the first reading', ROW, {}],
    ['reads another IMO', ROW.replaceAll('9123453', '9876505'), { imo: 'reader_disagreement' }],
  ] as const)
    test(`the parser is the second reading, and a parser that ${name} gives its result`, async () => {
      await inTransaction(
        {
          pages: [row],
          mime: 'text/csv',
          textSet: 'text-1',
          kinds: ['extract_text', 'evidence_check'],
        },
        async (store) => {
          const gateways = {
            first: gatewayOf(() =>
              completionOf(
                JSON.stringify({
                  claims: [
                    { act: VESSEL, page: 1, start: 0, end: codePoints(row), modality: 'enacts' },
                  ],
                }),
              ),
            ),
            second: secondAnswer(row, row),
          };
          await store.step(gateways);
          expect(await store.step(gateways)).toStrictEqual({
            did: 'done',
            job: store.jobs['evidence_check'],
          });
          const [check] = await checksOf(store);
          expect(check?.held).toStrictEqual(held);
          expect(gateways.second.chats()).toBe(0);
        },
      );
    });
});

describe('the checks of an image', () => {
  // An invented card. The OCR text of the card is its only text, and the first reader reads it.
  const CARD = readFileSync(new URL('../../../text/fixtures/ocr-card.png', import.meta.url));

  test('the OCR row holds the values of the claim, no image reaches a model, and the prompt holds no personal field', async () => {
    const { pages, extractor } = await extractText(CARD, 'image/png');
    const ocrPage = pages[0] ?? '';
    const line = ocrPage.split('\n').find((one) => one.includes('NAYARA STAR')) ?? '';
    await inTransaction(
      { pages, mime: 'image/png', textSet: extractor, kinds: ['extract_text', 'evidence_check'] },
      async (held) => {
        const label = { op: 'create_entity', type: 'vessel', label: 'NAYARA STAR' };
        const gateways = {
          first: gatewayOf(() =>
            completionOf(
              JSON.stringify({
                claims: [{ act: label, page: 1, ...spanOf(ocrPage, line), modality: 'asserts' }],
              }),
            ),
          ),
          second: secondAnswer(ocrPage, line),
        };
        await held.step(gateways);
        expect(await held.step(gateways)).toStrictEqual({
          did: 'done',
          job: held.jobs['evidence_check'],
        });
        expect(await checksOf(held)).toStrictEqual([
          { span_result: 'pass', support: 'name_only', counts: true, held: {}, ocr: true },
        ]);
        const png = CARD.subarray(0, 64).toString('base64').slice(0, 40);
        for (const body of held.bodies) {
          expect(body).not.toContain(png);
          expect(body).not.toContain('image_url');
          expect(body).not.toContain('February 1970');
          expect(body).not.toContain('Harbour Street');
        }
        expect(gateways.second.chats()).toBe(0);
      },
    );
  }, 60_000);
});
