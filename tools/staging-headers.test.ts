import { expect, test } from 'vitest';

import { headersOf } from './staging-headers.ts';

test('a staging build tells a search engine not to index any path, and a release build does not', () => {
  for (const env of [{}, { WORKERS_CI_BRANCH: 'staging' }, { SITE_RELEASE: '' }])
    expect(headersOf(env)).toBe('/*\n  X-Robots-Tag: noindex\n');
  expect(headersOf({ WORKERS_CI_BRANCH: 'main' })).toBeNull();
  expect(headersOf({ SITE_RELEASE: '1' })).toBeNull();
});
