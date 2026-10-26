// The runner survives a fault of the database connection: it waits, puts back the job in hand and
// goes on. Any other fault still stops it. No server runs here: a fake connection answers by the
// text of the statement.

import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentContext, AgentResult, RunnerAgent } from './agents.ts';
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
 * runner. Another statement answers by its text, and `completing` and `asking` may throw. The
 * statement of the agent holds the word `agent_query`. */
const scripted = (
  steps: readonly Claim[],
  completing: () => unknown = () => ({ status: 'done' }),
  asking: () => { rows: unknown[] } = () => EMPTY,
  held = false,
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
      if (text.includes('agent_query')) return Promise.resolve(asking());
      return Promise.resolve(EMPTY);
    },
  };
  // The dedicated connection of the lock. It answers the try of the lock by the flag `held`.
  const released: number[] = [];
  const lock = () =>
    Promise.resolve({
      query: (text: string) => {
        seen.push(text);
        return Promise.resolve({ rows: [{ locked: !held }] });
      },
      release: () => {
        released.push(seen.length);
        return Promise.resolve();
      },
    });
  const count = (word: string): number => seen.filter((text) => text.includes(word)).length;
  const takeAway = (): void => {
    held = true;
  };
  return { db, lock, stop, count, seen, released, takeAway };
};

const agentOf = (run: (context: AgentContext) => Promise<AgentResult>): RunnerAgent => ({
  name: 'a-test-agent',
  version: '1',
  kind: 'extract_text',
  models: [],
  tokenCap: 100,
  run,
});

const drive = async (
  steps: readonly Claim[],
  run: (context: AgentContext) => Promise<AgentResult> = () => Promise.resolve({ refusals: [] }),
  completing?: () => unknown,
  asking?: () => { rows: unknown[] },
  held?: boolean,
) => {
  const fake = scripted(steps, completing, asking, held);
  const sleeps: number[] = [];
  const runner = await openRunner({
    db: fake.db,
    lock: fake.lock,
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

  const askAndStop: (context: AgentContext) => Promise<AgentResult> = async (context) => {
    await context.db.query('agent_query');
    return { refusals: [] };
  };

  it.each([
    ['ECONNRESET', fault('ECONNRESET')],
    ['a terminated connection', new Error('Connection terminated unexpectedly')],
    ['a class 08 state', Object.assign(new Error('the connection failed'), { code: '08006' })],
    ['a shutdown of the server', Object.assign(new Error('terminating'), { code: '57P01' })],
  ])('does not fail the job when a query of the agent meets %s', async (_name, cause) => {
    const { fake, sleeps, ended } = await drive([job, () => EMPTY], askAndStop, undefined, () => {
      throw cause;
    });
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('fail_job')).toBe(0);
    expect(fake.count('complete_job')).toBe(0);
    expect(fake.count('requeue_running_jobs')).toBe(2);
    expect(sleeps[0]).toBe(1000);
  });

  it('fails the job when another service of the agent refuses the connection', async () => {
    const { fake, ended } = await drive([job, () => EMPTY], () =>
      Promise.reject(fault('ECONNREFUSED')),
    );
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('fail_job')).toBe(1);
    expect(fake.count('requeue_running_jobs')).toBe(1);
  });

  it('fails the job on a protocol violation of the database, which no wait cures', async () => {
    const { fake, ended } = await drive([job, () => EMPTY], askAndStop, undefined, () => {
      throw Object.assign(new Error('a bad message'), { code: '08P01' });
    });
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('fail_job')).toBe(1);
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

describe('the runner and its concurrency', () => {
  const open = (concurrency: number, steps: readonly Claim[], run: RunnerAgent['run']) => {
    const fake = scripted(steps);
    return openRunner({
      db: fake.db,
      lock: fake.lock,
      agents: [agentOf(run)],
      sleep: () => Promise.resolve(),
      now: () => 0,
      concurrency,
    }).then((runner) => ({ fake, ended: runner.run(fake.stop.signal) }));
  };

  it('works on N jobs at the same time, and not on more', async () => {
    let live = 0;
    let most = 0;
    const gate = Promise.withResolvers<undefined>();
    const { ended } = await open(
      3,
      [job, job, job, job, () => EMPTY, () => EMPTY, () => EMPTY],
      async () => {
        live += 1;
        most = Math.max(most, live);
        if (live === 3) gate.resolve(undefined);
        await gate.promise;
        await new Promise((resolve) => setImmediate(resolve));
        live -= 1;
        return { refusals: [] };
      },
    );
    await expect(ended).resolves.toBeUndefined();
    expect(most).toBe(3);
  });

  it('does not stop the other jobs when one job fails', async () => {
    let calls = 0;
    const { fake, ended } = await open(
      3,
      [job, job, job, () => EMPTY, () => EMPTY, () => EMPTY],
      () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new Error('a bug')) : Promise.resolve({ refusals: [] });
      },
    );
    await expect(ended).resolves.toBeUndefined();
    expect(fake.count('fail_job')).toBe(1);
    expect(fake.count('complete_job')).toBe(2);
  });

  it('refuses a concurrency that is not a whole number above zero', async () => {
    await expect(open(0, [], () => Promise.resolve({ refusals: [] }))).rejects.toThrow(
      'concurrency',
    );
  });
});

describe('the runner and the lock that keeps one runner alive', () => {
  it('starts as usual when the lock is free', async () => {
    const { fake, ended } = await drive([() => EMPTY]);
    await expect(ended).resolves.toBeUndefined();
    // One try at the start, and one before the step.
    expect(fake.count('pg_try_advisory_lock')).toBe(2);
    expect(fake.seen.findIndex((text) => text.includes('pg_try_advisory_lock'))).toBeLessThan(
      fake.seen.findIndex((text) => text.includes('requeue_running_jobs')),
    );
    expect(fake.count('claim_job')).toBe(1);
  });

  it('refuses to start when another runner holds the lock, and sends no requeue', async () => {
    const fake = scripted([() => EMPTY], undefined, undefined, true);
    await expect(
      openRunner({
        db: fake.db,
        lock: fake.lock,
        agents: [agentOf(() => Promise.resolve({ refusals: [] }))],
        sleep: () => Promise.resolve(),
        now: () => 0,
      }),
    ).rejects.toThrow('Another runner is running');
    expect(fake.count('requeue_running_jobs')).toBe(0);
    expect(fake.count('claim_job')).toBe(0);
    expect(fake.released).toHaveLength(1);
  });

  it('takes the lock again before the requeue after a lost connection', async () => {
    const { fake, ended } = await drive([
      () => {
        throw fault('ECONNRESET');
      },
      () => EMPTY,
    ]);
    await expect(ended).resolves.toBeUndefined();
    // One try at the start, one before the first step, and one after the lost connection.
    expect(fake.count('pg_try_advisory_lock')).toBe(3);
    const at = (word: string): number[] =>
      fake.seen.flatMap((text, index) => (text.includes(word) ? [index] : []));
    const secondLock = at('pg_try_advisory_lock').at(-1);
    const [, secondRequeue] = at('requeue_running_jobs');
    expect(secondLock).toBeLessThan(secondRequeue ?? -1);
    expect(fake.released).toHaveLength(1);
  });

  it('stops when the lock was lost with no sign and another runner holds it', async () => {
    const holder: { take?: () => void } = {};
    const fake = scripted([
      () => {
        holder.take?.();
        return EMPTY;
      },
      () => EMPTY,
    ]);
    holder.take = fake.takeAway;
    const runner = await openRunner({
      db: fake.db,
      lock: fake.lock,
      agents: [agentOf(() => Promise.resolve({ refusals: [] }))],
      sleep: () => Promise.resolve(),
      now: () => 0,
    });
    await expect(runner.run(fake.stop.signal)).rejects.toThrow('Another runner took the lock');
    expect(fake.count('claim_job')).toBe(1);
  });
});
