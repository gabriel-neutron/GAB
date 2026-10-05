// The fetch tool against the disposable database as gabriel_research, and a local HTTP server.
// The object store is in memory. Each call runs inside a transaction that rolls back.

import { createHash } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import {
  FIXTURE_HOST,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { callTool, type Reach, type Session, type Tool } from './tool.ts';

// A PDF written by hand: one page of text, and an information dictionary with an author and a
// creation date. Each test run gets other bytes, so no row of an earlier run makes it known.
const pdfOf = (line: string, author: string): Uint8Array => {
  const stream = `BT /F1 18 Tf 20 100 Td (${line}) Tj ET`;
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 200] ' +
      '/Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Author (${author}) /Title (A sanctions notice) /CreationDate (D:20240311120000Z) >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id] ?? ''}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
};

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const HTML =
  '<html><head><title>Intershipping - UK sanctions list</title></head><body><article>' +
  `<h1>Intershipping</h1><p>Designated under the regime. Run ${RUN}.</p>` +
  '<p>The entry names the company, its address and the date of the designation. ' +
  'It gives the reason for the designation in full, and the statement of reasons is long ' +
  'enough that a reader finds the text of a real page here.</p></article></body></html>';

const SHORT = `<html><head><title>An app</title></head><body><div id="root">Run ${RUN}</div></body></html>`;

const PDF = pdfOf(`Asset freeze notice ${RUN}`, 'HM Treasury');

let fixture: Fixture;
let base: string;

beforeAll(async () => {
  fixture = await startFixture({
    '/entry.html': { headers: { 'content-type': 'text/html; charset=utf-8' }, body: HTML },
    '/moved': { status: 301, headers: { location: '/entry.html' } },
    '/app': { headers: { 'content-type': 'text/html' }, body: SHORT },
    '/notice.pdf': { headers: { 'content-type': 'application/pdf' }, body: PDF },
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
  mime: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
  metadata: z.object({ author: z.string().nullable(), created: z.string().nullable() }),
  pages: z.array(z.object({ page: z.number(), text: z.string() })),
  lastPage: z.number().nullable(),
  truncated: z.boolean(),
  notice: z.string().nullable(),
});

const fetched = async (ask: Ask, url: string, reach: Reach) => {
  const outcome = await callTool(fetchDocument, sessionOf(ask), { url }, reach);
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
  retrieved_at: z.string(),
  pages: z.number(),
  extractor: z.string(),
});

const ROW = `SELECT d.id::text AS id, d.kind, d.title, d.s3_key, d.uri, d.mime,
                    d.retrieved_at::text AS retrieved_at,
                    (SELECT count(*) FROM public.document_text t WHERE t.document_id = d.id)::int AS pages,
                    (SELECT min(t.extractor) FROM public.document_text t WHERE t.document_id = d.id) AS extractor
               FROM public.documents d WHERE d.sha256 = $1`;

test('an HTML page is stored with its text, and a second call returns it as known and writes nothing', async () => {
  const store = memoryStore();
  const reach = fixtureReach(store);
  const sha = shaOf(HTML);
  await rolledBack('research', async (ask) => {
    const first = await fetched(ask, `${base}/moved`, reach);
    expect(first.status).toBe('stored');
    expect(first.document).toBe(`doc_${sha.slice(0, 12)}`);
    expect(first.title).toBe('Intershipping - UK sanctions list');
    expect(first.mime).toBe('text/html');
    expect(first.url).toBe(`${base}/entry.html`);
    expect(first.retrievedAt).toBe('2026-10-05');
    expect(first.pages[0]?.text).toContain(`Designated under the regime. Run ${RUN}.`);
    expect(first.notice).toBeNull();

    expect(store.puts.map((put) => [put.key, put.mime])).toStrictEqual([
      [`raw/${sha}`, 'text/html'],
    ]);
    expect(Buffer.from(store.puts[0]?.bytes ?? []).toString('utf8')).toBe(HTML);

    const [row] = z.array(documentRow).parse(await ask(ROW, [sha]));
    expect(row).toStrictEqual({
      id: first.document,
      kind: 'url',
      title: 'Intershipping - UK sanctions list',
      s3_key: `raw/${sha}`,
      uri: `${base}/entry.html`,
      mime: 'text/html',
      retrieved_at: '2026-10-05',
      pages: 1,
      extractor: 'text-1',
    });

    const second = await fetched(ask, `${base}/entry.html`, reach);
    expect(second.status).toBe('known');
    expect(second.document).toBe(first.document);
    expect(second.pages).toStrictEqual(first.pages);
    expect(store.puts).toHaveLength(1);
    const [again] = z.array(documentRow).parse(await ask(ROW, [sha]));
    expect(again).toStrictEqual(row);
  });
});

test('a PDF is stored with the text of its page, and its author and creation date come back', async () => {
  const store = memoryStore();
  const sha = shaOf(PDF);
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/notice.pdf`, fixtureReach(store));
    expect(got.status).toBe('stored');
    expect(got.mime).toBe('application/pdf');
    expect(got.title).toBe('A sanctions notice');
    expect(got.pages).toStrictEqual([{ page: 1, text: `Asset freeze notice ${RUN}` }]);
    expect(got.lastPage).toBe(1);
    expect(got.metadata.author).toBe('HM Treasury');
    expect(got.metadata.created).toMatch(/^2024-03-11/);
    expect(store.puts.map((put) => put.key)).toStrictEqual([`raw/${sha}`]);
    const [row] = z.array(documentRow).parse(await ask(ROW, [sha]));
    expect(row?.pages).toBe(1);
  });
});

test('an HTML page with little text is stored, and the answer says that it may need a script', async () => {
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/app`, fixtureReach(memoryStore()));
    expect(got.status).toBe('stored');
    expect(got.notice).toMatch(/JavaScript/);
  });
});
