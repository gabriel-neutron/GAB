import { afterEach, expect, test, vi } from 'vitest';

import { siteAddress } from './site-address';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('a site at the root keeps the path', () => {
  vi.stubEnv('BASE_URL', '/');
  expect(siteAddress('/nodes/')).toBe('/nodes/');
});

test('a site in a base folder puts the path under it', () => {
  vi.stubEnv('BASE_URL', '/gab/');
  expect(siteAddress('/release/manifest.json')).toBe('/gab/release/manifest.json');
});
