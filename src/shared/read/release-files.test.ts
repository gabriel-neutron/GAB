import { afterEach, expect, test, vi } from 'vitest';

import { fetchRelease, ReleaseAbsent } from './release-files';

const FOLDER = new URL('http://site.test/release/');

const stubFetch = (answer: (path: string) => Response): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: URL) => Promise.resolve(answer(input.pathname))),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a folder with no manifest is an absent release', async () => {
  stubFetch(() => new Response('no', { status: 404 }));
  await expect(fetchRelease(FOLDER)).rejects.toBeInstanceOf(ReleaseAbsent);
});

test('a page served in place of the manifest is an absent release', async () => {
  stubFetch(() => new Response('<html></html>'));
  await expect(fetchRelease(FOLDER)).rejects.toBeInstanceOf(ReleaseAbsent);
});

test('a listed file that is missing is a fault, and not an absent release', async () => {
  stubFetch((path) =>
    path.endsWith('manifest.json')
      ? new Response(JSON.stringify({ files: [{ path: 'entities.csv' }] }))
      : new Response('no', { status: 500 }),
  );
  const fault = await fetchRelease(FOLDER).then(
    () => null,
    (cause: unknown) => cause,
  );
  expect(fault).toBeInstanceOf(Error);
  expect(fault).not.toBeInstanceOf(ReleaseAbsent);
});
