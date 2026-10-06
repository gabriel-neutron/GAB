import { Pool, type PoolClient } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import type { RunnerAgent } from './agents.ts';
import { openRunner, type Step } from './runner.ts';
import {
  completionOf,
  depsOf,
  forecastOf,
  gatewayOf,
  quotaSpentResponse,
  stubAgent,
  type StubGateway,
} from './runner-fixture.ts';

// Departure: each test runs in one transaction that rolls back, on one connection that signs as
// the owner to seed and to read, and as gabriel_agent while the runner works. A committed claim
// would remove a queued job from the suites that count the queue, and these jobs commit nothing.
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

const DOCUMENT = 'doc_runner_suite';
const CLAIM_OK = '{"claim":"A vessel of the runner suite"}';
const ONE_CLAIM = () => completionOf(CLAIM_OK);

const PUT = `SELECT public.put_document($1, 'file', 'A test of the runner',
  'raw/runner-suite.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-01'::date)`;

// Departure: the queue holds other jobs, and the claim takes the oldest. The seeded row is made
// the oldest so that the runner takes it first, and no other row is touched or locked.
const OLDEST = "UPDATE public.jobs SET created_at = '1970-01-01' WHERE document_id = $1";

const jobRow = z.object({
  status: z.string(),
  attempts: z.number().int(),
  claimed_at: z.date().nullable(),
  failure_reason: z.string().nullable(),
});

interface Held {
  readonly client: PoolClient;
  readonly asOwner: <T>(work: () => Promise<T>) => Promise<T>;
  readonly asAgent: <T>(work: () => Promise<T>) => Promise<T>;
  readonly job: string;
  readonly read: () => Promise<z.infer<typeof jobRow>>;
}

const inTransaction = async (
  kind: 'extract_text' | 'map_structured',
  work: (held: Held) => Promise<void>,
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(PUT, [DOCUMENT]);
    const [made] = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        (await client.query('SELECT public.enqueue_job($1, $2) AS id', [DOCUMENT, kind])).rows,
      );
    if (made === undefined) throw new Error('the seed queued no job');
    await client.query(OLDEST, [DOCUMENT]);

    const as = async <T>(role: string, inside: () => Promise<T>): Promise<T> => {
      await client.query(`SET LOCAL SESSION AUTHORIZATION ${role}`);
      try {
        return await inside();
      } finally {
        await client.query('RESET SESSION AUTHORIZATION');
      }
    };
    const asOwner = <T>(inside: () => Promise<T>): Promise<T> => as('gabriel', inside);
    const read = async () => {
      const found = await client.query(
        'SELECT status, attempts, claimed_at, failure_reason FROM public.jobs WHERE id = $1',
        [made.id],
      );
      return jobRow.parse(found.rows[0]);
    };
    await work({
      client,
      asOwner,
      asAgent: (inside) => as('gabriel_agent', inside),
      job: made.id,
      read,
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const stepOf = async (
  held: Held,
  agents: readonly RunnerAgent[],
  gateway: StubGateway,
): Promise<{ step: Step; slept: number[] }> => {
  const { deps, slept } = depsOf(held.client, agents, gateway);
  return held.asAgent(async () => {
    const runner = await openRunner(deps);
    return { step: await runner.step(), slept };
  });
};

const calls = z.array(
  z.object({
    outcome: z.string(),
    agent: z.string(),
    agent_version: z.string(),
    requested_model: z.string(),
    served_model: z.string().nullable(),
    prompt_sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    latency_ms: z.number().int(),
  }),
);

const callsOf = async (held: Held) =>
  calls.parse(
    (
      await held.client.query(
        `SELECT outcome, agent, agent_version, requested_model, served_model, prompt_sha256,
                latency_ms FROM public.model_call WHERE job_id = $1 ORDER BY created_at, id`,
        [held.job],
      )
    ).rows,
  );

const proposalsOf = async (held: Held) =>
  z.array(z.object({ id: z.uuid(), idempotency_key: z.string(), model_call_id: z.uuid() })).parse(
    (
      await held.client.query(
        `SELECT p.id, p.idempotency_key, p.model_call_id FROM public.proposals p
             JOIN public.model_call m ON m.id = p.model_call_id
            WHERE m.job_id = $1 ORDER BY p.id`,
        [held.job],
      )
    ).rows,
  );

test('a job goes queued, running, done, and its proposals carry the key and a call id', async () => {
  await inTransaction('extract_text', async (held) => {
    const seen: string[] = [];
    const agent = stubAgent({ seen: (status) => Promise.resolve(void seen.push(status)) });
    const gateway = gatewayOf(ONE_CLAIM);

    const before = await held.read();
    const { step } = await stepOf(held, [agent], gateway);
    const after = await held.read();

    expect(before).toMatchObject({ status: 'queued', attempts: 0 });
    expect(seen).toStrictEqual(['running']);
    expect(step).toStrictEqual({ did: 'done', job: held.job });
    expect(after).toMatchObject({ status: 'done', attempts: 1 });

    const written = await proposalsOf(held);
    const recorded = await callsOf(held);
    expect(written).toHaveLength(1);
    expect(written[0]?.idempotency_key).toMatch(/^[0-9a-f]{64}$/u);
    expect(recorded).toStrictEqual([
      expect.objectContaining({
        outcome: 'ok',
        agent: 'stub',
        agent_version: 'v1',
        requested_model: 'stub-family/stub-model',
        served_model: 'stub-family/stub-model',
      }),
    ]);
    expect(recorded[0]?.latency_ms).toBeGreaterThan(0);
  });
});

test('a quota failure returns the job to the queue with the same attempt count', async () => {
  await inTransaction('extract_text', async (held) => {
    const gateway = gatewayOf(quotaSpentResponse);

    const { step, slept } = await stepOf(held, [stubAgent()], gateway);
    const after = await held.read();

    expect(step).toStrictEqual({ did: 'released', job: held.job, reason: 'quota' });
    expect(after).toMatchObject({ status: 'queued', attempts: 0, claimed_at: null });
    expect(slept).toStrictEqual([600_000]);
    expect((await callsOf(held)).map((call) => call.outcome)).toStrictEqual(['quota']);
    expect(await proposalsOf(held)).toStrictEqual([]);
  });
});

test('a gateway with no quota left pauses the runner before the claim', async () => {
  await inTransaction('extract_text', async (held) => {
    const gateway = gatewayOf(ONE_CLAIM, () => forecastOf(0));

    const { step } = await stepOf(held, [stubAgent()], gateway);

    expect(step).toStrictEqual({ did: 'paused' });
    expect(await held.read()).toMatchObject({ status: 'queued', attempts: 0, claimed_at: null });
    expect(gateway.chats()).toBe(0);
  });
});

test('a requeued job writes no second proposal for the same key', async () => {
  await inTransaction('extract_text', async (held) => {
    const agent = stubAgent({ stopsAfterWriting: true });
    const gateway = gatewayOf(ONE_CLAIM);

    const first = await stepOf(held, [agent], gateway);
    expect(first.step).toStrictEqual({ did: 'left', job: held.job });
    expect(await held.read()).toMatchObject({ status: 'running', attempts: 1 });
    const written = await proposalsOf(held);
    expect(written).toHaveLength(1);

    // The lease of the first claim ends, and the release of the operator returns the row.
    await held.client.query(
      "UPDATE public.jobs SET claimed_at = now() - interval '2 hours' WHERE id = $1",
      [held.job],
    );
    await held.client.query('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await held.client.query('SELECT public.release_expired_claims()');
    await held.client.query('RESET SESSION AUTHORIZATION');
    expect(await held.read()).toMatchObject({ status: 'queued', attempts: 1 });

    const second = await stepOf(held, [agent], gateway);

    expect(second.step).toStrictEqual({ did: 'done', job: held.job });
    expect(await held.read()).toMatchObject({ status: 'done', attempts: 2 });
    const all = await proposalsOf(held);
    expect(all.map((row) => row.id)).toStrictEqual(written.map((row) => row.id));
    expect(await callsOf(held)).toHaveLength(2);
  });
});

test('two readers of one chunk write two proposals', async () => {
  await inTransaction('extract_text', async (held) => {
    const reader = { ...stubAgent(), name: 'second-reader' };
    const gateway = gatewayOf(ONE_CLAIM);

    await stepOf(held, [stubAgent({ stopsAfterWriting: true })], gateway);
    await held.client.query(
      "UPDATE public.jobs SET claimed_at = now() - interval '2 hours' WHERE id = $1",
      [held.job],
    );
    await held.client.query('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await held.client.query('SELECT public.release_expired_claims()');
    await held.client.query('RESET SESSION AUTHORIZATION');
    await stepOf(held, [reader], gateway);

    const written = await proposalsOf(held);
    expect(written).toHaveLength(2);
    expect(new Set(written.map((row) => row.idempotency_key)).size).toBe(2);
  });
});

test('a job of a kind with no agent fails with that reason', async () => {
  await inTransaction('map_structured', async (held) => {
    const { step } = await stepOf(held, [stubAgent()], gatewayOf(ONE_CLAIM));
    const after = await held.read();

    expect(step).toStrictEqual({ did: 'failed', job: held.job });
    expect(after.status).toBe('failed');
    expect(after.failure_reason).toMatch(/no agent is registered for the kind map_structured/u);
  });
});

test('a failure on the first claim leaves the row running for the end of its lease', async () => {
  await inTransaction('extract_text', async (held) => {
    const down = gatewayOf(() => new Response('{}', { status: 503 }));

    const { step } = await stepOf(held, [stubAgent()], down);

    expect(step).toStrictEqual({ did: 'left', job: held.job });
    expect(await held.read()).toMatchObject({
      status: 'running',
      attempts: 1,
      failure_reason: null,
    });
    expect((await callsOf(held)).map((call) => call.outcome)).toStrictEqual(['network']);
  });
});

test('a failure on the third claim ends the job as failed with the reason of the failure', async () => {
  await inTransaction('extract_text', async (held) => {
    await held.client.query('UPDATE public.jobs SET attempts = 2 WHERE id = $1', [held.job]);
    const down = gatewayOf(() => new Response('{}', { status: 503 }));

    const { step } = await stepOf(held, [stubAgent()], down);
    const after = await held.read();

    expect(step).toStrictEqual({ did: 'failed', job: held.job });
    expect(after).toMatchObject({ status: 'failed', attempts: 3 });
    expect(after.failure_reason).toBe('the model service did not answer, and nothing was written');
  });
});
