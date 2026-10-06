// The refusals of the fetch tool. Each one must come before any write, and the address refusals
// must come before any request. The session fails the test when a tool reaches it.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { endMetadata, MAX_BYTES } from './fetch-document.ts';
import {
  FETCH_DAY,
  FIXTURE_HOST,
  fixtureLookup,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { callTool, type Reach, type Session, type Tool } from './tool.ts';

const noSql: Session = {
  query: () => {
    throw new Error('the tool reached the database, and it had to refuse first');
  },
};

const fetchDocument = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

const HTML = '<html><head><title>A page</title></head><body><p>Text</p></body></html>';

let fixture: Fixture;
let base: string;

beforeAll(async () => {
  const big = new Uint8Array(MAX_BYTES + 1).fill(0x41);
  fixture = await startFixture({
    '/page.html': { headers: { 'content-type': 'text/html' }, body: HTML },
    '/declared-big': { headers: { 'content-type': 'text/plain' }, body: big },
    '/streamed-big': { headers: { 'content-type': 'text/plain' }, body: big, chunked: true },
    '/to-metadata': {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    },
    '/to-ftp': { status: 302, headers: { location: 'ftp://example.org/file' } },
    '/loop': { status: 302, headers: { location: '/loop' } },
    '/image': { headers: { 'content-type': 'image/png' }, body: 'not a picture' },
    '/gone': { status: 410, headers: { 'content-type': 'text/plain' }, body: 'gone' },
    '/challenge': {
      headers: { 'content-type': 'text/html' },
      body: '<html><head><title>Just a moment...</title></head><body><h1>Checking your browser before accessing the register of Example Port.</h1><p>Enable JavaScript and cookies to continue.</p></body></html>',
    },
    '/soft-404': {
      headers: { 'content-type': 'text/html' },
      body: '<html><head><title>Example Port</title></head><body><h1>Page not found</h1><p>The register entry does not exist.</p></body></html>',
    },
  });
  base = `http://${FIXTURE_HOST}:${fixture.port}`;
});

afterAll(async () => {
  await fixture.close();
  await endMetadata();
});

// The real range check, with no address of the machine admitted.
const strictReach = (store: NonNullable<Reach['store']>): Reach => ({
  store,
  now: () => FETCH_DAY,
  lookup: fixtureLookup,
});

const refusalOf = async (url: string, reach: Reach | undefined): Promise<string> => {
  const outcome = await callTool(fetchDocument, noSql, { url }, reach);
  if (outcome.ok) throw new Error(`the tool took ${url}, and it had to refuse it`);
  return outcome.refusal;
};

describe('an address of the machine or of a private network is refused before any request', () => {
  test.each([
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://10.0.0.8/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://2130706433/',
    'http://[::ffff:127.0.0.1]/',
  ])('%s', async (url) => {
    const store = memoryStore();
    const before = fixture.requests.length;
    expect(await refusalOf(url, strictReach(store))).toMatch(/refused/);
    expect(fixture.requests.length).toBe(before);
    expect(store.puts).toStrictEqual([]);
  });

  test('a name that resolves to the loopback address is refused, with the real range check', async () => {
    const before = fixture.requests.length;
    const reach: Reach = {
      ...strictReach(memoryStore()),
      lookup: () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
    };
    expect(await refusalOf(`${base}/page.html`, reach)).toMatch(/127\.0\.0\.1.*refused/);
    expect(fixture.requests.length).toBe(before);
  });

  test('a name that resolves to one public and one private address is refused', async () => {
    const before = fixture.requests.length;
    const reach: Reach = {
      ...strictReach(memoryStore()),
      lookup: () =>
        Promise.resolve([
          { address: '93.184.215.14', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ]),
    };
    expect(await refusalOf(`${base}/page.html`, reach)).toMatch(/refused/);
    expect(fixture.requests.length).toBe(before);
  });

  test('a redirect to a private address is refused, and the second request is never made', async () => {
    const store = memoryStore();
    const before = fixture.requests.length;
    expect(await refusalOf(`${base}/to-metadata`, fixtureReach(store))).toMatch(/refused/);
    expect(fixture.requests.slice(before)).toStrictEqual(['/to-metadata']);
    expect(store.puts).toStrictEqual([]);
  });
});

describe('the other refusals store nothing', () => {
  test.each(['ftp://example.org/file', 'file:///etc/passwd', 'data:text/plain,hello'])(
    'a scheme other than http and https: %s',
    async (url) => {
      expect(await refusalOf(url, fixtureReach(memoryStore()))).toMatch(/http/);
    },
  );

  test('a redirect to another scheme', async () => {
    expect(await refusalOf(`${base}/to-ftp`, fixtureReach(memoryStore()))).toMatch(/http/);
  });

  test('a chain of redirects longer than the cap', async () => {
    expect(await refusalOf(`${base}/loop`, fixtureReach(memoryStore()))).toMatch(/redirect/);
  });

  test('a response that declares a length over the cap', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/declared-big`, fixtureReach(store))).toMatch(/cap/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a response with no length that runs over the cap', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/streamed-big`, fixtureReach(store))).toMatch(/cap/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a status that is not a success', async () => {
    expect(await refusalOf(`${base}/gone`, fixtureReach(memoryStore()))).toMatch(/410/);
  });

  test.each(['/challenge', '/soft-404'])(
    'a page with a success status that is a bot challenge or a missing page: %s',
    async (path) => {
      const store = memoryStore();
      expect(await refusalOf(`${base}${path}`, fixtureReach(store))).toMatch(/not the page/);
      expect(store.puts).toStrictEqual([]);
    },
  );

  test('a type from which no text is read', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/image`, fixtureReach(store))).toMatch(/image\/png/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a surface that gives no object store', async () => {
    const before = fixture.requests.length;
    expect(await refusalOf(`${base}/page.html`, undefined)).toMatch(/object store/);
    expect(fixture.requests.length).toBe(before);
  });

  test('a page range above the cap, before any request', async () => {
    const before = fixture.requests.length;
    const outcome = await callTool(
      fetchDocument,
      noSql,
      { url: `${base}/page.html`, fromPage: 1, toPage: 11 },
      fixtureReach(memoryStore()),
    );
    expect(outcome.ok).toBe(false);
    expect(fixture.requests.length).toBe(before);
  });
});

test('a second caller that stored the same bytes at the same instant makes the answer known', async () => {
  let lookups = 0;
  const stored = {
    id: 'doc_0123456789ab',
    title: 'A page',
    mime: 'text/html',
    retrieved_at: '2026-10-04',
  };
  const raced: Session = {
    query: (text) => {
      if (text.includes('put_fetched_document'))
        return Promise.reject(Object.assign(new Error('duplicate key'), { code: '23505' }));
      if (text.includes('WHERE d.sha256')) {
        lookups += 1;
        return Promise.resolve({ rows: lookups === 1 ? [] : [stored] });
      }
      return Promise.resolve({
        rows: [{ extractor: 'text-1', page: 1, text: 'Text', last_page: 1 }],
      });
    },
  };
  const outcome = await callTool(
    fetchDocument,
    raced,
    { url: `${base}/page.html` },
    fixtureReach(memoryStore()),
  );
  expect(outcome).toMatchObject({
    ok: true,
    output: { document: stored.id, status: 'known', retrievedAt: '2026-10-04' },
  });
});
