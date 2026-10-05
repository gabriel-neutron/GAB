import { expect, test } from 'vitest';

import { JobStop, type RunnerAgent } from './agents.ts';
import { openRunner } from './runner.ts';
import { completionOf, depsOf, gatewayOf, stubAgent } from './runner-fixture.ts';

const JOB = '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b';

// A database that holds one claimed job at the given attempt, and records each statement with
// its values.
const fakeDb = (attempt: number) => {
  const statements: { text: string; values: unknown[] }[] = [];
  return {
    statements,
    query: (text: string, values: unknown[] = []) => {
      statements.push({ text, values });
      if (text.includes('runner_settings'))
        return Promise.resolve({
          rows: [{ lease_seconds: 900, quota_wait_seconds: 600, empty_wait_seconds: 30 }],
        });
      if (text.includes('claim_job'))
        return Promise.resolve({
          rows: [
            {
              job_id: JOB,
              job_document: 'doc_job_stop',
              job_attempts: attempt,
              job_kind: 'extract_text',
            },
          ],
        });
      return Promise.resolve({ rows: [] });
    },
  };
};

const stopping = (reason: string): RunnerAgent => ({
  ...stubAgent(),
  run: () => Promise.reject(new JobStop(reason)),
});

const gateway = gatewayOf(() => completionOf('{"claim":"a claim"}'));

for (const reason of ['turn_cap', 'usage_cap', 'no_minimiser', 'no_text', 'minimiser_length'])
  test(`a stop with ${reason} on the third claim fails the job with that reason`, async () => {
    const db = fakeDb(3);
    const { deps } = depsOf(db, [stopping(reason)], gateway);
    const runner = await openRunner(deps);

    expect(await runner.step()).toStrictEqual({ did: 'failed', job: JOB });
    expect(db.statements.filter((one) => one.text.includes('fail_job'))).toStrictEqual([
      { text: expect.stringContaining('fail_job') as unknown, values: [JOB, reason] },
    ]);
  });

test('a stop on the first claim leaves the row for the end of its lease', async () => {
  const db = fakeDb(1);
  const { deps } = depsOf(db, [stopping('turn_cap')], gateway);
  const runner = await openRunner(deps);

  expect(await runner.step()).toStrictEqual({ did: 'left', job: JOB });
  expect(db.statements.some((one) => one.text.includes('fail_job'))).toBe(false);
});

test('the refusals that an agent returns do not stop the job', async () => {
  const db = fakeDb(1);
  const agent: RunnerAgent = {
    ...stubAgent(),
    run: () => Promise.resolve({ refusals: [{ tool: 'propose_change', reason: 'refused' }] }),
  };
  const { deps } = depsOf(db, [agent], gateway);
  const runner = await openRunner(deps);

  expect(await runner.step()).toStrictEqual({ did: 'done', job: JOB });
});
