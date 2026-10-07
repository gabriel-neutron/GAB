// The store of a file that a browser saved, against the disposable database as gabriel_research,
// with a store in memory and an inbox in a temporary folder. Each call runs inside a transaction
// that rolls back.

import {
  copyFileSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import { endOcr } from '@gab/text';
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
writeFileSync(join(inbox, 'notes.txt'), 'A note that the AI wrote.');
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
  now: () => new Date('2026-10-07T10:00:00Z'),
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
      day: '2026-10-07',
      title: `Timeline ${RUN} (saved by the browser)`,
    });
  });
  expect(store.puts).toHaveLength(1);
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
  ['a text file, which is no saved page', 'notes.txt', 'is not a saved page'],
  ['a file larger than the upload limit', 'big.html', 'larger than'],
  ['a file that is not in the inbox', 'absent.pdf', 'no file named'],
])('%s is refused, and nothing is stored', async (_name, file, reason) => {
  const got = await refusalOf(file);
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
