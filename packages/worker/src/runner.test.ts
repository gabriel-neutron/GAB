import { worstQuestionMs } from '@gab/model';
import { describe, expect, it } from 'vitest';

import { checkLease, openRunner, worstJobSeconds } from './runner.ts';
import { completionOf, depsOf, forecastOf, gatewayOf, stubAgent } from './runner-fixture.ts';

// A database that answers the settings read and the claim, and records every statement. It holds
// no job, so the empty queue and the stops before a claim are measured without a server.
const fakeDb = (lease: number, queued: readonly object[] = []) => {
  const statements: string[] = [];
  return {
    statements,
    query: (text: string) => {
      statements.push(text);
      if (text.includes('runner_settings'))
        return Promise.resolve({
          rows: [{ lease_seconds: lease, quota_wait_seconds: 600, empty_wait_seconds: 30 }],
        });
      if (text.includes('claim_job')) return Promise.resolve({ rows: [...queued] });
      return Promise.resolve({ rows: [] });
    },
  };
};

const claimed = (statements: readonly string[]): boolean =>
  statements.some((text) => text.includes('claim_job'));

describe('the lease against the worst job', () => {
  const agent = stubAgent({ chunks: ['one', 'two', 'three'] });
  const worst = worstJobSeconds(agent);

  it('is the questions of the job times the worst question, waits included', () => {
    expect(worst).toBe(Math.ceil((3 * worstQuestionMs(agent.settings)) / 1000));
  });

  it('accepts a lease as long as the worst job', () => {
    expect(() => checkLease(worst, [agent])).not.toThrow();
  });

  it('refuses a lease one second shorter, and it names the agent and the need', () => {
    expect(() => checkLease(worst - 1, [agent])).toThrow(
      new RegExp(`stub needs ${String(worst)} seconds`, 'u'),
    );
  });
});

describe('the start of the runner', () => {
  const gateway = gatewayOf(() => completionOf('{"claim":"a claim"}'));

  it('refuses a short lease and claims nothing', async () => {
    const db = fakeDb(worstJobSeconds(stubAgent()) - 1);
    const { deps } = depsOf(db, [stubAgent()], gateway);

    await expect(openRunner(deps)).rejects.toThrow(/shorter than the worst job/u);
    expect(claimed(db.statements)).toBe(false);
  });

  it('refuses to start with no agent', async () => {
    const { deps } = depsOf(fakeDb(900), [], gateway);
    await expect(openRunner(deps)).rejects.toThrow(/no agent/u);
  });
});

describe('the steps of the runner', () => {
  it('waits and claims nothing when the gateway has no quota left', async () => {
    const db = fakeDb(900);
    const spent = gatewayOf(
      () => completionOf('{"claim":"a claim"}'),
      () => forecastOf(0),
    );
    const { deps, slept } = depsOf(db, [stubAgent()], spent);
    const runner = await openRunner(deps);

    expect(await runner.step()).toStrictEqual({ did: 'paused' });
    expect(claimed(db.statements)).toBe(false);
    expect(slept).toStrictEqual([600_000]);
  });

  it('waits and claims nothing when the read of the quota fails', async () => {
    const db = fakeDb(900);
    const broken = gatewayOf(
      () => completionOf('{"claim":"a claim"}'),
      () => new Response('{}', { status: 503 }),
    );
    const { deps } = depsOf(db, [stubAgent()], broken);
    const runner = await openRunner(deps);

    expect(await runner.step()).toStrictEqual({ did: 'paused' });
    expect(claimed(db.statements)).toBe(false);
  });

  it('waits the wait of the empty queue when the claim gives no row', async () => {
    const db = fakeDb(900);
    const open = gatewayOf(() => completionOf('{"claim":"a claim"}'));
    const { deps, slept } = depsOf(db, [stubAgent()], open);
    const runner = await openRunner(deps);

    expect(await runner.step()).toStrictEqual({ did: 'idle' });
    expect(slept).toStrictEqual([30_000]);
    expect(open.reads()).toBe(1);
  });
});
