// The memory of the layout, with a stubbed fetch. A layout that places every entity of the corpus
// is read once. A layout that lacks an entity is read again, because the layout job runs outside
// the browser.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Entity } from './model';

const A = '94172363-dab1-4fc3-ae2a-16e3430879be';
const B = '0ea482d0-cd00-4c77-911e-419dd2d1779f';

const entityOf = (id: string): Entity => ({ id }) as Entity;

let rows: readonly unknown[] = [];

const stub = vi.fn((): Promise<Response> =>
  Promise.resolve(
    new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ),
);

beforeEach(() => {
  rows = [];
  stub.mockClear();
  vi.stubGlobal('fetch', stub);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a layout that places every entity is read once, and the same map comes back', async () => {
  rows = [
    { entity_id: A, x: 1, y: 2 },
    { entity_id: B, x: 3, y: 4 },
  ];
  const { loadLayout } = await import('./layout');
  const entities = [entityOf(A), entityOf(B)];

  const first = await loadLayout(entities);
  const second = await loadLayout(entities);

  expect(stub).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);
});

test('a layout that lacks an entity is read again, and gives the position that a later run set', async () => {
  rows = [{ entity_id: A, x: 1, y: 2 }];
  const { loadLayout } = await import('./layout');
  const entities = [entityOf(A), entityOf(B)];

  const before = await loadLayout(entities);
  expect(before.has(B)).toBe(false);

  rows = [
    { entity_id: A, x: 1, y: 2 },
    { entity_id: B, x: 3, y: 4 },
  ];
  const after = await loadLayout(entities);

  expect(stub).toHaveBeenCalledTimes(3);
  expect(after.get(B)).toStrictEqual({ x: 3, y: 4 });
});
