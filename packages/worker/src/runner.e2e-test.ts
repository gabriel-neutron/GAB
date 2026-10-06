// The runner as the operator starts it: the real entry point in a child process, the test
// database, and a local server in place of the model gateway. The rows commit, so this project
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

// The gateway refuses the first question about the flaky document, and answers each other
// question with one claim that the page states.
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

const gateway: Server = createServer((request, response) => {
  void bodyOf(request).then((body) => {
    response.setHeader('content-type', 'application/json');
    if (body.includes(FLAKY) && !flakyRefused) {
      flakyRefused = true;
      response.statusCode = 400;
      response.end(JSON.stringify({ error: { message: 'the stub refuses this question' } }));
      return;
    }
    response.end(
      JSON.stringify({
        model: MODEL,
        choices: [
          { message: { role: 'assistant', content: claimOf(body) }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      }),
    );
  });
});

const startRunner = (): ChildProcess => {
  const address = gateway.address();
  if (address === null || typeof address === 'string')
    throw new Error('the stub gateway listens on no port');
  return spawn(process.execPath, [WORKER, 'run'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      GABRIEL_AGENT_PASSWORD: held.GABRIEL_AGENT_PASSWORD,
      GABRIEL_DATABASE: held.GABRIEL_DATABASE,
      FREELLMAPI_BASE_URL: `http://127.0.0.1:${String(address.port)}/v1`,
      FREELLMAPI_API_KEY: 'a-stub-key',
      EXTRACTOR_ENDPOINT: 'freellmapi',
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

const pendingOf = async (document: string): Promise<string[]> =>
  z
    .array(z.object({ label: z.string() }))
    .parse(
      (
        await db.query(
          `SELECT payload ->> 'label' AS label FROM public.proposals
            WHERE status = 'pending' AND $1 = ANY(src::text[])`,
          [document],
        )
      ).rows,
    )
    .map((row) => row.label);

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
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  await db.connect();
});

// The ledger tables refuse a delete with a trigger. The test turns each trigger off and on again
// inside one transaction, so no other session sees the table without its trigger.
const LEDGER_TRIGGERS = [
  ['public.citation', 'citation_append_only'],
  ['public.proposals', 'proposals_append_only'],
  ['public.model_call', 'model_call_append_only'],
] as const;

const deleteRowsOf = async (documents: readonly string[]): Promise<void> => {
  await db.query('BEGIN');
  try {
    for (const [table, trigger] of LEDGER_TRIGGERS)
      await db.query(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
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
    gateway.close();
  }
});

test('a queued document gives pending proposals, and a crash or a failure blocks no document', async () => {
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

  // A database that ran 0036 can hold a queued second reading, and no agent runs that kind now.
  await db.query("INSERT INTO public.jobs (document_id, kind) VALUES ($1, 'second_read')", [
    RECOVERED,
  ]);

  await store(FLAKY);
  await queue(FLAKY);

  const first = startRunner();
  try {
    const recoveredJobs = await ended(RECOVERED, 2);
    const flakyJobs = await ended(FLAKY, 1);

    expect(recoveredJobs.map(({ kind, status }) => ({ kind, status }))).toStrictEqual([
      { kind: 'extract_text', status: 'done' },
      { kind: 'second_read', status: 'failed' },
    ]);
    expect(recoveredJobs[1]?.failure_reason).toMatch(/second_read/u);
    expect(await pendingOf(RECOVERED)).toStrictEqual([LABEL]);

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
    expect(await pendingOf(FLAKY)).toStrictEqual([LABEL]);

    const recoveredJobs = await ended(RECOVERED, 3);
    expect(recoveredJobs.map((job) => job.status)).toStrictEqual(['done', 'failed', 'done']);
    expect(await pendingOf(RECOVERED)).toStrictEqual([LABEL]);
    expect(await citationsOf(RECOVERED)).toBe(1);
  } finally {
    await stopRunner(second);
  }
});
