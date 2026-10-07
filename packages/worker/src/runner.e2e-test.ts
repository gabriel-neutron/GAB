// The runner as the operator starts it: the real entry point in a child process, the test
// database, and a local server in place of the model router. The rows commit, so this project
// runs after each project that counts rows, and at its end it deletes the rows that it wrote.

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { setTimeout as sleepFor } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { CATALOGUE } from '@gab/tools/catalogue';
import { callTool } from '@gab/tools/tool';
import { Client } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

const held = z
  .object({
    POSTGRES_PASSWORD: z.string().min(1),
    GABRIEL_AGENT_PASSWORD: z.string().min(1),
    GABRIEL_DATABASE: z.literal('gabriel_test'),
  })
  .parse(process.env);

const MODEL = 'stub-family/stub-model';
const CHECKER = 'other-family/check-model';
const PAGE = 'The tanker Nayara left Sikka.';
const LABEL = 'Nayara';
const WORKER = fileURLToPath(new URL('./main.ts', import.meta.url));

// A run of the suite writes rows that the ledger keeps, so each run takes documents of its own.
const RUN = randomUUID().replaceAll('-', '').slice(0, 12);
const RECOVERED = `doc_e2e_a_${RUN}`;
const FLAKY = `doc_e2e_b_${RUN}`;

const db = new Client({
  connectionString: `postgresql://gabriel:${encodeURIComponent(held.POSTGRES_PASSWORD)}@127.0.0.1:5432/${held.GABRIEL_DATABASE}`,
});

// The router refuses the first question about the flaky document, and answers each other
// question with one claim that the page states. The checker, a model of another family, supports
// the claim of the recovered document and not the claim of the flaky one.
let flakyRefused = false;

const bodyOf = async (request: IncomingMessage): Promise<string> => {
  request.setEncoding('utf8');
  let body = '';
  for await (const part of request) body += String(part);
  return body;
};

// The model cites the document that the question names, so each document gets its own claim.
const claimOf = (body: string): string => {
  const document = [RECOVERED, FLAKY].find((one) => body.includes(one)) ?? RECOVERED;
  return JSON.stringify({
    items: [
      {
        ref: 'vessel',
        act: { op: 'create_entity', type: 'vessel', label: LABEL },
        originator: 'The port authority',
        modality: 'asserts',
        evidence: [{ document, page: 1, excerpt: `tanker ${LABEL}` }],
      },
    ],
  });
};

const verdictOf = (body: string): string =>
  JSON.stringify({
    verdicts: [
      body.includes(FLAKY)
        ? { ref: 'vessel', verdict: 'not_supported', reason: 'the page names another tanker' }
        : { ref: 'vessel', verdict: 'supported' },
    ],
  });

const asked = z.object({
  model: z.string(),
  messages: z.array(z.object({ role: z.string() })),
  tools: z.array(z.object({ function: z.object({ name: z.string() }) })).optional(),
});

// The lead agent asks a search first, and ends when it has read the results. The search service
// is a route of the same server, as SearXNG answers it.
const LEAD = `A lead of the runner test ${RUN}`;
const searched: string[] = [];

const leadAnswerOf = (said: z.infer<typeof asked>): Record<string, unknown> => {
  if (!said.messages.some((message) => message.role === 'tool'))
    return {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_search',
          type: 'function',
          function: { name: 'web_search', arguments: JSON.stringify({ query: LEAD }) },
        },
      ],
    };
  return { role: 'assistant', content: JSON.stringify({ summary: 'The search gave no page.' }) };
};

const router: Server = createServer((request, response) => {
  void bodyOf(request).then((body) => {
    response.setHeader('content-type', 'application/json');
    const address = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (address.pathname === '/search') {
      searched.push(address.searchParams.get('q') ?? '');
      response.end(JSON.stringify({ results: [] }));
      return;
    }
    const said = asked.parse(JSON.parse(body));
    const { model } = said;
    if (said.tools?.some((tool) => tool.function.name === 'web_search') === true) {
      const message = leadAnswerOf(said);
      response.end(
        JSON.stringify({
          model,
          choices: [{ message, finish_reason: 'content' in message ? 'stop' : 'tool_calls' }],
          usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
        }),
      );
      return;
    }
    if (model === MODEL && body.includes(FLAKY) && !flakyRefused) {
      flakyRefused = true;
      response.statusCode = 400;
      response.end(JSON.stringify({ error: { message: 'the stub refuses this question' } }));
      return;
    }
    response.end(
      JSON.stringify({
        model,
        choices: [
          {
            message: {
              role: 'assistant',
              content: model === CHECKER ? verdictOf(body) : claimOf(body),
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      }),
    );
  });
});

const startRunner = (): ChildProcess => {
  const address = router.address();
  if (address === null || typeof address === 'string')
    throw new Error('the stub router listens on no port');
  return spawn(process.execPath, [WORKER, 'run'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      GABRIEL_AGENT_PASSWORD: held.GABRIEL_AGENT_PASSWORD,
      GABRIEL_DATABASE: held.GABRIEL_DATABASE,
      OPENROUTER_BASE_URL: `http://127.0.0.1:${String(address.port)}/v1`,
      SEARXNG_URL: `http://127.0.0.1:${String(address.port)}`,
      BRAVE_SEARCH_API_KEY: '',
      LEAD_TOKEN_CAP: '10000',
      OPENROUTER_API_KEY: 'a-stub-key',
      EXTRACTOR_MODEL: MODEL,
      EXTRACTOR_FAMILY: 'stub-family',
      EXTRACTOR_FIRST_WAIT_MS: '1',
      EXTRACTOR_WAIT_GROWTH: '1',
      EXTRACTOR_MAX_WAIT_MS: '1',
      EXTRACTOR_TIMEOUT_MS: '5000',
      EXTRACTOR_MAX_ANSWER_TOKENS: '200',
      EXTRACTOR_TOKEN_CAP: '10000',
      EXTRACTOR_TURN_CAP: '10',
      EXTRACTOR_CHUNK_CAP: '6000',
      CHECKER_MODEL: CHECKER,
      CHECKER_FAMILY: 'other-family',
      CHECKER_FIRST_WAIT_MS: '1',
      CHECKER_WAIT_GROWTH: '1',
      CHECKER_MAX_WAIT_MS: '1',
      CHECKER_TIMEOUT_MS: '5000',
      CHECKER_MAX_ANSWER_TOKENS: '200',
    },
  });
};

const stopRunner = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
};

const store = async (document: string): Promise<void> => {
  await db.query(
    `SELECT public.put_document($1, 'file', 'A test of the runner entry point', $2, NULL, NULL,
       NULL, 'application/pdf', '2026-10-06'::date)`,
    [document, `raw/${document}.pdf`],
  );
  await db.query('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    document,
    JSON.stringify([PAGE]),
    'e2e@1',
  ]);
};

const enqueueExtract = CATALOGUE.find((tool) => tool.name === 'enqueue_extract');

const queue = async (document: string): Promise<string> => {
  if (enqueueExtract === undefined) throw new Error('the catalogue holds no enqueue_extract');
  const outcome = await callTool(
    enqueueExtract,
    { query: (text, values) => db.query(text, values) },
    { document },
  );
  if (!outcome.ok) throw new Error(outcome.refusal);
  return z.object({ jobId: z.uuid() }).parse(outcome.output).jobId;
};

const jobs = z.array(
  z.object({
    id: z.uuid(),
    kind: z.string(),
    status: z.string(),
    failure_reason: z.string().nullable(),
  }),
);

const jobsOf = async (document: string) =>
  jobs.parse(
    (
      await db.query(
        `SELECT id, kind, status, failure_reason FROM public.jobs
          WHERE document_id = $1 AND kind <> 'store_only' ORDER BY created_at, id`,
        [document],
      )
    ).rows,
  );

const pending = z.array(
  z.object({ label: z.string(), dissent: z.boolean(), reason: z.string().nullable() }),
);

const pendingOf = async (document: string): Promise<z.output<typeof pending>> =>
  pending.parse(
    (
      await db.query(
        `SELECT payload ->> 'label' AS label, dissent, dissent_reason AS reason
           FROM public.proposals
          WHERE status = 'pending' AND $1 = ANY(src::text[])`,
        [document],
      )
    ).rows,
  );

const citationsOf = async (document: string): Promise<number> =>
  z
    .array(z.object({ n: z.number() }))
    .parse(
      (
        await db.query('SELECT count(*)::int AS n FROM public.citation WHERE doc_id = $1', [
          document,
        ])
      ).rows,
    )[0]?.n ?? 0;

// The runner waits between two empty reads of the queue, so a test looks again until each job
// of the document has ended.
const ended = async (document: string, count: number): Promise<z.infer<typeof jobs>> => {
  for (let round = 0; round < 200; round += 1) {
    const found = await jobsOf(document);
    if (found.length === count && found.every((job) => ['done', 'failed'].includes(job.status)))
      return found;
    await sleepFor(100);
  }
  throw new Error(`the jobs of ${document} did not end: ${JSON.stringify(await jobsOf(document))}`);
};

beforeAll(async () => {
  router.listen(0, '127.0.0.1');
  await once(router, 'listening');
  await db.connect();
});

// The ledger tables refuse a delete with a trigger. The test turns each trigger off and on again
// inside one transaction, so no other session sees the table without its trigger.
const LEDGER_TRIGGERS = [
  ['public.citation', 'citation_append_only'],
  ['public.proposals', 'proposals_append_only'],
  ['public.model_call', 'model_call_append_only'],
] as const;

// The lead names no document, so its rows are found by its text.
const LEAD_JOBS = 'SELECT id FROM public.jobs WHERE lead = $1';

const deleteRowsOf = async (documents: readonly string[]): Promise<void> => {
  await db.query('BEGIN');
  try {
    for (const [table, trigger] of LEDGER_TRIGGERS)
      await db.query(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
    await db.query(`DELETE FROM public.model_call WHERE job_id IN (${LEAD_JOBS})`, [LEAD]);
    await db.query(`DELETE FROM public.lead_document WHERE job_id IN (${LEAD_JOBS})`, [LEAD]);
    await db.query('DELETE FROM public.jobs WHERE lead = $1', [LEAD]);
    const jobIds = `SELECT id FROM public.jobs WHERE document_id = ANY($1::text[])`;
    await db.query('DELETE FROM public.citation WHERE doc_id = ANY($1::text[])', [documents]);
    await db.query('DELETE FROM public.proposals WHERE src::text[] && $1::text[]', [documents]);
    await db.query(`DELETE FROM public.model_call WHERE job_id IN (${jobIds})`, [documents]);
    await db.query('DELETE FROM public.document_text WHERE document_id = ANY($1::text[])', [
      documents,
    ]);
    await db.query('DELETE FROM public.jobs WHERE document_id = ANY($1::text[])', [documents]);
    await db.query('DELETE FROM public.documents WHERE id = ANY($1::text[])', [documents]);
    for (const [table, trigger] of LEDGER_TRIGGERS)
      await db.query(`ALTER TABLE ${table} ENABLE ALWAYS TRIGGER ${trigger}`);
    await db.query('COMMIT');
  } catch (cause) {
    await db.query('ROLLBACK');
    throw cause;
  }
};

afterAll(async () => {
  try {
    await deleteRowsOf([RECOVERED, FLAKY]);
  } finally {
    await db.end();
    router.close();
  }
});

test('a queued document gives checked proposals, and a crash or a failure blocks no document', async () => {
  // A runner that stopped in the middle of a job left this job running.
  await store(RECOVERED);
  const recovered = await queue(RECOVERED);
  await db.query("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [recovered]);
  await db.query('SET SESSION AUTHORIZATION gabriel_agent');
  const claimed = z
    .array(z.object({ job_id: z.uuid() }))
    .parse((await db.query('SELECT job_id FROM public.claim_job()')).rows);
  await db.query('RESET SESSION AUTHORIZATION');
  expect(claimed).toStrictEqual([{ job_id: recovered }]);

  await store(FLAKY);
  await queue(FLAKY);

  const first = startRunner();
  try {
    const recoveredJobs = await ended(RECOVERED, 1);
    const flakyJobs = await ended(FLAKY, 1);

    expect(recoveredJobs.map(({ kind, status }) => ({ kind, status }))).toStrictEqual([
      { kind: 'extract_text', status: 'done' },
    ]);
    expect(await pendingOf(RECOVERED)).toStrictEqual([
      { label: LABEL, dissent: false, reason: null },
    ]);

    expect(flakyJobs[0]?.status).toBe('failed');
    expect(flakyJobs[0]?.failure_reason).toMatch(/\S/u);
    expect(await pendingOf(FLAKY)).toStrictEqual([]);
  } finally {
    await stopRunner(first);
  }

  // The operator queues the failed document again, and the next start of the runner reads it.
  // A second extraction of a document that gave its proposals writes no second proposal.
  await queue(FLAKY);
  await queue(RECOVERED);
  const second = startRunner();
  try {
    const flakyJobs = await ended(FLAKY, 2);
    expect(flakyJobs.map((job) => job.status)).toStrictEqual(['failed', 'done']);
    // The checker does not support the claim of this document, so the claim waits as disputed,
    // with the reason of the checker.
    expect(await pendingOf(FLAKY)).toStrictEqual([
      {
        label: LABEL,
        dissent: true,
        reason: 'the checker says not_supported: the page names another tanker',
      },
    ]);

    const recoveredJobs = await ended(RECOVERED, 2);
    expect(recoveredJobs.map((job) => job.status)).toStrictEqual(['done', 'done']);
    expect(await pendingOf(RECOVERED)).toStrictEqual([
      { label: LABEL, dissent: false, reason: null },
    ]);
    expect(await citationsOf(RECOVERED)).toBe(1);
  } finally {
    await stopRunner(second);
  }
});

const startLead = CATALOGUE.find((tool) => tool.name === 'start_lead');

const leadJob = z.array(
  z.object({ status: z.string(), failure_reason: z.string().nullable(), calls: z.number() }),
);

const LEAD_STATE = `SELECT j.status, j.failure_reason,
    (SELECT count(*)::int FROM public.model_call m WHERE m.job_id = j.id) AS calls
  FROM public.jobs j WHERE j.id = $1`;

test('a lead runs its tool calls through the runner, searches, and proposes nothing', async () => {
  if (startLead === undefined) throw new Error('the catalogue holds no start_lead');
  const outcome = await callTool(
    startLead,
    { query: (text, values) => db.query(text, values) },
    { lead: LEAD },
  );
  if (!outcome.ok) throw new Error(outcome.refusal);
  const { jobId } = z.object({ jobId: z.uuid() }).parse(outcome.output);

  const runner = startRunner();
  try {
    let state: z.infer<typeof leadJob> = [];
    for (let round = 0; round < 200; round += 1) {
      state = leadJob.parse((await db.query(LEAD_STATE, [jobId])).rows);
      if (['done', 'failed'].includes(state[0]?.status ?? '')) break;
      await sleepFor(100);
    }
    expect(state).toStrictEqual([{ status: 'done', failure_reason: null, calls: 2 }]);
    expect(searched).toStrictEqual([LEAD]);
    const proposals = await db.query(
      `SELECT p.id FROM public.proposals p JOIN public.model_call m ON m.id = p.model_call_id
        WHERE m.job_id = $1`,
      [jobId],
    );
    expect(proposals.rows).toStrictEqual([]);
  } finally {
    await stopRunner(runner);
  }
});
