// The store of a file that a browser saved, against the disposable database as gabriel_research,
// with a store in memory and an inbox in a temporary folder. Each call runs inside a transaction
// that rolls back.

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
const outside = join(root, 'secret.txt');
writeFileSync(outside, 'A private file of the operator.');
writeFileSync(
  join(inbox, 'timeline.html'),
  `<html><head><title>Timeline</title></head><body><article><h1>Timeline ${RUN}</h1>` +
    `<p>${'On 23 June 2022 the Council adopted the sixth package of sanctions. '.repeat(6)}</p>` +
    '</article></body></html>',
);
writeFileSync(join(inbox, 'challenge.html'), '<html><body>Just a moment...</body></html>');
writeFileSync(join(inbox, 'notes.docx'), 'not read');
symlinkSync(outside, join(inbox, 'link.txt'));

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const reachOf = (store = memoryStore()) => ({
  store,
  inbox,
  now: () => new Date('2026-10-07T10:00:00Z'),
});

const row = z.object({ kind: z.string(), uri: z.string(), mime: z.string(), day: z.string() });

test('a saved page is stored once, under the address of its source', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const input = { file: 'timeline.html', url: URL_OF_PAGE, title: 'Timeline of the sanctions' };
    const first = await callTool(storeSavedFile, sessionOf(ask), input, reachOf(store));
    expect(first).toMatchObject({ ok: true, output: { status: 'stored', pages: 1 } });
    const second = await callTool(storeSavedFile, sessionOf(ask), input, reachOf(store));
    expect(second).toMatchObject({ ok: true, output: { status: 'known' } });

    const [held] = z
      .array(row)
      .parse(
        await ask(
          `SELECT kind, uri, mime, retrieved_at::text AS day FROM public.documents WHERE uri = $1`,
          [URL_OF_PAGE],
        ),
      );
    expect(held).toStrictEqual({
      kind: 'url',
      uri: URL_OF_PAGE,
      mime: 'text/html',
      day: '2026-10-07',
    });
  });
  expect(store.puts).toHaveLength(1);
});

test.each([
  ['a challenge page', 'challenge.html', 'bot filter'],
  ['a type that is not read', 'notes.docx', 'is not read'],
  ['a file that is not in the inbox', 'absent.pdf', 'no file named'],
  ['a link to a file outside the inbox', 'link.txt', 'not a plain file'],
])('%s is refused, and nothing is stored', async (_name, file, reason) => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file, url: URL_OF_PAGE },
      reachOf(store),
    );
    expect(got).toMatchObject({ ok: false });
    expect(got.ok ? '' : got.refusal).toContain(reason);
  });
  expect(store.puts).toHaveLength(0);
});

test.each(['../secret.txt', 'sub/timeline.html', '.hidden'])(
  'the file name %s is refused before any read',
  async (file) => {
    await rolledBack('research', async (ask) => {
      const got = await callTool(
        storeSavedFile,
        sessionOf(ask),
        { file, url: URL_OF_PAGE },
        reachOf(),
      );
      expect(got).toMatchObject({ ok: false });
    });
  },
);

test('an address with a user name is refused', async () => {
  await rolledBack('research', async (ask) => {
    const got = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file: 'timeline.html', url: 'https://user:pass@example.org/page' },
      reachOf(),
    );
    expect(got).toMatchObject({ ok: false });
  });
});
