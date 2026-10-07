import { randomUUID } from 'node:crypto';

import {
  FIXTURE_HOST,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from '@gab/tools/fetch-fixture';
import { endMetadata } from '@gab/tools/fetch-document';
import type { Reach } from '@gab/tools/tool';
import { json, stubWeb } from '@gab/tools/web-stub';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { makeExtractor } from '../extractor/extractor.ts';
import {
  CHECKER,
  completionOf,
  depsOf,
  routerOf,
  READER,
  toolCallOf,
  toolsOf,
  type StubRouter,
} from '../runner-fixture.ts';
import { openRunner, type Step } from '../runner.ts';
import type { LeadConfig } from '../reader-config.ts';
import type { RunnerAgent } from '../agents.ts';
import { leadAgentOf, makeLeadAgent } from './lead.ts';

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

// Each run gets other bytes, so no page of an earlier run is known by its hash.
const RUN = randomUUID();

const pageOf = (title: string): string =>
  `<html><head><title>${title}</title></head><body><article><h1>${title}</h1>` +
  `<p>Intershipping manages the tanker Nayara. Run ${RUN}.</p><p>The register names the ` +
  'manager, the owner and the flag of each vessel, and the page is long enough that a reader ' +
  'finds the text of a real page here and no shell of a script.</p></article></body></html>';

let fixture: Fixture;
let NEW = '';
let KNOWN = '';

beforeAll(async () => {
  fixture = await startFixture({
    '/new.html': { headers: { 'content-type': 'text/html' }, body: pageOf('A new register') },
    '/known.html': { headers: { 'content-type': 'text/html' }, body: pageOf('A known register') },
  });
  NEW = `http://${FIXTURE_HOST}:${String(fixture.port)}/new.html`;
  KNOWN = `http://${FIXTURE_HOST}:${String(fixture.port)}/known.html`;
});

afterAll(async () => {
  await fixture.close();
  await endMetadata();
  await pool.end();
});

const LEAD = 'Intershipping and its vessels';

const CONFIG: LeadConfig = { model: READER, tokenCap: 10_000 };

// The search engine lists both pages. One of them is already stored.
const reachOf = (): Reach => ({
  ...fixtureReach(memoryStore()),
  web: stubWeb(
    () =>
      json({
        results: [
          { title: 'A new register', url: NEW, content: 'Intershipping' },
          { title: 'A known register', url: KNOWN, content: 'Intershipping' },
        ],
      }),
    { searxngUrl: 'http://searxng.test' },
  ),
});

const STORE_KNOWN = `SELECT public.put_fetched_document('url', 'A known register', $1, $2, $3,
  'text/html', '2026-10-01'::date)::text AS id`;

const START = 'SELECT public.start_lead($1)::text AS id';
const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1";

const one = z.array(z.object({ id: z.string() })).length(1);

interface Held {
  readonly client: PoolClient;
  readonly job: string;
  readonly known: string;
  readonly ask: (text: string, values?: unknown[]) => Promise<unknown[]>;
  readonly step: (config: LeadConfig, router: StubRouter, reach: Reach) => Promise<Step>;
  readonly stepWith: (agents: readonly RunnerAgent[], router: StubRouter) => Promise<Step>;
}

const inTransaction = async (work: (held: Held) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ask = async (text: string, values?: unknown[]) =>
      (await client.query(text, values)).rows as unknown[];
    const sha = RUN.replaceAll('-', '').padEnd(64, '0');
    const known = one.parse(await ask(STORE_KNOWN, [`raw/${sha}`, KNOWN, sha]))[0]?.id ?? '';
    const job = one.parse(await ask(START, [LEAD]))[0]?.id ?? '';
    await ask(OLDEST, [job]);

    const stepWith = async (agents: readonly RunnerAgent[], router: StubRouter) => {
      const { deps } = depsOf(client, agents, router);
      await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
      try {
        return await (await openRunner(deps)).step();
      } finally {
        await client.query('RESET SESSION AUTHORIZATION');
      }
    };
    const step = (config: LeadConfig, router: StubRouter, reach: Reach) =>
      stepWith([makeLeadAgent(config, { reach })], router);
    await work({ client, job, known, ask, step, stepWith });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
};

const jobRow = z.array(z.object({ status: z.string(), failure_reason: z.string().nullable() }));
const leadRow = z.array(z.object({ documents: z.array(z.object({ id: z.string() })) }));
const workRows = z.array(z.object({ kind: z.string(), status: z.string() }));
const counted = z.array(z.object({ n: z.number() }));

const JOB = 'SELECT status, failure_reason FROM public.jobs WHERE id = $1';
const LEAD_DOCUMENTS = 'SELECT documents FROM public.lead_jobs() WHERE job_id = $1';
const WORK_OF = `SELECT kind, status FROM public.jobs
  WHERE document_id = $1 AND kind <> 'store_only' ORDER BY created_at`;
const PROPOSALS_OF = `SELECT count(*)::int AS n FROM public.proposals p
  JOIN public.model_call m ON m.id = p.model_call_id WHERE m.job_id = $1`;

const THE_TOOLS = [
  'enqueue_extract',
  'fetch_document',
  'find_document',
  'news_search',
  'search_graph',
  'web_search',
];

test('a lead stores each new page, queues its extraction, and fetches no stored page again', async () => {
  await inTransaction(async ({ job, known, ask, step }) => {
    const bodies: string[] = [];
    const router = routerOf((call, body) => {
      bodies.push(body);
      if (call === 1) return toolCallOf('web_search', { query: LEAD });
      if (call === 2) return toolCallOf('fetch_document', { url: NEW }, 'call_new');
      if (call === 3) return toolCallOf('fetch_document', { url: KNOWN }, 'call_known');
      return completionOf(JSON.stringify({ summary: 'One new register is stored.' }));
    });

    expect(await step(CONFIG, router, reachOf())).toStrictEqual({ did: 'done', job });

    expect(jobRow.parse(await ask(JOB, [job]))).toStrictEqual([
      { status: 'done', failure_reason: null },
    ]);
    // The stored page was not asked for again, and the model read why.
    expect(fixture.requests.filter((path) => path === '/known.html')).toStrictEqual([]);
    expect(bodies[3]).toContain(known);

    const [lead] = leadRow.parse(await ask(LEAD_DOCUMENTS, [job]));
    const stored = lead?.documents.map((document) => document.id) ?? [];
    expect(stored).toHaveLength(1);
    expect(stored).not.toContain(known);
    expect(workRows.parse(await ask(WORK_OF, [stored[0]]))).toStrictEqual([
      { kind: 'extract_text', status: 'queued' },
    ]);
    expect(workRows.parse(await ask(WORK_OF, [known]))).toStrictEqual([]);

    // The model is offered no tool that proposes or starts a lead, and the lead proposes nothing.
    for (const body of bodies) expect(toolsOf(body).sort()).toStrictEqual(THE_TOOLS);
    expect(counted.parse(await ask(PROPOSALS_OF, [job]))).toStrictEqual([{ n: 0 }]);
  });
});

test('the token budget stops a lead that loops, with that reason', async () => {
  await inTransaction(async ({ job, ask, step }) => {
    // Each answer of the stub costs twelve tokens, so the third question spends the budget.
    const router = routerOf(() => toolCallOf('web_search', { query: LEAD }));

    expect(await step({ ...CONFIG, tokenCap: 30 }, router, reachOf())).toStrictEqual({
      did: 'failed',
      job,
    });

    expect(router.chats()).toBe(3);
    expect(jobRow.parse(await ask(JOB, [job]))).toStrictEqual([
      { status: 'failed', failure_reason: 'the token budget of this lead is spent' },
    ]);
  });
});

test('a lead fetches no address that differs from a stored one only in its form', async () => {
  await inTransaction(async ({ job, known, step }) => {
    const bodies: string[] = [];
    // The fragment is never sent, the name of a host has no case, and a slash at the end of the
    // path names the same page.
    const variants = [
      `${KNOWN}#owner`,
      KNOWN.replace(FIXTURE_HOST, FIXTURE_HOST.toUpperCase()),
      `${KNOWN}/`,
    ];
    const router = routerOf((call, body) => {
      bodies.push(body);
      const variant = variants[call - 1];
      if (variant !== undefined)
        return toolCallOf('fetch_document', { url: variant }, `call_${String(call)}`);
      return completionOf(JSON.stringify({ summary: 'Nothing new.' }));
    });

    expect(await step(CONFIG, router, reachOf())).toStrictEqual({ did: 'done', job });

    expect(fixture.requests.filter((path) => path.startsWith('/known.html'))).toStrictEqual([]);
    for (const body of bodies.slice(1)) expect(body).toContain(known);
  });
});

test('the pages that a lead stored stay when its token budget stops it', async () => {
  await inTransaction(async ({ job, ask, step }) => {
    const router = routerOf((call) =>
      call === 1
        ? toolCallOf('fetch_document', { url: NEW }, 'call_new')
        : toolCallOf('web_search', { query: LEAD }),
    );

    expect(await step({ ...CONFIG, tokenCap: 30 }, router, reachOf())).toStrictEqual({
      did: 'failed',
      job,
    });

    expect(jobRow.parse(await ask(JOB, [job]))).toStrictEqual([
      { status: 'failed', failure_reason: 'the token budget of this lead is spent' },
    ]);
    const [lead] = leadRow.parse(await ask(LEAD_DOCUMENTS, [job]));
    const stored = lead?.documents.map((document) => document.id) ?? [];
    expect(stored).toHaveLength(1);
    expect(workRows.parse(await ask(WORK_OF, [stored[0]]))).toStrictEqual([
      { kind: 'extract_text', status: 'queued' },
    ]);
  });
});

test('a worker with no lead settings starts, and each lead fails with the setting it lacks', async () => {
  await inTransaction(async ({ job, ask, stepWith }) => {
    let opened = false;
    const lead = leadAgentOf({}, () => {
      opened = true;
      return reachOf();
    });
    const extractor = makeExtractor({
      reader: READER,
      checker: CHECKER,
      tokenCap: 10_000,
      turnCap: 5,
      chunkCap: 6000,
    });
    const router = routerOf(() => completionOf('{}'));

    expect(await stepWith([extractor, lead], router)).toStrictEqual({ did: 'failed', job });

    expect(opened).toBe(false);
    expect(router.chats()).toBe(0);
    const [row] = jobRow.parse(await ask(JOB, [job]));
    expect(row?.failure_reason).toMatch(/^the lead agent is not set up: LEAD_TOKEN_CAP /u);
  });
});

test('a lead fetches no address of the machine, even when a page or a result names one', async () => {
  await inTransaction(async ({ job, step }) => {
    const bodies: string[] = [];
    const inside = `http://127.0.0.1:${String(fixture.port)}/new.html`;
    const router = routerOf((call, body) => {
      bodies.push(body);
      if (call === 1) return toolCallOf('fetch_document', { url: inside }, 'call_inside');
      return completionOf(JSON.stringify({ summary: 'Nothing stored.' }));
    });
    // The worker gives the fetch no range check of its own, so the default check runs.
    const { lookup, refuses, ...reach } = reachOf();
    expect([lookup, refuses].every((one) => one !== undefined)).toBe(true);
    const before = fixture.requests.length;

    expect(await step(CONFIG, router, reach)).toStrictEqual({ did: 'done', job });

    expect(fixture.requests.length).toBe(before);
    expect(bodies[1]).toContain('private network');
  });
});
