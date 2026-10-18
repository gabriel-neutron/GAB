// The store of a file that a browser saved, against the disposable database as gabriel_research,
// with a store in memory and an inbox in a temporary folder. Each call runs inside a transaction
// that rolls back.

import {
  copyFileSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import { endOcr } from '@gab/text';
import { zipOf } from '@gab/text/xlsx-fixture';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type Session } from './tool.ts';

const storeSavedFile = CATALOGUE.find((tool) => tool.name === 'store_saved_file');
if (storeSavedFile === undefined)
  throw new Error('the catalogue holds no tool named store_saved_file');

const sessionOf = (ask: Ask): Session => ({
  query: async (statement, values) => ({ rows: await ask(statement, values) }),
});

// Each run gets other bytes, so no row of an earlier run makes the file known.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const URL_OF_PAGE = `https://www.consilium.europa.eu/en/timeline-${RUN}/`;

const root = mkdtempSync(join(tmpdir(), 'inbox-'));
const inbox = join(root, 'inbox');
mkdirSync(inbox);
const page = (body: string): string =>
  `<html><head><title>Timeline ${RUN}</title></head><body><article><h1>Timeline</h1>${body}` +
  '</article></body></html>';
const TEXT = `<p>${'On 3 June 2022 the Council adopted the sixth package of sanctions. '.repeat(6)}</p>`;
writeFileSync(join(inbox, 'timeline.html'), page(TEXT));
writeFileSync(join(inbox, 'challenge.html'), '<html><body>Just a moment...</body></html>');
writeFileSync(join(inbox, 'empty.html'), '<html><body></body></html>');
writeFileSync(join(inbox, 'notes.txt'), `A note that the AI wrote. Run ${RUN}.`);
// An ENTSOG answer that the operator saved from the browser, and a Comext table in TSV.
writeFileSync(
  join(inbox, 'entsog.json'),
  `{"operationaldatas":[{"pointLabel":"Budince","directionKey":"exit","value":0,"run":"${RUN}"}]}`,
);
writeFileSync(
  join(inbox, 'comext.tsv'),
  'freq,reporter,partner,product,flow,indicators\\TIME_PERIOD\t2026-07 \n' +
    `M,HU,RU,27090090,1,QUANTITY_IN_100KG\t3272070.00 ${RUN}\n`,
);
writeFileSync(join(inbox, 'data.bin'), Buffer.from([0x00, 0x01, 0x02, 0xff]));
writeFileSync(join(inbox, 'binary.txt'), Buffer.from([0x41, 0x01, 0x02, 0x03, 0x42]));
writeFileSync(join(inbox, 'latin1.csv'), Buffer.from([0x6e, 0x0a, 0x8a, 0x61, 0xbe, 0x61]));
writeFileSync(join(inbox, 'archive.zip'), zipOf([['logo.bin', 'No reader takes this.']]));
// A bulk file of two tables and a file that no reader takes, and a hostile archive.
const BULK = [
  ['entities.csv', `id,name\nNK-1,Nayara ${RUN}\n`],
  ['data/notes.txt', `The notes of run ${RUN}.`],
  ['logo.bin', 'No reader takes this.'],
] as const;
writeFileSync(join(inbox, 'bulk.zip'), zipOf(BULK));
writeFileSync(join(inbox, 'hostile.zip'), zipOf([['../outside.txt', `Run ${RUN}.`]]));
writeFileSync(join(inbox, 'big.html'), Buffer.alloc(UPLOAD_FILE_BYTES + 1, 0x20));
const IMAGES = join(import.meta.dirname, '../../text/fixtures');
copyFileSync(join(IMAGES, 'unit-tree.png'), join(inbox, 'unit-tree.png'));
copyFileSync(join(IMAGES, 'blank.png'), join(inbox, 'blank.png'));
// The signature and the header chunk of a PNG image of 10,000 by 10,000 pixels, with no picture.
const hugeHead = Buffer.alloc(33);
hugeHead.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
hugeHead.writeUInt32BE(10_000, 16);
hugeHead.writeUInt32BE(10_000, 20);
writeFileSync(join(inbox, 'huge.png'), hugeHead);
const outside = join(root, 'secret.html');
writeFileSync(outside, page('<p>A private page of the operator, outside the inbox.</p>'));

afterAll(async () => {
  rmSync(root, { recursive: true, force: true });
  await endOcr();
});

const reachOf = (store = memoryStore(), folder = inbox) => ({
  store,
  inbox: folder,
  now: () => new Date(),
});

const row = z.object({
  kind: z.string(),
  uri: z.string(),
  mime: z.string(),
  day: z.string(),
  title: z.string(),
});

test('a saved page is stored once, under the address of its source, as saved by the browser', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const input = { file: 'timeline.html', url: URL_OF_PAGE };
    const first = await callTool(storeSavedFile, sessionOf(ask), input, reachOf(store));
    expect(first).toMatchObject({ ok: true, output: { status: 'stored', pages: 1 } });
    const second = await callTool(storeSavedFile, sessionOf(ask), input, reachOf(store));
    expect(second).toMatchObject({ ok: true, output: { status: 'known' } });

    const [held] = z.array(row).parse(
      await ask(
        `SELECT kind, uri, mime, retrieved_at::text AS day, title
           FROM public.documents WHERE uri = $1`,
        [URL_OF_PAGE],
      ),
    );
    expect(held).toStrictEqual({
      kind: 'url',
      uri: URL_OF_PAGE,
      mime: 'text/html',
      day: new Date().toISOString().slice(0, 10),
      title: `Timeline ${RUN} (saved by the browser)`,
    });
  });
  expect(store.puts).toHaveLength(1);
});

test.each([
  ['notes.txt', 'text/plain', 'A note that the AI wrote.'],
  ['entsog.json', 'application/json', '"pointLabel": "Budince"'],
  ['comext.tsv', 'text/tab-separated-values', 'QUANTITY_IN_100KG\t3272070.00'],
])('the text file %s is stored once, with its bytes as they came', async (file, mime, text) => {
  const store = memoryStore();
  const url = `https://example.org/${file}?run=${RUN}&from=2026-07-01`;
  await rolledBack('research', async (ask) => {
    const first = await callTool(storeSavedFile, sessionOf(ask), { file, url }, reachOf(store));
    expect(first).toMatchObject({ ok: true, output: { status: 'stored', pages: 1 } });
    const second = await callTool(storeSavedFile, sessionOf(ask), { file, url }, reachOf(store));
    expect(second).toMatchObject({ ok: true, output: { status: 'known' } });
    const [held] = z.array(z.object({ uri: z.string(), mime: z.string(), text: z.string() })).parse(
      await ask(
        `SELECT d.uri, d.mime, t.text FROM public.documents d
             JOIN public.document_text t ON t.document_id = d.id WHERE d.uri = $1`,
        [url],
      ),
    );
    expect(held?.uri).toBe(url);
    expect(held?.mime).toBe(mime);
    expect(held?.text).toContain(text);
  });
  expect(store.puts).toHaveLength(1);
  expect(Buffer.from(store.puts[0]?.bytes ?? []).equals(readFileSync(join(inbox, file)))).toBe(
    true,
  );
});

test('a saved PNG image is stored as an image, with its OCR text as the page', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file: 'unit-tree.png', url: `https://tochnyi.info/tree-${RUN}.png` },
      reachOf(store),
    );
    expect(got).toMatchObject({ ok: true, output: { status: 'stored', pages: 1 } });
  });
  expect(store.puts.map((put) => put.mime)).toStrictEqual(['image/png']);
});

const childRow = z.object({
  id: z.string(),
  uri: z.string(),
  mime: z.string(),
  archive_path: z.string(),
  archive_sha256: z.string(),
  text: z.string(),
});

test('a ZIP archive is one document, and each file that a reader takes is a child linked to it', async () => {
  const store = memoryStore();
  const url = `https://data.opensanctions.org/bulk-${RUN}.zip`;
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file: 'bulk.zip', url },
      reachOf(store),
    );
    if (!got.ok) throw new Error(got.refusal);
    const output = z
      .object({
        document: z.string(),
        files: z.array(
          z.object({
            path: z.string(),
            document: z.string(),
            status: z.string(),
            linked: z.string(),
          }),
        ),
        skipped: z.array(z.object({ path: z.string(), reason: z.string() })),
      })
      .parse(got.output);
    expect(output.files.map((file) => [file.path, file.status, file.linked])).toStrictEqual([
      ['entities.csv', 'stored', 'filled'],
      ['data/notes.txt', 'stored', 'filled'],
    ]);
    expect(output.skipped).toStrictEqual([
      { path: 'logo.bin', reason: 'no reader takes the type of its name' },
    ]);

    const archive = readFileSync(join(inbox, 'bulk.zip'));
    const children = z.array(childRow).parse(
      await ask(
        `SELECT c.id::text AS id, c.uri, c.mime, c.archive_path, a.sha256 AS archive_sha256,
                t.text
           FROM public.documents c
           JOIN public.documents a ON a.id = c.archive_id
           JOIN public.document_text t ON t.document_id = c.id
          WHERE c.archive_id = $1 ORDER BY c.archive_path`,
        [output.document],
      ),
    );
    expect(children.map((child) => [child.archive_path, child.uri, child.mime])).toStrictEqual([
      ['data/notes.txt', `${url}#data/notes.txt`, 'text/plain'],
      ['entities.csv', `${url}#entities.csv`, 'text/csv'],
    ]);
    // Each child is linked to the hash of the archive, and keeps its own text and hash.
    for (const child of children) {
      expect(child.archive_sha256).toBe(createHash('sha256').update(archive).digest('hex'));
      expect(child.id).toBe(
        output.files.find((file) => file.path === child.archive_path)?.document,
      );
    }
    expect(children.map((child) => child.text)).toStrictEqual([BULK[1][1], BULK[0][1]]);

    // The text of the archive lists each file with its hash, and the file that was not stored.
    const [listing] = z
      .array(z.object({ text: z.string() }))
      .parse(
        await ask('SELECT text FROM public.document_text WHERE document_id = $1', [
          output.document,
        ]),
      );
    expect(listing?.text).toContain(
      `entities.csv\t${String(BULK[0][1].length)} bytes\tsha256 ` +
        createHash('sha256').update(BULK[0][1]).digest('hex'),
    );
    expect(listing?.text).toContain('logo.bin\tnot stored: no reader takes the type of its name');

    // The door links no file that the text of the archive does not name with its hash.
    await ask('SAVEPOINT wrong_link');
    await expect(
      ask('SELECT public.fill_document_archive($1, $2, $3)', [
        children[0]?.id,
        output.document,
        'entities.csv',
      ]),
    ).rejects.toThrow(/names no file entities.csv with the hash/u);
    await ask('ROLLBACK TO SAVEPOINT wrong_link');

    // The same archive again is known, and so is each file.
    const again = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file: 'bulk.zip', url },
      reachOf(store),
    );
    expect(again).toMatchObject({
      ok: true,
      output: {
        status: 'known',
        files: [
          { status: 'known', linked: 'same' },
          { status: 'known', linked: 'same' },
        ],
      },
    });
  });
  expect(store.puts.map((put) => put.mime)).toStrictEqual([
    'application/zip',
    'text/csv',
    'text/plain',
  ]);
});

// The refusal of one call, and the number of objects that the call put in the store.
const refusalOf = async (
  file: string,
  url = URL_OF_PAGE,
  folder = inbox,
): Promise<{ refusal: string; puts: number }> => {
  const store = memoryStore();
  let refusal = '';
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file, url },
      reachOf(store, folder),
    );
    refusal = got.ok ? '' : got.refusal;
  });
  return { refusal, puts: store.puts.length };
};

test.each([
  ['a challenge page', 'challenge.html', 'bot filter'],
  ['a page with no text', 'empty.html', 'holds no text'],
  ['an image with no text', 'blank.png', 'holds no text'],
  ['an image above the pixel cap', 'huge.png', 'pixels'],
  ['a binary file of a type that no reader takes', 'data.bin', '.json, .tsv, .txt'],
  ['a binary file with a text extension', 'binary.txt', 'control character'],
  ['a text file that is no UTF-8', 'latin1.csv', 'not valid UTF-8'],
  ['a ZIP archive with no file that a reader takes', 'archive.zip', 'no file that a reader'],
  ['a ZIP archive with a path that leaves it', 'hostile.zip', 'leaves the archive'],
  ['a file larger than the upload limit', 'big.html', 'larger than'],
  ['a file that is not in the inbox', 'absent.pdf', 'no file named'],
])('%s is refused, and nothing is stored', async (_name, file, reason) => {
  const got = await refusalOf(file);
  expect(got.refusal).toContain(reason);
  expect(got.puts).toBe(0);
});

test.each([
  ['a Nominatim answer', 'https://nominatim.openstreetmap.org/search?q=Kirishi', 'Nominatim'],
  ['a search result page', 'https://www.google.com/search?q=Kirishi', 'Google search'],
])('%s saved by the browser is refused, and nothing is stored', async (_name, url, reason) => {
  const got = await refusalOf('notes.txt', url);
  expect(got.refusal).toContain(reason);
  expect(got.puts).toBe(0);
});

test('an inbox that does not exist is named in the refusal', async () => {
  const got = await refusalOf('timeline.html', URL_OF_PAGE, join(root, 'no-inbox'));
  expect(got.refusal).toContain('does not exist');
  expect(got.puts).toBe(0);
});

test.skipIf(process.platform === 'win32')(
  'a link to a file outside the inbox is refused, and nothing is stored',
  async () => {
    symlinkSync(outside, join(inbox, 'soft.html'));
    const got = await refusalOf('soft.html');
    expect(got.refusal).toContain('not inside the inbox');
    expect(got.puts).toBe(0);
  },
);

test('a second hard link of a file is refused, and nothing is stored', async () => {
  linkSync(outside, join(inbox, 'hard.html'));
  const got = await refusalOf('hard.html');
  expect(got.refusal).toContain('more than one link');
  expect(got.puts).toBe(0);
});

test('an address with a user name is refused, and nothing is stored', async () => {
  const got = await refusalOf('timeline.html', 'https://user:pass@example.org/page');
  expect(got.refusal).toContain('no user name');
  expect(got.puts).toBe(0);
});

// A PDF written by hand: one page with one line of text.
const pdfOf = (line: string): Buffer => {
  const stream = `BT /F1 18 Tf 20 100 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 200] ' +
      '/Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const at = out.length;
    out += `${String(index + 1)} 0 obj\n${object}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const at of offsets) out += `${String(at).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
};

const shaOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const hashRow = z.object({ sha256: z.string(), title: z.string(), mime: z.string() });
const heldOf = async (ask: Ask, url: string) =>
  z
    .array(hashRow)
    .parse(await ask('SELECT sha256, title, mime FROM public.documents WHERE uri = $1', [url]));

test('the bytes that the browser holds are stored with their own hash, with no file', async () => {
  const store = memoryStore();
  const url = `https://www.consilium.europa.eu/en/held-${RUN}/`;
  const bytes = Buffer.from(`<!doctype html>\n${page(TEXT)}`, 'utf8');
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { content: bytes.toString('base64'), type: 'text/html', sha256: shaOf(bytes), url },
      { store, now: () => new Date() },
    );
    expect(got).toMatchObject({ ok: true, output: { status: 'stored', pages: 1 } });
    expect(await heldOf(ask, url)).toStrictEqual([
      { sha256: shaOf(bytes), title: `Timeline ${RUN} (saved by the browser)`, mime: 'text/html' },
    ]);
  });
});

test('a PDF in three parts is stored once, when its last part comes', async () => {
  const store = memoryStore();
  const url = `https://www.gov.uk/notice-${RUN}.pdf`;
  const bytes = pdfOf(`Asset freeze notice ${RUN}`);
  const text = bytes.toString('base64');
  const size = Math.ceil(text.length / 3 / 4) * 4;
  await rolledBack('research', async (ask) => {
    const outputs = [];
    for (let part = 1; part <= 3; part += 1)
      outputs.push(
        await callTool(
          storeSavedFile,
          sessionOf(ask),
          {
            content: text.slice((part - 1) * size, part * size),
            type: 'application/pdf',
            sha256: shaOf(bytes),
            part,
            parts: 3,
            url,
          },
          reachOf(store),
        ),
      );
    expect(outputs).toMatchObject([
      { ok: true, output: { status: 'waiting', received: 1, parts: 3 } },
      { ok: true, output: { status: 'waiting', received: 2, parts: 3 } },
      { ok: true, output: { status: 'stored', pages: 1 } },
    ]);
    const [held] = await heldOf(ask, url);
    expect(held?.sha256).toBe(shaOf(bytes));
    expect(held?.title).toMatch(/\(saved by the browser\)$/u);
  });
  expect(store.puts).toHaveLength(1);
});

test('a part that is not the next part is refused, and the parts start again', async () => {
  const store = memoryStore();
  const url = `https://www.gov.uk/order-${RUN}.pdf`;
  await rolledBack('research', async (ask) => {
    const send = (part: number) =>
      callTool(
        storeSavedFile,
        sessionOf(ask),
        { content: 'QUJD', type: 'application/pdf', sha256: 'a'.repeat(64), part, parts: 3, url },
        reachOf(store),
      );
    expect(await send(1)).toMatchObject({ ok: true, output: { status: 'waiting' } });
    const late = await send(3);
    expect(late.ok ? '' : late.refusal).toContain('part 1');
    expect(await send(2)).toMatchObject({ ok: false });
  });
  expect(store.puts).toHaveLength(0);
});

test.each([
  ['neither file nor content', { url: URL_OF_PAGE }, 'either file or content'],
  ['content with no type', { content: 'QUJD', url: URL_OF_PAGE }, 'type of the content'],
  ['content with no sha256', { content: 'QUJD', type: 'text/html', url: URL_OF_PAGE }, 'sha256'],
  [
    'content that is no base64',
    { content: 'A!', type: 'text/html', sha256: 'a'.repeat(64), url: URL_OF_PAGE },
    'base64',
  ],
  [
    'a part with no count',
    { content: 'QUJD', type: 'text/html', part: 1, url: URL_OF_PAGE },
    'together',
  ],
])('%s is refused', async (_name, input, reason) => {
  await rolledBack('research', async (ask) => {
    const got = await callTool(storeSavedFile, sessionOf(ask), input, reachOf());
    expect(got.ok ? '' : got.refusal).toContain(reason);
  });
});

test('bytes that do not have the hash of the browser are refused, and nothing is stored', async () => {
  const store = memoryStore();
  const bytes = Buffer.from(page(TEXT), 'utf8');
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      {
        content: bytes.toString('base64'),
        type: 'text/html',
        sha256: shaOf(Buffer.from('other bytes')),
        url: `https://www.consilium.europa.eu/en/copy-${RUN}/`,
      },
      reachOf(store),
    );
    expect(got.ok ? '' : got.refusal).toContain('sha256');
  });
  expect(store.puts).toHaveLength(0);
});

test('a page that names the charset of its origin is read as the UTF-8 that the browser gives', async () => {
  const url = `https://forum.example.ru/topic-${RUN}`;
  const text = 'Компания владеет тремя танкерами, и каждый сменил флаг за год. '.repeat(6);
  const bytes = Buffer.from(
    `<html><head><meta charset="windows-1251"><title>Форум ${RUN}</title></head>` +
      `<body><article><p>${text}</p></article></body></html>`,
    'utf8',
  );
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { content: bytes.toString('base64'), type: 'text/html', sha256: shaOf(bytes), url },
      reachOf(),
    );
    expect(got).toMatchObject({
      ok: true,
      output: { status: 'stored', title: `Форум ${RUN} (saved by the browser)` },
    });
    const [held] = z.array(z.object({ text: z.string() })).parse(
      await ask(
        `SELECT t.text FROM public.documents d
             JOIN public.document_text t ON t.document_id = d.id WHERE d.uri = $1`,
        [url],
      ),
    );
    expect(held?.text).toContain('Компания владеет');
  });
});
