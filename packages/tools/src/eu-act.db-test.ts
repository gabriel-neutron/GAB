// The tool of the official EU acts, and the read of an XML file by fetch_document, against the
// disposable database as gabriel_research and a local HTTP server that plays the Cellar. The
// object store is in memory. Each call runs inside a transaction that rolls back.

import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { euActAt } from './eu-act.ts';
import { FIXTURE_HOST, fixtureReach, memoryStore } from './fetch-fixture.ts';
import { callTool, type Session, type Tool } from './tool.ts';

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const XHTML =
  '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head>' +
  '<title>Council Regulation (EU) No 833/2014</title></head><body>' +
  `<p class="oj-doc-ti">COUNCIL REGULATION (EU) No 833/2014 of 31 July 2014. Run ${RUN}.</p>` +
  `<p>${'Article 3m prohibits the purchase of crude oil that originates in Russia. '.repeat(5)}</p>` +
  '</body></html>';

const XML =
  `<?xml version="1.0"?><list><entry><uid>36</uid><name>AEROCARIBBEAN ${RUN}</name></entry>` +
  '</list>';

const asked: IncomingHttpHeaders[] = [];
let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    asked.push(request.headers);
    const path = request.url ?? '/';
    const accept = request.headers.accept;
    const language = request.headers['accept-language'];
    if (path === '/resource/celex/32014R0833') {
      if (accept === 'application/xhtml+xml' && language === 'eng')
        response.writeHead(303, { location: '/resource/cellar/65b0.0006.03/DOC_1' }).end();
      else response.writeHead(406, { 'content-type': 'text/plain' }).end('not acceptable');
      return;
    }
    if (path === '/resource/cellar/65b0.0006.03/DOC_1') {
      response.writeHead(200, { 'content-type': 'application/xhtml+xml;charset=UTF-8' }).end(XHTML);
      return;
    }
    if (path === '/resource/celex/32014R0834') {
      response.writeHead(303, { location: '/resource/cellar/other/DOC_1' }).end();
      return;
    }
    if (path === '/resource/cellar/other/DOC_1') {
      response.writeHead(200, { 'content-type': 'text/html' }).end('<html>a list</html>');
      return;
    }
    if (path === '/sdn.xml') {
      response.writeHead(200, { 'content-type': 'text/xml' }).end(XML);
      return;
    }
    response.writeHead(403, { 'content-type': 'text/plain' }).end('forbidden');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://${FIXTURE_HOST}:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const answer = z.object({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  mime: z.string(),
  url: z.string(),
  pages: z.array(z.object({ page: z.number(), text: z.string() })),
});

const call = async (ask: Ask, tool: Tool, input: Record<string, unknown>) => {
  const store = memoryStore();
  const outcome = await callTool(tool, sessionOf(ask), input, fixtureReach(store));
  return { outcome, store };
};

test('eu_act asks for the format and the language, and stores the official text with its address', async () => {
  const tool = euActAt(`${base}/resource/celex/`);
  const read = await rolledBack('research', async (ask) => {
    const { outcome, store } = await call(ask, tool, { celex: '32014r0833' });
    if (!outcome.ok) throw new Error(outcome.refusal);
    const got = answer.parse(outcome.output);
    return {
      got,
      puts: store.puts.map((put) => put.mime),
      row: await ask('SELECT kind, uri, mime FROM public.documents WHERE id = $1', [got.document]),
    };
  });
  expect(read.got.status).toBe('stored');
  expect(read.got.title).toBe('Council Regulation (EU) No 833/2014 (CELEX 32014R0833, eng)');
  expect(read.got.url).toBe(`${base}/resource/cellar/65b0.0006.03/DOC_1`);
  expect(read.got.pages[0]?.text).toContain('Article 3m prohibits the purchase of crude oil');
  expect(read.puts).toStrictEqual(['application/xhtml+xml']);
  expect(read.row).toStrictEqual([
    {
      kind: 'url',
      uri: `${base}/resource/cellar/65b0.0006.03/DOC_1`,
      mime: 'application/xhtml+xml',
    },
  ]);
  const first = asked.find((headers) => headers.accept === 'application/xhtml+xml');
  expect(first?.['user-agent']).toBe('gabriel-fetch/1');
  expect(first?.['accept-language']).toBe('eng');
});

test('a refusal of the publisher is reported once, and nothing is stored', async () => {
  const tool = euActAt(`${base}/resource/celex/`);
  const before = asked.length;
  const read = await rolledBack('research', async (ask) =>
    call(ask, tool, { celex: '32099R9999' }),
  );
  expect(read.outcome.ok).toBe(false);
  if (!read.outcome.ok) {
    expect(read.outcome.refusal).toContain('the server answered 403');
    expect(read.outcome.refusal).toContain('does not ask again');
  }
  expect(read.store.puts).toStrictEqual([]);
  expect(asked.length - before).toBe(1);
});

test('an answer in another format than the one asked for is refused', async () => {
  const tool = euActAt(`${base}/resource/celex/`);
  const read = await rolledBack('research', async (ask) =>
    call(ask, tool, { celex: '32014R0834' }),
  );
  expect(read.outcome.ok).toBe(false);
  if (!read.outcome.ok) expect(read.outcome.refusal).toContain('gave text/html and not');
  expect(read.store.puts).toStrictEqual([]);
});

test('a CELEX number of a wrong form is refused before any request', async () => {
  const tool = euActAt(`${base}/resource/celex/`);
  const before = asked.length;
  const read = await rolledBack('research', async (ask) => call(ask, tool, { celex: '../x' }));
  expect(read.outcome.ok).toBe(false);
  expect(asked.length).toBe(before);
});

test('fetch_document gives the text of an XML file, one value on each line', async () => {
  const fetch = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (fetch === undefined) throw new Error('no fetch_document');
  const read = await rolledBack('research', async (ask) =>
    call(ask, fetch, { url: `${base}/sdn.xml` }),
  );
  if (!read.outcome.ok) throw new Error(read.outcome.refusal);
  const got = answer.parse(read.outcome.output);
  expect(got.mime).toBe('text/xml');
  expect(got.pages[0]?.text).toBe(`list\n  entry\n    uid: 36\n    name: AEROCARIBBEAN ${RUN}`);
});
