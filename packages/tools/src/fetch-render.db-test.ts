// The render of fetch_document against the disposable database as gabriel_research, a local HTTP
// server and a real Chromium. The object store is in memory. Each call runs inside a transaction
// that rolls back.

import { createHash } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import {
  FIXTURE_HOST,
  fixtureLookup,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { refusedAddress } from './fetch-guard.ts';
import { callTool, type Reach, type Session, type Tool } from './tool.ts';

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// The shell of a search result page: the table is empty until the script fills it.
const TABLE =
  '<html><head><title>Port state control search</title></head><body><table id="result"></table>' +
  '<script>const rows = [' +
  `['IMO 9187629', 'Detained at Port Louis', 'Run ${RUN}'],` +
  "['IMO 9321172', 'Released after inspection', 'The ship left the port the next day'] ];" +
  "const table = document.getElementById('result');" +
  'for (const row of rows) { const tr = table.insertRow();' +
  ' for (const cell of row) tr.insertCell().textContent = cell; }' +
  "document.body.insertAdjacentHTML('beforeend', '<p>' + 'The inspection record of the " +
  "authority names each ship, the port, the day and the result of the inspection. '.repeat(3) " +
  "+ '</p>');</script></body></html>";

// A page whose text is all in its bytes. A script adds no text to it. The browser writes the
// doctype in upper case, so the rendered bytes differ from the bytes of the server.
const STATIC =
  '<!doctype html><html><head><title>A static page</title></head><body><article><h1>A static page</h1>' +
  `<p>Run ${RUN}. The text of this page is in its bytes, and a script adds nothing.</p>` +
  '</article></body></html>';

const SECRET = `SECRET-${RUN}`;

const PRIVATE =
  '<html><head><title>A page that asks inside</title></head><body><div id="out"></div><script>' +
  "const out = document.getElementById('out');" +
  "out.textContent = 'The page asks two private addresses and shows what comes back. " +
  "The inspection record names each ship, the port, the day and the result. '.repeat(3);" +
  'const ask = (url) => fetch(url).then((r) => r.text())' +
  ".then((t) => { out.insertAdjacentText('beforeend', ' ' + t); }, () => undefined);" +
  'ask(`http://inside.test:${location.port}/secret`);' +
  "ask('http://10.0.0.1/secret');" +
  '</script></body></html>';

const MISSING =
  '<html><head><title>A page that asks a missing file</title></head><body><div id="out"></div>' +
  "<script>document.getElementById('out').textContent = 'The page asks a file that is absent. " +
  "The inspection record names each ship, the port, the day and the result. '.repeat(3);" +
  "fetch('/missing.json').catch(() => undefined);</script></body></html>";

// The bytes hold a shell with no text, and the script draws a bot challenge.
const DRAWN_CHALLENGE =
  '<html><head><title>Example Port register</title></head><body><div id="out"></div><script>' +
  "document.getElementById('out').textContent = 'Checking your browser. Run " +
  "${RUN}.';</script></body></html>";

let fixture: Fixture;
let base: string;

beforeAll(async () => {
  const html = { 'content-type': 'text/html; charset=utf-8' };
  fixture = await startFixture({
    '/table': { headers: html, body: TABLE },
    '/static': { headers: html, body: STATIC },
    '/private': { headers: html, body: PRIVATE },
    '/missing-file': { headers: html, body: MISSING },
    '/drawn-challenge': { headers: html, body: DRAWN_CHALLENGE },
    '/secret': { headers: { 'content-type': 'text/plain' }, body: SECRET },
  });
  base = `http://${FIXTURE_HOST}:${fixture.port}`;
});

afterAll(async () => {
  await fixture.close();
  await endMetadata();
});

const fetchDocument = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const answer = z.object({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  url: z.string(),
  pages: z.array(z.object({ page: z.number(), text: z.string() })),
  lastPage: z.number().nullable(),
  truncated: z.boolean(),
  notice: z.string().nullable(),
  rendered: z
    .strictObject({
      document: z.string(),
      status: z.enum(['known', 'stored']),
      title: z.string(),
    })
    .nullable(),
});

const fetched = async (ask: Ask, input: Record<string, unknown>, reach: Reach) => {
  const outcome = await callTool(fetchDocument, sessionOf(ask), input, reach);
  if (!outcome.ok) throw new Error(`fetch_document refused: ${outcome.refusal}`);
  return answer.parse(outcome.output);
};

const shaOf = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');

const documentRow = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  s3_key: z.string(),
  uri: z.string(),
  mime: z.string(),
  pages: z.number(),
});

const ROW = `SELECT d.id::text AS id, d.kind, d.title, d.s3_key, d.uri, d.mime,
                    (SELECT count(*) FROM public.document_text t WHERE t.document_id = d.id)::int AS pages
               FROM public.documents d WHERE d.sha256 = $1`;

const rowOf = async (ask: Ask, sha: string) => z.array(documentRow).parse(await ask(ROW, [sha]));

test('a script that fills a table gives its text with render, and the two documents are two rows', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, { url: `${base}/table`, render: true }, fixtureReach(store));
    expect(got.rendered).not.toBeNull();
    expect(got.rendered?.status).toBe('stored');
    expect(got.rendered?.title).toBe('Port state control search (rendered)');
    expect(got.rendered?.document).not.toBe(got.document);
    expect(got.pages[0]?.text).toContain('Detained at Port Louis');
    expect(got.pages[0]?.text).toContain(`Run ${RUN}`);

    expect(store.puts.map((put) => put.mime)).toStrictEqual(['text/html', 'text/html']);
    const [plainPut, renderedPut] = store.puts;
    expect(Buffer.from(plainPut?.bytes ?? []).toString('utf8')).toBe(TABLE);
    const renderedSha = shaOf(renderedPut?.bytes ?? new Uint8Array());
    expect(renderedPut?.key).toBe(`raw/${renderedSha}`);

    const [plain] = await rowOf(ask, shaOf(TABLE));
    const [rendered] = await rowOf(ask, renderedSha);
    expect(plain?.id).toBe(got.document);
    expect(rendered?.id).toBe(got.rendered?.document);
    expect(rendered).toMatchObject({
      kind: 'url',
      uri: `${base}/table`,
      mime: 'text/html',
      title: 'Port state control search (rendered)',
      s3_key: `raw/${renderedSha}`,
      pages: 1,
    });
    expect(plain?.uri).toBe(rendered?.uri);
    expect(plain?.title).toBe('Port state control search');
  });
});

test('a page with little text is rendered with no flag', async () => {
  await rolledBack('research', async (ask) => {
    const store = memoryStore();
    const got = await fetched(ask, { url: `${base}/table` }, fixtureReach(store));
    expect(got.rendered?.status).toBe('stored');
    expect(got.pages[0]?.text).toContain('Detained at Port Louis');
    expect(store.puts).toHaveLength(2);
  });
});

test('a request of the page to a private address is stopped, counted, and not stored', async () => {
  const store = memoryStore();
  const before = fixture.requests.length;
  // The name resolves to the fixture and to a private address, so only the range check stops it.
  const reach: Reach = {
    ...fixtureReach(store),
    lookup: (host) =>
      host === 'inside.test'
        ? Promise.resolve([
            { address: '127.0.0.1', family: 4 },
            { address: '10.20.30.40', family: 4 },
          ])
        : fixtureLookup(host),
    refuses: (address) => address !== '127.0.0.1' && refusedAddress(address),
  };
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, { url: `${base}/private`, render: true }, reach);
    expect(fixture.requests.slice(before)).toStrictEqual(['/private']);
    expect(got.notice).toMatch(/2 requests? .*private/u);
    expect(got.notice).not.toMatch(/10\.0\.0\.1|10\.20\.30\.40/u);
    expect(got.rendered?.status).toBe('stored');
    const renderedPut = store.puts[1];
    expect(Buffer.from(renderedPut?.bytes ?? []).toString('utf8')).not.toContain(SECRET);
  });
});

test('a page with no script and render gives two documents, and both ids come back', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, { url: `${base}/static`, render: true }, fixtureReach(store));
    expect(got.rendered).not.toBeNull();
    expect(got.rendered?.document).not.toBe(got.document);
    expect(got.pages[0]?.text).toContain(`Run ${RUN}`);
    expect(store.puts).toHaveLength(2);
    const [plain] = await rowOf(ask, shaOf(STATIC));
    const [rendered] = await rowOf(ask, shaOf(store.puts[1]?.bytes ?? new Uint8Array()));
    expect(plain?.id).toBe(got.document);
    expect(rendered?.id).toBe(got.rendered?.document);
  });
});

test('a file of the page that is absent is not counted as a private address', async () => {
  const before = fixture.requests.length;
  await rolledBack('research', async (ask) => {
    const got = await fetched(
      ask,
      { url: `${base}/missing-file`, render: true },
      fixtureReach(memoryStore()),
    );
    expect(fixture.requests.slice(before)).toStrictEqual(['/missing-file', '/missing.json']);
    expect(got.rendered?.status).toBe('stored');
    expect(got.notice ?? '').not.toMatch(/private/u);
  });
});

test('a render that draws a bot challenge is not stored, and the plain page comes back', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, { url: `${base}/drawn-challenge` }, fixtureReach(store));
    expect(got.rendered).toBeNull();
    expect(got.notice).toMatch(/the render was not stored: the page is a challenge/);
    expect(got.pages.map((page) => page.text).join('')).not.toContain('Checking your browser');
    expect(store.puts).toHaveLength(1);
    expect(await rowOf(ask, shaOf(DRAWN_CHALLENGE))).toHaveLength(1);
  });
});
