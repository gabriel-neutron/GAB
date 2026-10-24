import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { DEFAULT_MAP_WORKSPACE, patchMapWorkspace, readMapWorkspace } from './map-workspace';

const held = new Map<string, string>();

beforeEach(() => {
  held.clear();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => held.set(key, value),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a patch keeps the other key, and a read gives it back', () => {
  patchMapWorkspace({ railOpen: false });
  patchMapWorkspace({ railWidth: 300 });
  expect(readMapWorkspace()).toStrictEqual({ railOpen: false, railWidth: 300 });
});

test('a stored record with an unknown key or a wrong value falls back', () => {
  held.set('gab.map.v1', JSON.stringify({ railOpen: 'yes', railWidth: 300 }));
  expect(readMapWorkspace()).toStrictEqual(DEFAULT_MAP_WORKSPACE);
  held.set('gab.map.v1', JSON.stringify({ railOpen: true, railWidth: 1, x: 1 }));
  expect(readMapWorkspace()).toStrictEqual(DEFAULT_MAP_WORKSPACE);
});
