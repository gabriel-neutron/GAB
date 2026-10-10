// The refusals of the fetch tool. Each one must come before any write, and the address refusals
// must come before any request. The session fails the test when a tool reaches it.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

import { endOcr } from '@gab/text';
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

// An image is first looked up by its hash, and only that read is answered: no row holds it.
const unknownBytes: Session = {
  query: (text) => {
    if (text.includes('WHERE d.sha256')) return Promise.resolve({ rows: [] });
    throw new Error('the tool reached the database past the hash lookup, and it had to refuse');
  },
};

const fetchDocument = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

// The signature and the header chunk of a PNG image of 10,000 by 10,000 pixels, with no picture.
const HUGE_PNG = Buffer.alloc(33);
HUGE_PNG.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
HUGE_PNG.writeUInt32BE(10_000, 16);
HUGE_PNG.writeUInt32BE(10_000, 20);

const HTML = '<html><head><title>A page</title></head><body><p>Text</p></body></html>';

const CHALLENGE_PAGE_HTML =
  '<html><head><title>Just a moment...</title></head><body><div id="challenge-running">' +
  'Checking if the site connection is secure</div><script src="/cdn-cgi/challenge-platform/' +
  'h/b/orchestrate/chl_page/v1"></script></body></html>';

// The Radware Bot Manager challenge, as a page of a German ministry gave it with a 200.
const RADWARE_PAGE_HTML =
  '<html><head><title>Radware Page</title><script src="https://cdn.perfdrive.com/aperture/' +
  'aperture.js"></script></head><body><div class="loader"></div><p>Verifying your browser ' +
  'before proceeding...</p></body></html>';

// Bytes that are no text and no format that the tool decodes: a sequence of a fixed generator.
const NOISE = ((): Uint8Array => {
  const bytes = new Uint8Array(4096);
  let state = 12_345;
  for (let at = 0; at < bytes.length; at += 1) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    bytes[at] = state >> 16;
  }
  return bytes;
})();

let fixture: Fixture;
let base: string;

beforeAll(async () => {
  const blank = await readFile(join(import.meta.dirname, '../../text/fixtures/blank.png'));
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
    '/image': { headers: { 'content-type': 'image/gif' }, body: 'GIF89a' },
    '/broken.png': { headers: { 'content-type': 'image/png' }, body: 'not a picture' },
    '/huge.png': { headers: { 'content-type': 'image/png' }, body: HUGE_PNG },
    // A white image with no word, served with no type, so the type comes from its first bytes.
    '/blank': { body: blank },
    '/blank-bytes': { headers: { 'content-type': 'application/octet-stream' }, body: blank },
    '/octet': { headers: { 'content-type': 'application/octet-stream' }, body: 'no signature' },
    '/gone': { status: 410, headers: { 'content-type': 'text/plain' }, body: 'gone' },
    '/challenge': {
      headers: { 'content-type': 'text/html' },
      body: '<html><head><title>Just a moment...</title></head><body><h1>Checking your browser before accessing the register of Example Port.</h1><p>Enable JavaScript and cookies to continue.</p></body></html>',
    },
    // A Cloudflare challenge: a 403 with the page that asks the browser to run its script.
    '/cloudflare': {
      status: 403,
      headers: { 'content-type': 'text/html', 'cf-mitigated': 'challenge' },
      body: CHALLENGE_PAGE_HTML,
    },
    // AWS WAF: a 202 with an empty page.
    '/waf': { status: 202, headers: { 'content-type': 'text/html' } },
    '/empty.html': { headers: { 'content-type': 'text/html' } },
    '/blank.txt': { headers: { 'content-type': 'text/plain' }, body: '  \n\t ' },
    '/missing': { status: 404, headers: { 'content-type': 'text/html' }, body: 'absent' },
    '/silent': { silent: true },
    '/drop': { drop: true },
    '/radware': { headers: { 'content-type': 'text/html' }, body: RADWARE_PAGE_HTML },
    // Raw captures of the Wayback Machine ("id_"): the original bytes, with or without the
    // header that names their encoding.
    '/gzip-named': {
      headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' },
      body: gzipSync(RADWARE_PAGE_HTML),
    },
    '/gzip-unnamed': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: gzipSync(RADWARE_PAGE_HTML),
    },
    '/br-named': {
      headers: { 'content-type': 'text/html', 'content-encoding': 'br' },
      body: brotliCompressSync(RADWARE_PAGE_HTML),
    },
    '/br-unnamed': {
      headers: { 'content-type': 'text/html' },
      body: brotliCompressSync(RADWARE_PAGE_HTML),
    },
    '/noise': { headers: { 'content-type': 'text/html' }, body: NOISE },
    '/false-gzip': {
      headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' },
      body: HTML,
    },
    '/compress': {
      headers: { 'content-type': 'text/html', 'content-encoding': 'compress' },
      body: HTML,
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
  await Promise.all([endMetadata(), endOcr()]);
});

// The real range check, with no address of the machine admitted.
const strictReach = (store: NonNullable<Reach['store']>): Reach => ({
  store,
  now: () => FETCH_DAY,
  lookup: fixtureLookup,
});

const refusalOf = async (
  url: string,
  reach: Reach | undefined,
  session: Session = noSql,
): Promise<string> => {
  const outcome = await callTool(fetchDocument, session, { url }, reach);
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

  test('a challenge page with a success status names the browser step', async () => {
    expect(await refusalOf(`${base}/challenge`, fixtureReach(memoryStore()))).toMatch(
      /store_saved_file/,
    );
  });

  test('a missing page names no browser step', async () => {
    expect(await refusalOf(`${base}/soft-404`, fixtureReach(memoryStore()))).not.toMatch(
      /store_saved_file/,
    );
    expect(await refusalOf(`${base}/missing`, fixtureReach(memoryStore()))).not.toMatch(
      /store_saved_file/,
    );
  });
});

describe('a bot filter or a silent server gives a refusal that names the next step', () => {
  test('a 403 with a Cloudflare challenge: open the page in a browser, store_saved_file', async () => {
    const store = memoryStore();
    const refusal = await refusalOf(`${base}/cloudflare`, fixtureReach(store));
    expect(refusal).toMatch(/answered 403/);
    expect(refusal).toMatch(/bot filter/);
    expect(refusal).toMatch(/open the page in a browser .*store_saved_file/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a 200 with a Radware challenge: open the page in a browser, store_saved_file', async () => {
    const store = memoryStore();
    const refusal = await refusalOf(`${base}/radware`, fixtureReach(store));
    expect(refusal).toMatch(/challenge of a bot filter/);
    expect(refusal).toMatch(/open the page in a browser .*store_saved_file/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a 202 with an empty page (AWS WAF): open the page in a browser, store_saved_file', async () => {
    const store = memoryStore();
    const refusal = await refusalOf(`${base}/waf`, fixtureReach(store));
    expect(refusal).toMatch(/answered 202 with a page that holds no text/);
    expect(refusal).toMatch(/AWS WAF/);
    expect(refusal).toMatch(/open the page in a browser .*store_saved_file/);
    expect(store.puts).toStrictEqual([]);
  });

  test.each(['/empty.html', '/blank.txt'])(
    'a 200 with no text is refused, and nothing is stored: %s',
    async (path) => {
      const store = memoryStore();
      const refusal = await refusalOf(`${base}${path}`, fixtureReach(store));
      expect(refusal).toMatch(/holds no text/);
      expect(refusal).toMatch(/store_saved_file/);
      expect(store.puts).toStrictEqual([]);
    },
  );

  test('no answer within the time: the browser step, then the list of needs', async () => {
    const store = memoryStore();
    const reach: Reach = { ...fixtureReach(store), fetchTimeoutMs: 300 };
    const refusal = await refusalOf(`${base}/silent`, reach);
    expect(refusal).toMatch(/no whole answer within 0\.3 seconds/);
    expect(refusal).toMatch(/store_saved_file/);
    expect(refusal).toMatch(/research\/out\/needs\.md/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a connection closed with no answer: the browser step, then the list of needs', async () => {
    const store = memoryStore();
    const refusal = await refusalOf(`${base}/drop`, fixtureReach(store));
    expect(refusal).toMatch(/could not be reached/);
    expect(refusal).toMatch(/research\/out\/needs\.md/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a type from which no text is read', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/image`, fixtureReach(store))).toMatch(/image\/gif/);
    expect(store.puts).toStrictEqual([]);
  });

  test('an image whose OCR reads no text', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/blank`, fixtureReach(store), unknownBytes)).toMatch(/no text/);
    expect(store.puts).toStrictEqual([]);
  });

  test('bytes named as an image that no image reader reads', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/broken.png`, fixtureReach(store), unknownBytes)).toMatch(
      /width and height/,
    );
    expect(store.puts).toStrictEqual([]);
  });

  test('an image above the pixel cap, before any OCR', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/huge.png`, fixtureReach(store), unknownBytes)).toMatch(
      /pixels/,
    );
    expect(store.puts).toStrictEqual([]);
  });

  test('an image named only as bytes is read as an image from its first bytes', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/blank-bytes`, fixtureReach(store), unknownBytes)).toMatch(
      /OCR read no text/,
    );
    expect(store.puts).toStrictEqual([]);
  });

  test('bytes with no known signature keep the type the server named', async () => {
    const store = memoryStore();
    expect(await refusalOf(`${base}/octet`, fixtureReach(store))).toMatch(
      /application\/octet-stream/,
    );
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
      if (text.includes('FROM api.document'))
        return Promise.resolve({ rows: [{ title: stored.title, uri: `${base}/page.html` }] });
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

test('an image whose bytes are already stored is known, and OCR never reads it', async () => {
  const stored = {
    id: 'doc_ba5eba11c0de',
    title: 'A unit tree',
    mime: 'image/png',
    retrieved_at: '2026-10-01',
  };
  const knownImage: Session = {
    query: (text) => {
      if (text.includes('put_fetched_document'))
        return Promise.reject(new Error('the tool wrote a document that was already stored'));
      if (text.includes('WHERE d.sha256')) return Promise.resolve({ rows: [stored] });
      if (text.includes('FROM api.document'))
        return Promise.resolve({ rows: [{ title: stored.title, uri: `${base}/broken.png` }] });
      return Promise.resolve({
        rows: [{ extractor: 'text-1', page: 1, text: 'BRIGADE', last_page: 1 }],
      });
    },
  };
  const store = memoryStore();
  // The bytes are no image, so an OCR read of them would refuse the call.
  const outcome = await callTool(
    fetchDocument,
    knownImage,
    { url: `${base}/broken.png` },
    fixtureReach(store),
  );
  expect(outcome).toMatchObject({ ok: true, output: { document: stored.id, status: 'known' } });
  expect(store.puts).toStrictEqual([]);
});

describe('a compressed answer is decoded before its text is read', () => {
  // Each body is the Radware challenge, so the refusal shows that its text was read.
  test.each(['/gzip-named', '/gzip-unnamed', '/br-named', '/br-unnamed'])(
    'the text of %s is read after the decode',
    async (path) => {
      const store = memoryStore();
      const refusal = await refusalOf(`${base}${path}`, fixtureReach(store));
      expect(refusal).toMatch(/challenge of a bot filter/);
      expect(store.puts).toStrictEqual([]);
    },
  );

  test('a body of a text type with no readable text is refused, and nothing is stored', async () => {
    const store = memoryStore();
    const refusal = await refusalOf(`${base}/noise`, fixtureReach(store));
    expect(refusal).toMatch(/holds no readable text/);
    expect(refusal).toMatch(/store_saved_file/);
    expect(store.puts).toStrictEqual([]);
  });

  test('a body that does not decode as the encoding that the server names is refused', async () => {
    expect(await refusalOf(`${base}/false-gzip`, fixtureReach(memoryStore()))).toMatch(
      /does not decode as gzip/,
    );
  });

  test('an encoding that the tool does not know is refused', async () => {
    expect(await refusalOf(`${base}/compress`, fixtureReach(memoryStore()))).toMatch(/"compress"/);
  });
});
