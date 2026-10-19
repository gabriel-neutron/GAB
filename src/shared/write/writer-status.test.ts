import { afterEach, expect, test, vi } from 'vitest';

import { probeWriter, recheckWriter, writerStatus } from './writer-status';

const answer = (body: string, ok = true): Response =>
  new Response(body, { status: ok ? 200 : 404 });

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the writer that says it is online turns the status online', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer('{"online":true}')));
  expect(await recheckWriter()).toBe(true);
  expect(writerStatus()).toBe('online');
});

test('a connection that fails turns the status offline', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
  expect(await recheckWriter()).toBe(false);
  expect(writerStatus()).toBe('offline');
});

test('a page of the site in place of the answer turns the status offline', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer('<!doctype html><html></html>')));
  expect(await recheckWriter()).toBe(false);
  expect(writerStatus()).toBe('offline');
});

test('an answer that is not ok turns the status offline', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer('{"online":true}', false)));
  expect(await recheckWriter()).toBe(false);
});

test('the first probe is read once, and a recheck reads again', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(answer('{"online":true}')));
  vi.stubGlobal('fetch', fetcher);
  await recheckWriter();
  fetcher.mockClear();
  await probeWriter();
  await probeWriter();
  expect(fetcher).not.toHaveBeenCalled();
  await recheckWriter();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
