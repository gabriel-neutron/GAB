// A fact cites one line of a stored file, and the excerpt check passes. Each file is stored
// whole. Each test runs inside a transaction that rolls back.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MAX_BYTES } from './fetch-document.ts';
import { workbookOf, zipOf } from '@gab/text/xlsx-fixture';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import {
  FIXTURE_HOST,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { findLine } from './find-line.ts';
import { proposeOf } from './propose.ts';
import { callTool, type Session, type Tool } from './tool.ts';

const toolNamed = (name: string): Tool => {
  const tool = CATALOGUE.find((one) => one.name === name);
  if (tool === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return tool;
};
const storeSavedFile = toolNamed('store_saved_file');
const fetchDocument = toolNamed('fetch_document');

const sessionOf = (ask: Ask): Session => ({
  query: async (statement, values) => ({ rows: await ask(statement, values) }),
  pinned: true,
});

// Each run gets other bytes, so no row of an earlier run makes the file known.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const KEY = `KEY${RUN}`.toUpperCase();
const ROW = `9,${KEY},Example Trading`;

const root = mkdtempSync(join(tmpdir(), 'citation-'));
const inbox = join(root, 'inbox');
mkdirSync(inbox);
writeFileSync(
  join(inbox, 'book.xlsx'),
  workbookOf({
    Data: [
      ['id', 'key', 'name'],
      ['9', KEY, 'Example Trading'],
    ],
  }),
);
writeFileSync(join(inbox, 'set.zip'), zipOf([['rows.csv', `id,key,name\n1,a,b\n${ROW}\n`]]));

// A table above the 16 MiB of a page and the 20 MiB of a plain fetch, with the key near its end.
const FILLER = `1,filler,${'x'.repeat(100)}\n`;
const LARGE = `id,key,name\n${FILLER.repeat(Math.ceil(MAX_BYTES / FILLER.length))}${ROW}\n2,tail,z\n`;

let fixture: Fixture;
beforeAll(async () => {
  fixture = await startFixture({
    '/large.csv': { headers: { 'content-type': 'text/csv' }, body: LARGE },
    '/page.pdf': { headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.4' },
  });
});
afterAll(async () => {
  rmSync(root, { recursive: true, force: true });
  await fixture.close();
});

const stored = z.object({
  document: z.string(),
  files: z.array(z.object({ document: z.string() })).nullish(),
});

const lineOut = z.object({
  lines: z.array(z.object({ page: z.number(), line: z.number(), text: z.string() })),
  next: z.unknown(),
});

// Finds the row by its key, and cites the line that the tool gives.
const citesTheLine = async (ask: Ask, document: string): Promise<{ page: number }> => {
  const found = await callTool(findLine, sessionOf(ask), { document, text: KEY });
  if (!found.ok) throw new Error(found.refusal);
  const { lines } = lineOut.parse(found.output);
  expect(lines).toHaveLength(1);
  const [line] = lines;
  if (line === undefined) throw new Error('no line came back');
  expect(line.text).toContain(`${KEY},Example Trading`);
  const proposed = await callTool(proposeOf(null), sessionOf(ask), {
    items: [
      {
        ref: 'one',
        act: { op: 'create_entity', type: 'company', label: `Example Trading ${RUN}` },
        originator: 'The citation test',
        modality: 'asserts',
        evidence: [{ document, page: line.page, excerpt: line.text }],
      },
    ],
  });
  expect(proposed).toMatchObject({ ok: true });
  return { page: line.page };
};

test('a file above the fetch cap is stored whole with bulk, and a fact cites one of its lines', async () => {
  const store = memoryStore();
  const url = `http://${FIXTURE_HOST}:${String(fixture.port)}/large.csv`;
  await rolledBack('research', async (ask) => {
    const limit = z.array(z.object({ statement_timeout: z.string() }));
    const before = limit.parse(await ask('SHOW statement_timeout'));
    const plain = await callTool(fetchDocument, sessionOf(ask), { url }, fixtureReach(store));
    expect(plain).toMatchObject({ ok: false });
    const bulk = await callTool(
      fetchDocument,
      sessionOf(ask),
      { url, bulk: true },
      fixtureReach(store),
    );
    if (!bulk.ok) throw new Error(bulk.refusal);
    expect(limit.parse(await ask('SHOW statement_timeout'))).toStrictEqual(before);
    const { document } = stored.parse(bulk.output);
    const { page } = await citesTheLine(ask, document);
    expect(page).toBeGreaterThan(1);
    const uris = z
      .array(z.object({ uri: z.string() }))
      .parse(await ask('SELECT uri FROM api.document WHERE id = $1', [document]));
    expect(uris).toStrictEqual([{ uri: url }]);
    expect(Buffer.from(store.puts[0]?.bytes ?? []).toString()).toBe(LARGE);
  });
  // A file of some 20 MiB goes through the store and the text door, on a machine that many stacks share.
}, 120_000);

test('bulk refuses a type that is no data file, and stores nothing', async () => {
  const store = memoryStore();
  const url = `http://${FIXTURE_HOST}:${String(fixture.port)}/page.pdf`;
  await rolledBack('research', async (ask) => {
    const outcome = await callTool(
      fetchDocument,
      sessionOf(ask),
      { url, bulk: true },
      fixtureReach(store),
    );
    expect(outcome).toMatchObject({
      ok: false,
      refusal: expect.stringContaining('bulk') as string,
    });
    expect(store.puts).toHaveLength(0);
  });
});

const reach = () => ({ store: memoryStore(), inbox, now: () => new Date() });

test('a fact cites one line of a sheet of a workbook', async () => {
  await rolledBack('research', async (ask) => {
    const outcome = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file: 'book.xlsx', url: `https://stat.example/book-${RUN}.xlsx` },
      reach(),
    );
    if (!outcome.ok) throw new Error(outcome.refusal);
    expect(await citesTheLine(ask, stored.parse(outcome.output).document)).toStrictEqual({
      page: 1,
    });
  });
});

test('a fact cites one line of a file in a zip archive', async () => {
  await rolledBack('research', async (ask) => {
    const outcome = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file: 'set.zip', url: `https://stat.example/set-${RUN}.zip` },
      reach(),
    );
    if (!outcome.ok) throw new Error(outcome.refusal);
    const child = stored.parse(outcome.output).files?.[0]?.document;
    if (child === undefined) throw new Error('the archive gave no child document');
    expect(await citesTheLine(ask, child)).toStrictEqual({ page: 1 });
  });
});

test('an address that holds a key is refused, so a stored address never holds one', async () => {
  await rolledBack('research', async (ask) => {
    const outcome = await callTool(
      storeSavedFile,
      sessionOf(ask),
      { file: 'book.xlsx', url: `https://stat.example/book.xlsx?api_key=abc${RUN}` },
      reach(),
    );
    expect(outcome).toMatchObject({ ok: false });
  });
});
