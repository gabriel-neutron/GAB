import { randomBytes, randomUUID } from 'node:crypto';

import { openStore, putObject } from '@gab/store';
import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';

const pool = openPool();
const store = openStore();
// No door under test reads an object back, so this one refuses every read.
const NO_READ = { read: () => Promise.reject(new Error('no door under test reads the raw store')) };
const app = writeRoutes(pool, { put: (object) => putObject(store, object) }, NO_READ);

// Departure: the runner is not part of this suite, so the owner moves a job to `running` and the
// worker role ends it through its own doors, as the runner does.
const secrets = z.object({
  POSTGRES_PASSWORD: z.string().min(1),
  GABRIEL_AGENT_PASSWORD: z.string().min(1),
  GABRIEL_READ_PASSWORD: z.string().min(1),
  GABRIEL_DATABASE: z.literal('gabriel_test'),
});
const held = secrets.parse(process.env);
const addressOf = (role: string, password: string): string =>
  `postgresql://${role}:${encodeURIComponent(password)}@127.0.0.1:5432/${held.GABRIEL_DATABASE}`;
const owner = new Pool({ connectionString: addressOf('gabriel', held.POSTGRES_PASSWORD) });
const agent = new Pool({
  connectionString: addressOf('gabriel_agent', held.GABRIEL_AGENT_PASSWORD),
});
const reader = new Pool({
  connectionString: addressOf('gabriel_read', held.GABRIEL_READ_PASSWORD),
});

afterAll(async () => {
  await Promise.all([owner.end(), agent.end(), reader.end(), pool.end()]);
  store.client.destroy();
});

const OWN = { host: '127.0.0.1:5177', 'content-type': 'application/json' };

const send = async (door: string, body: unknown): Promise<[number, unknown]> => {
  const answer = await app.request(`/write/${door}`, {
    method: 'POST',
    headers: OWN,
    body: JSON.stringify(body),
  });
  return [answer.status, await answer.json()];
};

const stored = z.object({ documentId: z.string() });

// One run never meets the bytes of an earlier run: an object stays in the bucket for ever.
const storedDocument = async (): Promise<string> => {
  const [status, reply] = await send('upload-document', {
    fileName: 'register.txt',
    title: 'A register extract of a test vessel',
    content: Buffer.from(`MV Test Ledger, IMO 9000001, ${randomBytes(8).toString('hex')}`).toString(
      'base64',
    ),
    retrievedAt: '2026-10-01',
  });
  expect(status).toBe(200);
  return stored.parse(reply).documentId;
};

const queued = z.object({ jobId: z.uuid() });

const queue = async (documentId: string): Promise<string> => {
  const [status, reply] = await send('queue-extraction', { documentId });
  expect(status).toBe(200);
  return queued.parse(reply).jobId;
};

const running = (jobId: string) =>
  owner.query("UPDATE public.jobs SET status = 'running', claimed_at = now() WHERE id = $1::uuid", [
    jobId,
  ]);

const SHA = 'a'.repeat(64);

// The runner records each call to a model before it proposes, and a proposal names its call.
const proposedBy = async (jobId: string, documentId: string): Promise<string> => {
  const call = await agent.query<{ id: string }>(
    `SELECT public.record_model_call('extractor', 'v1', 'openrouter', 'a-model', $1, 10, 'ok',
       $2::uuid, 'a-model') AS id`,
    [SHA, jobId],
  );
  const page = await owner.query<{ extractor: string }>(
    'SELECT extractor FROM public.document_text WHERE document_id = $1 AND page = 1',
    [documentId],
  );
  const made = await agent.query<{ id: string }>(
    'SELECT proposal_id AS id FROM public.propose_batch($1::jsonb)',
    [
      JSON.stringify([
        {
          id: randomUUID(),
          op: 'create_entity',
          payload: { type: 'vessel', label: 'MV Test Ledger' },
          src: [documentId],
          names: [],
          model_call_id: call.rows[0]?.id,
          originator: 'A register',
          modality: 'asserts',
          citations: [
            {
              document: documentId,
              text_extractor: page.rows[0]?.extractor,
              page: 1,
              start: 0,
              end: 14,
            },
          ],
        },
      ]),
    ],
  );
  return made.rows[0]?.id ?? '';
};

test('an extraction waits in the queue, and its status shows it', async () => {
  const documentId = await storedDocument();
  const jobId = await queue(documentId);

  expect(await send('document-jobs', { documentId })).toStrictEqual([
    200,
    {
      jobs: [
        {
          id: jobId,
          kind: 'extract_text',
          status: 'queued',
          reason: null,
          refused: null,
          proposals: 0,
        },
      ],
    },
  ]);
});

test('a second extraction is refused while the first can still run', async () => {
  const documentId = await storedDocument();
  await queue(documentId);

  expect(await send('queue-extraction', { documentId })).toStrictEqual([
    422,
    {
      refusal: `document ${documentId} has a job of kind extract_text that is queued or runs already`,
    },
  ]);
});

test('a done extraction counts the proposals it made and the parts that were refused', async () => {
  const documentId = await storedDocument();
  const jobId = await queue(documentId);
  await running(jobId);
  const proposalId = await proposedBy(jobId, documentId);
  await agent.query('SELECT public.complete_job($1::uuid, 3, 2, $2)', [
    jobId,
    'item a: the page does not hold the excerpt',
  ]);

  try {
    expect(await send('document-jobs', { documentId })).toStrictEqual([
      200,
      {
        jobs: [
          {
            id: jobId,
            kind: 'extract_text',
            status: 'done',
            reason: null,
            refused: '2 parts refused: item a: the page does not hold the excerpt',
            proposals: 1,
          },
        ],
      },
    ]);
  } finally {
    // The ledger keeps the act, so the test decides it and the review queue stays as it was.
    await send('reject-unit', { unitId: proposalId, reason: 'out_of_scope' });
  }
});

test('a failed extraction shows its reason and is queued again', async () => {
  const documentId = await storedDocument();
  const failedId = await queue(documentId);
  await running(failedId);
  await agent.query('SELECT public.fail_job($1::uuid, $2)', [failedId, 'the model did not answer']);

  const againId = await queue(documentId);

  expect(await send('document-jobs', { documentId })).toStrictEqual([
    200,
    {
      jobs: [
        {
          id: againId,
          kind: 'extract_text',
          status: 'queued',
          reason: null,
          refused: null,
          proposals: 0,
        },
        {
          id: failedId,
          kind: 'extract_text',
          status: 'failed',
          reason: 'the model did not answer',
          refused: null,
          proposals: 0,
        },
      ],
    },
  ]);
});

test('a document the record does not hold is refused', async () => {
  expect(
    await send('queue-extraction', { documentId: 'doc_absent_from_the_record' }),
  ).toStrictEqual([422, { refusal: 'the act names a document or an element that does not exist' }]);
});

test('a body that names no document is refused', async () => {
  expect(await send('document-jobs', {})).toStrictEqual([
    422,
    { refusal: 'the body names no document' },
  ]);
});

test('the public read role cannot read the status of a job through the writer door', async () => {
  await expect(
    reader.query("SELECT * FROM public.document_jobs('doc_absent_from_the_record')"),
  ).rejects.toMatchObject({ code: '42501' });
});
