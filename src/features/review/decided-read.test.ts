// The read of the decided acts, with a stubbed fetch. It opens no socket.

import { afterEach, expect, it, vi } from 'vitest';

import { readDecidedPage } from './decided-read';
import { DECIDED_SAMPLE } from './decided-sample';

const answers = (body: unknown, status = 200): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it('reads a page of decided acts and the key of the next page', async () => {
  const next = { decidedAt: '2026-10-07T09:12:44Z', id: 'aa000009-0000-4000-8000-000000000002' };
  answers({ acts: DECIDED_SAMPLE, next });
  const read = await readDecidedPage(null);
  expect(read).toMatchObject({ state: 'held', unread: 0, next });
  expect(read.state === 'held' ? read.rows.length : 0).toBe(3);
});

it('shows the acts it can read, and counts one act of an unknown shape', async () => {
  answers({ acts: [...DECIDED_SAMPLE, { id: 'x', status: 'held' }], next: null });
  const read = await readDecidedPage(null);
  expect(read).toMatchObject({ state: 'held', unread: 1 });
  expect(read.state === 'held' ? read.rows.length : 0).toBe(3);
});

it('says that it cannot read a page of an unknown shape, and does not ask to start the writer', async () => {
  answers({ rows: [] });
  const read = await readDecidedPage(null);
  expect(read.state).toBe('private');
  const why = read.state === 'private' ? read.why : '';
  expect(why).toMatch(/^The decided acts cannot be read\./u);
  expect(why).not.toMatch(/Start the write service/u);
});

it('gives the sentence of a refusal, and asks to start the writer when none answers', async () => {
  answers({ refusal: 'the body names no size' }, 422);
  expect(await readDecidedPage(null)).toStrictEqual({
    state: 'private',
    why: 'The decided acts cannot be read: the body names no size',
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('the connection was refused'))),
  );
  const read = await readDecidedPage(null);
  expect(read.state === 'private' ? read.why : '').toMatch(/Start the write service/u);
});
