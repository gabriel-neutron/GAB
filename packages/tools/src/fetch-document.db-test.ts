// The fetch tool against the disposable database as gabriel_research, and a local HTTP server.
// The object store is in memory. Each call runs inside a transaction that rolls back.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { endOcr } from '@gab/text';
import { zipOf } from '@gab/text/xlsx-fixture';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import {
  FETCH_DAY,
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

// A page of a forum in windows-1251. The server names no charset, and only the meta element does.
// The comment makes other bytes for each run.
let cp1251: Buffer;

// The script of a wiki names a CAPTCHA for its own forms, in a long page of normal text.
const WIKI =
  '<html><head><title>A wiki article</title><script>var config = {"wgConfirmEditConfig":' +
  '{"captchaType":"fancycaptcha"}};</script></head><body><article><h1>A shipping company</h1>' +
  `<p>Run ${RUN}. ${'The company owns three tankers, and each one changed its flag in the year. '.repeat(30)}</p>` +
  '</article></body></html>';

// A short page with a CAPTCHA widget, and enough text that it is no shell and no challenge.
const WIDGET =
  '<html><head><title>A login</title></head><body><article><h1>Members of the forum</h1>' +
  `<p>Run ${RUN}. ${'Only a member of the forum reads the threads of this section. '.repeat(5)}</p>` +
  '<div class="cf-turnstile" data-sitekey="x"></div></article></body></html>';

// An ENTSOG answer of one line, and the address of its query.
const ENTSOG = `{"operationaldatas":[{"indicator":"Physical Flow","pointLabel":"Budince","value":0,"run":"${RUN}"}]}`;
const ENTSOG_QUERY = `/api/v1/operationaldatas?indicator=Physical%20Flow&from=2026-07-01&run=${RUN}`;

// A Comext table in SDMX-CSV above the page limit of 16 MiB and under the fetch cap.
const CSV_HEADER = 'DATAFLOW,freq,reporter,partner,product,indicators,TIME_PERIOD,OBS_VALUE';
const CSV_ROW = 'ESTAT:DS-045409(1.0),M,HU,RU,27090090,QUANTITY_IN_100KG,2026-07,3272070.00\n';
const BIG_CSV = `${CSV_HEADER}\n${CSV_ROW.repeat(230_000)}${RUN}\n`;

// A bulk file of two tables, served as bytes with no type, and an archive with a path that leaves
// it.
const BULK = zipOf([
  ['entities.csv', `id,name\nNK-1,Nayara ${RUN}\n`],
  ['sanctions/targets.json', `{"run":"${RUN}"}`],
]);
const HOSTILE = zipOf([['../outside.txt', `Run ${RUN}.`]]);

const PDF = pdfOf(`Asset freeze notice ${RUN}`, 'HM Treasury');

// Each image holds large English and Cyrillic words, so a check of whole words stays true when OCR
// misreads one sign.
const IMAGES = join(import.meta.dirname, '../../text/fixtures');
let png: Uint8Array;
let jpeg: Uint8Array;

let fixture: Fixture;
let base: string;

beforeAll(async () => {
  png = await readFile(join(IMAGES, 'unit-tree.png'));
  jpeg = await readFile(join(IMAGES, 'unit-tree.jpg'));
  cp1251 = Buffer.concat([
    await readFile(join(IMAGES, 'windows-1251.html')),
    Buffer.from(`<!-- Run ${RUN} -->`),
  ]);
  fixture = await startFixture({
    // A bare file server names no type, and the type comes from the first bytes.
    '/tree': { body: png },
    '/photo.jpg': { headers: { 'content-type': 'image/jpeg' }, body: jpeg },
    '/entry.html': { headers: { 'content-type': 'text/html; charset=utf-8' }, body: HTML },
    '/moved': { status: 301, headers: { location: '/entry.html' } },
    '/app': { headers: { 'content-type': 'text/html' }, body: SHORT },
    [ENTSOG_QUERY]: {
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: ENTSOG,
    },
    '/comext.csv': {
      headers: { 'content-type': 'application/vnd.sdmx.data+csv; version=1.0.0' },
      body: BIG_CSV,
    },
    '/bulk.zip': { headers: { 'content-type': 'application/octet-stream' }, body: BULK },
    '/hostile.zip': { headers: { 'content-type': 'application/zip' }, body: HOSTILE },
    '/notice.pdf': { headers: { 'content-type': 'application/pdf' }, body: PDF },
    '/viewtopic.php': { headers: { 'content-type': 'text/html' }, body: cp1251 },
    '/wiki': { headers: { 'content-type': 'text/html; charset=UTF-8' }, body: WIKI },
    '/login': { headers: { 'content-type': 'text/html' }, body: WIDGET },
    // Qrator: a 401 with a page that only loads the script of the challenge.
    '/qrator': {
      status: 401,
      headers: { 'content-type': 'text/html' },
      body: '<html><script src="/__qrator/qauth.js"></script></html>',
    },
  });
  base = `http://${FIXTURE_HOST}:${fixture.port}`;
});

afterAll(async () => {
  await fixture.close();
  await Promise.all([endMetadata(), endOcr()]);
});

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const fetchDocument = toolNamed('fetch_document');
const propose = toolNamed('propose');

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
    expect(first.retrievedAt).toBe(FETCH_DAY.toISOString().slice(0, 10));
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
      retrieved_at: FETCH_DAY.toISOString().slice(0, 10),
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

test('a JSON answer is stored as it came, under its whole address, and its text is indented', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}${ENTSOG_QUERY}`, fixtureReach(store));
    expect(got.status).toBe('stored');
    expect(got.mime).toBe('application/json');
    expect(got.url).toBe(`${base}${ENTSOG_QUERY}`);
    expect(got.pages[0]?.text).toContain('\n      "pointLabel": "Budince",\n');
    expect(Buffer.from(store.puts[0]?.bytes ?? []).toString('utf8')).toBe(ENTSOG);
    const [row] = z.array(documentRow).parse(await ask(ROW, [shaOf(ENTSOG)]));
    expect(row?.uri).toBe(`${base}${ENTSOG_QUERY}`);
  });
});

test('a ZIP archive is stored with its list of files, and each file is a child document linked to it', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const outcome = await callTool(
      fetchDocument,
      sessionOf(ask),
      { url: `${base}/bulk.zip` },
      fixtureReach(store),
    );
    if (!outcome.ok) throw new Error(outcome.refusal);
    const got = answer
      .extend({
        files: z.array(z.object({ path: z.string(), document: z.string(), status: z.string() })),
        skipped: z.array(z.unknown()),
      })
      .parse(outcome.output);
    expect(got.mime).toBe('application/zip');
    expect(got.pages[0]?.text).toContain('entities.csv\t');
    expect(got.files.map((file) => [file.path, file.status])).toStrictEqual([
      ['entities.csv', 'stored'],
      ['sanctions/targets.json', 'stored'],
    ]);
    expect(got.skipped).toStrictEqual([]);
    const links = z
      .array(z.object({ id: z.string(), archive_path: z.string(), archive_sha256: z.string() }))
      .parse(
        await ask(
          `SELECT c.id::text AS id, c.archive_path, a.sha256 AS archive_sha256
             FROM public.documents c JOIN public.documents a ON a.id = c.archive_id
            WHERE a.id = $1 ORDER BY c.archive_path`,
          [got.document],
        ),
      );
    expect(links).toStrictEqual(
      got.files.map((file) => ({
        id: file.document,
        archive_path: file.path,
        archive_sha256: shaOf(BULK),
      })),
    );
  });
  expect(store.puts.map((put) => put.mime)).toStrictEqual([
    'application/zip',
    'text/csv',
    'application/json',
  ]);
});

test('a ZIP archive with a path that leaves it is refused, and nothing is stored', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const outcome = await callTool(
      fetchDocument,
      sessionOf(ask),
      { url: `${base}/hostile.zip` },
      fixtureReach(store),
    );
    expect(outcome.ok ? '' : outcome.refusal).toContain('leaves the archive');
  });
  expect(store.puts).toStrictEqual([]);
});

test('a table above the page limit is cut into pages, and each page starts with its header', async () => {
  expect(Buffer.byteLength(BIG_CSV)).toBeGreaterThan(16 * 1024 * 1024);
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/comext.csv`, fixtureReach(store));
    expect(got.status).toBe('stored');
    const pages = z
      .array(z.object({ page: z.number(), head: z.string(), bytes: z.number() }))
      .parse(
        await ask(
          `SELECT t.page, left(t.text, ${CSV_HEADER.length}) AS head, octet_length(t.text) AS bytes
             FROM public.document_text t WHERE t.document_id = $1 ORDER BY t.page`,
          [got.document],
        ),
      );
    expect(pages.map((page) => page.page)).toStrictEqual([1, 2]);
    expect(pages.every((page) => page.head === CSV_HEADER)).toBe(true);
    expect(pages.every((page) => page.bytes <= 16 * 1024 * 1024)).toBe(true);
    expect(Buffer.from(store.puts[0]?.bytes ?? []).toString('utf8')).toBe(BIG_CSV);
  });
});

test('an HTML page with little text is stored, and the answer says that it may need a script', async () => {
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/app`, fixtureReach(memoryStore()));
    expect(got.status).toBe('stored');
    expect(got.notice).toMatch(/JavaScript/);
  });
});

test('a page in windows-1251 gives its title and its text in Cyrillic, and its bytes stay as they came', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/viewtopic.php`, fixtureReach(store));
    expect(got.title).toBe('Форум — Тема');
    expect(got.pages[0]?.text).toContain('Танкер сменил флаг три раза за один год');
    expect(got.notice).toBeNull();
    expect(Buffer.from(store.puts[0]?.bytes ?? []).equals(cp1251)).toBe(true);
  });
});

test('a long page whose script names a CAPTCHA gives no CAPTCHA notice', async () => {
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/wiki`, fixtureReach(memoryStore()));
    expect(got.status).toBe('stored');
    expect(got.notice).toBeNull();
  });
});

test('a short page with a CAPTCHA widget is stored, and the answer says that it looks like a CAPTCHA', async () => {
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/login`, fixtureReach(memoryStore()));
    expect(got.status).toBe('stored');
    expect(got.notice).toMatch(/looks like a CAPTCHA page/);
  });
});

const proposed = z.object({
  proposals: z.array(z.object({ ref: z.string(), written: z.boolean(), disputed: z.boolean() })),
});

test('a PNG image with no type is stored as an image, its OCR text is the page, and a claim cites it', async () => {
  const store = memoryStore();
  const reach = fixtureReach(store);
  const sha = shaOf(png);
  await rolledBack('research', async (ask) => {
    const first = await fetched(ask, `${base}/tree`, reach);
    expect(first.status).toBe('stored');
    expect(first.mime).toBe('image/png');
    expect(first.pages).toHaveLength(1);
    const text = first.pages[0]?.text ?? '';
    expect(text).toContain('BRIGADE HEADQUARTERS');
    expect(text).toContain('Бригада');
    expect(text).toContain('Командування');

    expect(store.puts.map((put) => [put.key, put.mime])).toStrictEqual([
      [`raw/${sha}`, 'image/png'],
    ]);
    expect(Buffer.from(store.puts[0]?.bytes ?? []).equals(Buffer.from(png))).toBe(true);
    const [row] = z.array(documentRow).parse(await ask(ROW, [sha]));
    expect(row).toMatchObject({ mime: 'image/png', pages: 1, extractor: 'text-1' });

    const second = await fetched(ask, `${base}/tree`, reach);
    expect(second.status).toBe('known');
    expect(second.document).toBe(first.document);
    expect(second.pages).toStrictEqual(first.pages);
    expect(store.puts).toHaveLength(1);

    const outcome = await callTool(
      propose,
      sessionOf(ask),
      {
        items: [
          {
            ref: 'brigade',
            act: { op: 'create_entity', type: 'company', label: 'Brigade Headquarters' },
            originator: 'The unit tree',
            modality: 'asserts',
            evidence: [{ document: first.document, page: 1, excerpt: 'BRIGADE HEADQUARTERS' }],
          },
        ],
      },
      reach,
    );
    if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
    expect(proposed.parse(outcome.output).proposals).toMatchObject([
      { ref: 'brigade', written: true },
    ]);
  });
});

test('a JPEG image is stored with its OCR text as the page', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await fetched(ask, `${base}/photo.jpg`, fixtureReach(store));
    expect(got.status).toBe('stored');
    expect(got.mime).toBe('image/jpeg');
    const text = got.pages[0]?.text ?? '';
    expect(text).toContain('ARTILLERY BATTALION');
    expect(text).toContain('Батальйон');
    expect(store.puts.map((put) => put.mime)).toStrictEqual(['image/jpeg']);
  });
});

test('a page that a bot filter refused with a 401 is read through the filter, and its HTML is stored', async () => {
  const store = memoryStore();
  const html = `<html><head><title>Register card</title></head><body><p>Company record ${RUN}.</p></body></html>`;
  const asked: string[] = [];
  const reach: Reach = {
    ...fixtureReach(store),
    readThroughFilter: (url) => {
      asked.push(url);
      return Promise.resolve({ url, html });
    },
  };
  await rolledBack('research', async (ask) => {
    const answer = await fetched(ask, `${base}/qrator`, reach);
    expect(asked).toStrictEqual([`${base}/qrator`]);
    expect(answer.status).toBe('stored');
    expect(answer.title).toBe('Register card');
    expect(answer.pages[0]?.text).toContain(`Company record ${RUN}.`);
    expect(answer.notice).toMatch(
      /answered 401 to the plain request, so the page was read in a Chrome window/,
    );
    expect(store.puts.map((put) => Buffer.from(put.bytes).toString('utf8'))).toStrictEqual([html]);
  });
});
