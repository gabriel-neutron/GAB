import { isNotFound } from '@tanstack/react-router';
import { afterEach, expect, test, vi } from 'vitest';

import { requireWriter } from './require-writer';
import { recheckWriter } from './writer-status';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a surface of the writer opens when the writer is online', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"online":true}')));
  await recheckWriter();
  await expect(requireWriter()).resolves.toBeUndefined();
});

test('a surface of the writer answers not-found, and no raw error, when the writer is offline', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
  await recheckWriter();
  const failure: unknown = await requireWriter().then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(isNotFound(failure)).toBe(true);
});
