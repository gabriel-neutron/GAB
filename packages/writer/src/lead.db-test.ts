import { randomUUID } from 'node:crypto';

import { openStore, putObject } from '@gab/store';
import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { connectionString } from '../../../tools/db-runtime.ts';
import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';

const pool = openPool();
const store = openStore();
// No door under test reads an object back, so this one refuses every read.
const NO_READ = { read: () => Promise.reject(new Error('no door under test reads the raw store')) };
const app = writeRoutes(pool, { put: (object) => putObject(store, object) }, NO_READ);

// Departure: the runner is not part of this suite, so the owner moves a lead to `running` and the
// worker role records its documents through its own door, as the runner does.
const { GABRIEL_DATABASE } = z
  .object({ GABRIEL_DATABASE: z.literal('gabriel_test') })
  .parse(process.env);
const owner = new Pool({ connectionString: connectionString('superuser', GABRIEL_DATABASE) });
const agent = new Pool({ connectionString: connectionString('agent', GABRIEL_DATABASE) });
const research = new Pool({ connectionString: connectionString('research', GABRIEL_DATABASE) });
const reader = new Pool({ connectionString: connectionString('read', GABRIEL_DATABASE) });

// The rows commit, and the runner of a later project takes each queued job. So each lead that a
// test starts ends here, as a lead that failed.
const started: string[] = [];

afterAll(async () => {
  try {
    await owner.query(
      `UPDATE public.jobs SET status = 'failed', claimed_at = coalesce(claimed_at, now()),
              failure_reason = 'a test of the writer ended this lead', finished_at = now()
        WHERE id = ANY($1::uuid[]) AND status IN ('queued', 'running')`,
      [started],
    );
  } finally {
    await Promise.all([owner.end(), agent.end(), research.end(), reader.end(), pool.end()]);
    store.client.destroy();
  }
});

const OWN = { host: '127.0.0.1:5177', 'content-type': 'application/json' };

const send = async (door: string, body: unknown): Promise<[number, unknown]> => {
  const answer = await app.request(door, {
    method: 'POST',
    headers: OWN,
    body: JSON.stringify(body),
  });
  return [answer.status, await answer.json()];
};

const leadShape = z.object({
  id: z.uuid(),
  lead: z.string(),
  by: z.string(),
  status: z.string(),
  reason: z.string().nullable(),
  documents: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().nullable() })),
});

const leadsOf = async () => {
  const [status, reply] = await send('/private/leads', {});
  expect(status).toBe(200);
  return z.object({ leads: z.array(leadShape) }).parse(reply).leads;
};

const startLead = async (lead: string): Promise<string> => {
  const [status, reply] = await send('/write/start-lead', { lead });
  expect(status).toBe(200);
  const { jobId } = z.object({ jobId: z.uuid() }).parse(reply);
  started.push(jobId);
  return jobId;
};

test('the operator starts a lead, and the private read shows it with what it stored', async () => {
  const lead = `Company ${randomUUID()} and its vessels`;
  const jobId = await startLead(`  ${lead} `);

  expect((await leadsOf()).find((one) => one.id === jobId)).toStrictEqual({
    id: jobId,
    lead,
    by: 'gabriel_app',
    status: 'queued',
    reason: null,
    documents: [],
  });

  // The worker runs the lead and records the page that it stored.
  await owner.query(
    "UPDATE public.jobs SET status = 'running', claimed_at = now() WHERE id = $1::uuid",
    [jobId],
  );
  await agent.query('SELECT public.record_lead_document($1::uuid, $2)', [jobId, 'manual']);
  await agent.query('SELECT public.record_lead_document($1::uuid, $2)', [jobId, 'manual']);

  const shown = (await leadsOf()).find((one) => one.id === jobId);
  expect(shown?.status).toBe('running');
  expect(shown?.documents.map((one) => one.id)).toStrictEqual(['manual']);
});

test('a lead with no text is refused', async () => {
  expect(await send('/write/start-lead', { lead: '   ' })).toStrictEqual([
    422,
    { refusal: 'a lead states what to search for' },
  ]);
  expect(await send('/write/start-lead', {})).toStrictEqual([
    422,
    { refusal: 'the body states no lead' },
  ]);
});

test('the research AI starts a lead, and the worker starts none', async () => {
  const made = await research.query<{ id: string }>('SELECT public.start_lead($1)::text AS id', [
    'A lead of the research AI',
  ]);
  const jobId = made.rows[0]?.id ?? '';
  started.push(jobId);
  expect((await leadsOf()).find((one) => one.id === jobId)?.by).toBe('gabriel_research');

  await expect(
    agent.query("SELECT public.start_lead('a lead of the worker')"),
  ).rejects.toMatchObject({ code: '42501' });
});

test('only the operator reads a lead', async () => {
  const jobId = await startLead('A private lead');

  // The public read reaches no part of the queue.
  await expect(reader.query('SELECT * FROM public.lead_jobs()')).rejects.toMatchObject({
    code: '42501',
  });
  await expect(reader.query('SELECT * FROM api.job')).rejects.toMatchObject({ code: '42501' });

  // A machine role reads no other lead. The worker gets the text of the lead that it claims, and
  // the research AI gets the job id of the lead that it starts.
  for (const machine of [agent, research])
    await expect(machine.query('SELECT * FROM public.lead_jobs()')).rejects.toMatchObject({
      code: '42501',
    });
  await expect(agent.query('SELECT lead FROM public.jobs')).rejects.toMatchObject({
    code: '42501',
  });
  await expect(research.query('SELECT lead FROM public.jobs')).rejects.toMatchObject({
    code: '42501',
  });
  const listed = await research.query('SELECT id FROM api.job WHERE id = $1::uuid', [jobId]);
  expect(listed.rows).toStrictEqual([]);
});

test('a request from another site starts no lead and reads no lead', async () => {
  const lead = `A lead from another site ${randomUUID()}`;
  for (const door of ['/write/start-lead', '/private/leads']) {
    const answer = await app.request(door, {
      method: 'POST',
      headers: { ...OWN, origin: 'http://attacker.example' },
      body: JSON.stringify({ lead }),
    });
    expect([answer.status, await answer.json()]).toStrictEqual([
      403,
      { refusal: 'the request does not come from this site' },
    ]);
  }
  expect((await leadsOf()).some((one) => one.lead === lead)).toBe(false);
});
