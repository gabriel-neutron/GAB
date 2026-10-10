// The tool of the OFAC SDN list against the disposable database as gabriel_research, and a local
// HTTP server that plays the Treasury and its object store. The object store of the record is in
// memory. Each call runs inside a transaction that rolls back.

import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { FIXTURE_HOST, fixtureReach, memoryStore } from './fetch-fixture.ts';
import { entryLine, ofacSdnAt } from './ofac-sdn.ts';
import { callTool, type Session } from './tool.ts';

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const CSV =
  `36,"AEROCARIBBEAN AIRLINES ${RUN}",-0- ,"CUBA",-0- ,-0- \r\n` +
  '173,"ANGLO-CARIBBEAN CO., LTD.",-0- ,"CUBA",-0- ,-0- \r\n' +
  `1736,"SCF ${RUN}",-0- ,"RUSSIA-EO14024",-0- ,"Vessel"\r\n\u001a`;

const SIGNED = '/Published/2026-10-08/SDN.CSV?X-Amz-Security-Token=a-secret-token';

let requests: string[] = [];
let server: Server;
let address: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const path = request.url ?? '/';
    requests.push(path);
    if (path === '/api/PublicationPreview/exports/SDN.CSV') {
      response.writeHead(302, { location: SIGNED }).end();
      return;
    }
    if (path === SIGNED) {
      response
        .writeHead(200, {
          'content-type': 'text/csv',
          'last-modified': 'Fri, 09 Oct 2026 14:01:35 GMT',
        })
        .end(CSV);
      return;
    }
    response.writeHead(404, { 'content-type': 'text/plain' }).end('absent');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = String((server.address() as AddressInfo).port);
  address = `http://${FIXTURE_HOST}:${port}/api/PublicationPreview/exports/SDN.CSV`;
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
  url: z.string(),
  sha256: z.string(),
  publishedAt: z.string().nullable(),
  entry: z.object({ entNum: z.number(), page: z.number(), excerpt: z.string() }).nullable(),
  notice: z.string().nullable(),
});

test('the whole file is stored once with its hash and its date, and an entry is cited by its number', async () => {
  requests = [];
  const store = memoryStore();
  const tool = ofacSdnAt(address);
  const sha = createHash('sha256').update(CSV).digest('hex');
  const read = await rolledBack('research', async (ask) => {
    const first = await callTool(tool, sessionOf(ask), { entNum: 1736 }, fixtureReach(store));
    const second = await callTool(tool, sessionOf(ask), {}, fixtureReach(store));
    if (!first.ok || !second.ok) throw new Error('the tool refused');
    const got = answer.parse(first.output);
    return {
      got,
      again: answer.parse(second.output),
      row: await ask(
        `SELECT d.uri, d.mime, d.sha256,
                (SELECT count(*) FROM public.document_text t WHERE t.document_id = d.id)::int AS pages
           FROM public.documents d WHERE d.id = $1`,
        [got.document],
      ),
      cited: await ask(
        `SELECT strpos(t.text, $2) > 0 AS found FROM public.document_text t
          WHERE t.document_id = $1 AND t.page = 1`,
        [got.document, got.entry?.excerpt ?? ''],
      ),
    };
  });
  expect(read.got).toMatchObject({
    status: 'stored',
    title: 'OFAC SDN list (CSV), published 2026-10-09',
    url: address,
    sha256: sha,
    publishedAt: '2026-10-09',
    entry: {
      entNum: 1736,
      page: 1,
      excerpt: `1736,"SCF ${RUN}",-0- ,"RUSSIA-EO14024",-0- ,"Vessel"`,
    },
    notice: null,
  });
  expect(read.again).toMatchObject({ status: 'known', document: read.got.document, entry: null });
  // The record keeps the address of the Treasury, and never the signed address with its token.
  expect(read.row).toStrictEqual([{ uri: address, mime: 'text/csv', sha256: sha, pages: 1 }]);
  expect(JSON.stringify(read)).not.toContain('a-secret-token');
  expect(read.cited).toStrictEqual([{ found: true }]);
  expect(store.puts.map((put) => put.mime)).toStrictEqual(['text/csv']);
});

test('an entry that the file does not hold gives a notice and no excerpt', async () => {
  const store = memoryStore();
  const read = await rolledBack('research', async (ask) =>
    callTool(ofacSdnAt(address), sessionOf(ask), { entNum: 99 }, fixtureReach(store)),
  );
  if (!read.ok) throw new Error(read.refusal);
  expect(answer.parse(read.output)).toMatchObject({
    entry: null,
    notice: 'the stored file holds no entry 99',
  });
});

test.each([
  [36, `36,"AEROCARIBBEAN AIRLINES ${RUN}",-0- ,"CUBA",-0- ,-0- `],
  [173, '173,"ANGLO-CARIBBEAN CO., LTD.",-0- ,"CUBA",-0- ,-0- '],
  [17, null],
  [3, null],
])('the line of entry %i is found by its number at the start of a line', (entNum, line) => {
  expect(entryLine(CSV, entNum)).toBe(line);
});

test('a long line is clipped to the cap of an excerpt, and stays a quote of the file', () => {
  const long = `5,"${'X'.repeat(800)}"\n`;
  const line = entryLine(long, 5) ?? '';
  expect(Array.from(line)).toHaveLength(600);
  expect(long.startsWith(line)).toBe(true);
});
