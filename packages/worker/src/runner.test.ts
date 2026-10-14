// The runner survives a fault of the database connection: it waits, puts back the job in hand and
// goes on. Any other fault still stops it. No server runs here: a fake connection answers by the
// text of the statement.

import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentResult, RunnerAgent } from './agents.ts';
import type { Queryable } from './queryable.ts';
import { openRunner } from './runner.ts';

const fault = (code: string): Error =>
  Object.assign(new Error(`connect ${code} 127.0.0.1:5432`), { code });

const EMPTY = { rows: [] };

const job = () => ({
  rows: [
    {
      job_id: randomUUID(),
      job_document: 'doc_a_test',
      job_kind: 'extract_text',
      job_lead: null,
      job_mapping: null,
      job_author: null,
      job_budget: null,
    },
  ],
});

type Claim = () => { rows: unknown[] };

/** A fake connection. Each claim takes the next step of the script, and the last step aborts the
 * runner. Another statement answers by its text, and `completing` may throw. */
const scripted = (
  steps: readonly Claim[],
  completing: () => unknown = () => ({ status: 'done' }),
) => {
  const stop = new AbortController();
  const seen: string[] = [];
  const queue = [...steps];
  const db: Queryable = {
    query: (text) => {
      seen.push(text);
      if (text.includes('runner_settings'))
        return Promise.resolve({ rows: [{ empty_wait_seconds: 1 }] });
      if (text.includes('requeue_running_jobs'))
        return Promise.resolve({ rows: [{ requeue_running_jobs: 0 }] });
      if (text.includes('claim_job')) {
        const next = queue.shift();
        if (next === undefined) throw new Error('the runner claimed more than the script holds');
        if (queue.length === 0) stop.abort();
        return Promise.resolve(next());
      }
      if (text.includes('complete_job')) return Promise.resolve({ rows: [completing()] });
      return Promise.resolve(EMPTY);
    },
  };
  const count = (word: string): number => seen.filter((text) => text.includes(word)).length;
  return { db, stop, count };
};

const agentOf = (run: () => Promise<AgentResult>): RunnerAgent => ({
  name: 'a-test-agent',
  version: '1',
  kind: 'extract_text',
  models: [],
  tokenCap: 100,
  run,
});

const drive = async (
  steps: readonly Claim[],
  run: () => Promise<AgentResult> = () => Promise.resolve({ refusals: [] }),
  completing?: () => unknown,
) => {
  const fake = scripted(steps, completing);
  const sleeps: number[] = [];
  const runner = await openRunner({
    db: fake.db,
    agents: [agentOf(run)],
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    now: () => 0,
  });
  return { fake, sleeps, ended: runner.run(fake.stop.signal) };
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the runner and a fault of the database connection', () => {
  it('waits, puts back the job in hand, and claims again after a fault in the claim', async () => {
    const { fake, sleeps, ended } = await drive([
      () => {
        throw fault('ECONNREFUSED');
      },
      () => EMPTY,
    ]);
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('claim_job')).toBe(2);
    expect(fake.count('requeue_running_jobs')).toBe(2);
    expect(sleeps[0]).toBe(1000);
  });

  it.each([
    ['ECONNRESET', fault('ECONNRESET')],
    ['a terminated connection', new Error('Connection terminated unexpectedly')],
    ['a class 08 state', Object.assign(new Error('the connection failed'), { code: '08006' })],
    ['a shutdown of the server', Object.assign(new Error('terminating'), { code: '57P01' })],
  ])('does not fail the job when the agent meets %s', async (_name, cause) => {
    const { fake, sleeps, ended } = await drive([job, () => EMPTY], () => Promise.reject(cause));
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('fail_job')).toBe(0);
    expect(fake.count('complete_job')).toBe(0);
    expect(fake.count('requeue_running_jobs')).toBe(2);
    expect(sleeps[0]).toBe(1000);
  });

  it('survives a fault in the end of the job, and does not fail it', async () => {
    const { fake, ended } = await drive([job, () => EMPTY], undefined, () => {
      throw fault('EPIPE');
    });
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('fail_job')).toBe(0);
    expect(fake.count('requeue_running_jobs')).toBe(2);
  });

  it('still stops on any other error', async () => {
    const { ended } = await drive([
      () => {
        throw new Error('a column is absent');
      },
    ]);
    await expect(ended).rejects.toThrow('a column is absent');
  });

  it('still fails the job when the agent stops with an error that is no connection fault', async () => {
    const { fake, ended } = await drive([job, () => EMPTY], () =>
      Promise.reject(new Error('a bug')),
    );
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('fail_job')).toBe(1);
  });
});
