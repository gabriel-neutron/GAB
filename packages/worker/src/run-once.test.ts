import type { RawStore } from '@gab/store/bucket';
import type { Pool, QueryArrayResult } from 'pg';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { runOnce } from './run-once.ts';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222';

type Queryable = Pick<Pool, 'query'>;

// The queries a claimed job triggers run in a fixed order: claim.ts issues one, then the kind's
// own runner issues its own. A response per call, in that order, is enough to fake the driver.
// An error in the list is the fault of the call at that place.
const fakeQueryable = (
  responses: readonly (unknown[] | Error)[],
): Queryable & { readonly calls: unknown[][] } => {
  let call = 0;
  const calls: unknown[][] = [];
  const query = (text: string, values?: unknown[]): Promise<QueryArrayResult> => {
    const rows = responses[call] ?? [];
    call += 1;
    calls.push([text, values]);
    if (rows instanceof Error) return Promise.reject(rows);
    return Promise.resolve({
      rows,
      fields: [],
      command: '',
      rowCount: rows.length,
      oid: 0,
    } as QueryArrayResult);
  };
  return { query: query as Queryable['query'], calls };
};

const fakeStore = (): RawStore =>
  ({
    client: { send: () => Promise.resolve({ Contents: [] }) },
    bucket: 'raw',
  }) as unknown as RawStore;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('an empty queue answers null and opens no store', async () => {
  const on = fakeQueryable([[]]);
  const openRawStore = vi.fn(fakeStore);

  const promise = runOnce('reconcile', on, openRawStore);
  await vi.runAllTimersAsync();
  const found = await promise;

  expect(found).toBeNull();
  expect(openRawStore).not.toHaveBeenCalled();
});

test('a layout job places every entity and reports the count', async () => {
  const claimed = [{ job_id: JOB_ID, job_document: DOCUMENT_ID, job_attempts: 1 }];
  const on = fakeQueryable([
    claimed, // claim_job
    [{ id: DOCUMENT_ID }], // entities
    [], // relations
    [], // set_entity_layout
  ]);

  const promise = runOnce('layout', on, fakeStore);
  await vi.runAllTimersAsync();
  const report = await promise;

  expect(report).toBe('The layout run placed 1 entities.');
});

test('a reconcile job over an agreeing corpus reports agreement', async () => {
  const claimed = [{ job_id: JOB_ID, job_document: DOCUMENT_ID, job_attempts: 1 }];
  const on = fakeQueryable([
    claimed, // claim_job
    [], // documents cited with an s3_key
  ]);

  const promise = runOnce('reconcile', on, fakeStore);
  await vi.runAllTimersAsync();
  const report = await promise;

  expect(report).toBe('The bucket and the index agree.');
});

test('a lost claim waits longer before this worker acts again', async () => {
  const claimed = [{ job_id: JOB_ID, job_document: DOCUMENT_ID, job_attempts: 3 }];
  const on = fakeQueryable([claimed, [{ id: DOCUMENT_ID }], [], []]);

  const promise = runOnce('layout', on, fakeStore);
  await vi.advanceTimersByTimeAsync(3_999);
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  await vi.advanceTimersByTimeAsync(1);
  const report = await promise;

  expect(report).toBe('The layout run placed 1 entities.');
});

const FAIL = 'SELECT public.fail_job($1, $2)';

test('a job that fails on its last attempt is marked failed, and the fault reaches the caller', async () => {
  const claimed = [{ job_id: JOB_ID, job_document: DOCUMENT_ID, job_attempts: 3 }];
  const on = fakeQueryable([claimed, new Error('the entity read failed'), []]);

  await Promise.all([
    expect(runOnce('layout', on, fakeStore)).rejects.toThrow('the entity read failed'),
    vi.runAllTimersAsync(),
  ]);

  expect(on.calls).toContainEqual([FAIL, [JOB_ID, 'the entity read failed']]);
});

test('a job that fails before its last attempt stays running for the lease to return', async () => {
  const claimed = [{ job_id: JOB_ID, job_document: DOCUMENT_ID, job_attempts: 1 }];
  const on = fakeQueryable([claimed, new Error('the entity read failed'), []]);

  await Promise.all([
    expect(runOnce('layout', on, fakeStore)).rejects.toThrow('the entity read failed'),
    vi.runAllTimersAsync(),
  ]);

  expect(on.calls.map(([text]) => text)).not.toContain(FAIL);
});
