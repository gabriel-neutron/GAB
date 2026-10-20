// The tool of the UK Sanctions List against the disposable database as gabriel_research, and a
// local HTTP server that plays the FCDO. The object store of the record is in memory. Each call
// runs inside a transaction that rolls back.

import { createHash } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import {
  FIXTURE_HOST,
  fixtureReach,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { callTool, type Session } from './tool.ts';
import { KOROLEV_PROSPECT, UK_HEADER, ukRow } from './uk-list-fixture.ts';
import { ukSanctionsListAt } from './uk-sanctions-list.ts';

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const rows = [
  ukRow({ 'Unique ID': 'AFG0001', 'Name 6': `EXCHANGE ${RUN}`, 'Name type': 'Primary Name' }),
  KOROLEV_PROSPECT,
  // A made-up line with the shape of a ship that only the UK lists.
  ukRow({
    'Unique ID': 'RUS2928',
    'Name 6': 'EXAMPLE TANKER',
    'Name type': 'Primary Name',
    'Designation source': 'UK',
    'Date Designated': '15/05/2025',
    'IMO number': 'IMO9000001',
  }),
].join('\n');

// The report date differs from the Last-Modified date, so the test shows which one the tool reads.
const CSV = `Report Date: 07-Oct-2026\n${UK_HEADER}\n${rows}\n`;
const UNDATED = `Report Date: 7 October 2026\n${UK_HEADER}\n${rows}\n`;
const NO_IMO = `Report Date: 07-Oct-2026\n${UK_HEADER.replace(',IMO number,', ',IMO,')}\n${rows}\n`;

const DOWNLOAD = {
  'content-type': 'application/octet-stream',
  'last-modified': 'Thu, 08 Oct 2026 14:31:21 GMT',
};

let fixture: Fixture;
const at = (path: string): string => `http://${FIXTURE_HOST}:${String(fixture.port)}${path}`;

beforeAll(async () => {
  fixture = await startFixture({
    // The FCDO serves the file as a download with no text type.
    '/docs/UK-Sanctions-List.csv': { body: CSV, headers: DOWNLOAD },
    '/undated.csv': { body: UNDATED, headers: DOWNLOAD },
    '/no-imo.csv': { body: NO_IMO, headers: DOWNLOAD },
    '/refused.csv': { status: 405, headers: { 'content-type': 'text/plain' }, body: 'no' },
    '/not-the-list.csv': {
      body: '<html><body>Service unavailable</body></html>',
      headers: { 'content-type': 'text/html' },
    },
  });
});

afterAll(async () => {
  await fixture.close();
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
  entry: z
    .object({
      uniqueId: z.string(),
      page: z.number(),
      identity: z.string(),
      identifiers: z.string(),
    })
    .nullable(),
});

const RECORD = `SELECT (SELECT count(*) FROM public.entities)::int AS entities,
                       (SELECT count(*) FROM public.relations)::int AS relations`;

const FOUND = `SELECT strpos(t.text, $2) > 0 AS found FROM public.document_text t
                WHERE t.document_id = $1 AND t.page = 1`;

const PROVIDER = 'SELECT provider_id FROM public.documents WHERE id = $1';

test('the whole file is stored once with its hash, its date and its provider, and an entry is cited by its identifier', async () => {
  const store = memoryStore();
  const address = at('/docs/UK-Sanctions-List.csv');
  const tool = ukSanctionsListAt(address);
  const sha = createHash('sha256').update(CSV).digest('hex');
  const read = await rolledBack('research', async (ask) => {
    const before = await ask(RECORD);
    const first = await callTool(
      tool,
      sessionOf(ask),
      { uniqueId: 'RUS2176' },
      fixtureReach(store),
    );
    const second = await callTool(tool, sessionOf(ask), {}, fixtureReach(store));
    if (!first.ok || !second.ok) throw new Error('the tool refused');
    const got = answer.parse(first.output);
    return {
      got,
      again: answer.parse(second.output),
      before,
      after: await ask(RECORD),
      row: await ask(
        `SELECT d.uri, d.mime, d.sha256, d.provider_id,
                (SELECT count(*) FROM public.document_text t WHERE t.document_id = d.id)::int AS pages
           FROM public.documents d WHERE d.id = $1`,
        [got.document],
      ),
      cited: [
        await ask(FOUND, [got.document, got.entry?.identity ?? '-']),
        await ask(FOUND, [got.document, got.entry?.identifiers ?? '-']),
      ],
    };
  });
  expect(read.got).toMatchObject({
    status: 'stored',
    title: 'UK Sanctions List (CSV), published 2026-10-07',
    url: address,
    sha256: sha,
    publishedAt: '2026-10-07',
    entry: {
      uniqueId: 'RUS2176',
      page: 1,
      identity:
        '31/07/2024,RUS2176,,,KOROLEV PROSPECT,,,,,,Primary Name,,,,,,' +
        'The Russia (Sanctions) (EU Exit) Regulations 2019,Ship,UK',
      identifiers:
        '31/07/2024,,,,,,,,,,,,,,,IMO9826902,Stream Ship Management FZCO,,Gabon,,Oil Tanker,,,2019,',
    },
  });
  expect(read.again).toMatchObject({ status: 'known', document: read.got.document, entry: null });
  expect(read.row).toStrictEqual([
    { uri: address, mime: 'text/csv', sha256: sha, provider_id: 'uk_sanctions_list', pages: 1 },
  ]);
  expect(read.cited).toStrictEqual([[{ found: true }], [{ found: true }]]);
  // The tool stores the file and loads no entry of it into the record.
  expect(read.after).toStrictEqual(read.before);
  expect(store.puts.map((put) => put.mime)).toStrictEqual(['text/csv']);
});

test('a file that is stored already is said to be known, and its entry comes from its pages', async () => {
  const store = memoryStore();
  const tool = ukSanctionsListAt(at('/docs/UK-Sanctions-List.csv'));
  const read = await rolledBack('research', async (ask) => {
    const first = await callTool(tool, sessionOf(ask), {}, fixtureReach(store));
    const second = await callTool(
      tool,
      sessionOf(ask),
      { uniqueId: 'RUS2928' },
      fixtureReach(store),
    );
    if (!first.ok || !second.ok) throw new Error('the tool refused');
    return { first: answer.parse(first.output), second: answer.parse(second.output) };
  });
  expect(read.first.status).toBe('stored');
  expect(read.second.status).toBe('known');
  expect(read.second.document).toBe(read.first.document);
  expect(read.second.entry).toMatchObject({ uniqueId: 'RUS2928', page: 1 });
  expect(read.second.entry?.identity).toContain('EXAMPLE TANKER');
  expect(read.second.entry?.identifiers).toContain('IMO9000001');
});

test('a ship that only the UK lists gives its identity and its identifiers with a page', async () => {
  const read = await rolledBack('research', async (ask) =>
    callTool(
      ukSanctionsListAt(at('/docs/UK-Sanctions-List.csv')),
      sessionOf(ask),
      { uniqueId: 'RUS2928' },
      fixtureReach(memoryStore()),
    ),
  );
  if (!read.ok) throw new Error(read.refusal);
  const entry = answer.parse(read.output).entry;
  expect(entry?.page).toBe(1);
  expect(entry?.identity).toMatch(/^.*,RUS2928,.*EXAMPLE TANKER.*,UK$/u);
  expect(entry?.identifiers).toMatch(/^15\/05\/2025,.*IMO9000001/u);
});

test('a refusal of the server names its HTTP status, and nothing is stored', async () => {
  const store = memoryStore();
  const read = await rolledBack('research', async (ask) =>
    callTool(ukSanctionsListAt(at('/refused.csv')), sessionOf(ask), {}, fixtureReach(store)),
  );
  expect(read).toStrictEqual({
    ok: false,
    refusal:
      'the FCDO gave no UK Sanctions List: the server answered 405, and only a success is kept',
  });
  expect(store.puts).toStrictEqual([]);
});

test('a refused read falls back to the stored file, says so, and reads the entry from its pages', async () => {
  const store = memoryStore();
  const read = await rolledBack('research', async (ask) => {
    const first = await callTool(
      ukSanctionsListAt(at('/docs/UK-Sanctions-List.csv')),
      sessionOf(ask),
      {},
      fixtureReach(store),
    );
    const second = await callTool(
      ukSanctionsListAt(at('/refused.csv')),
      sessionOf(ask),
      { uniqueId: 'RUS2928' },
      fixtureReach(store),
    );
    if (!first.ok || !second.ok) throw new Error('the tool refused');
    return { first: answer.parse(first.output), second: second.output };
  });
  expect(read.second).toMatchObject({
    document: read.first.document,
    status: 'known',
    publishedAt: '2026-10-07',
    sha256: read.first.sha256,
    liveFault:
      'the FCDO gave no UK Sanctions List: the server answered 405, and only a success is kept',
    entry: { uniqueId: 'RUS2928', page: 1 },
  });
});

test('a file with no valid report date takes the day of its Last-Modified date', async () => {
  const read = await rolledBack('research', async (ask) =>
    callTool(
      ukSanctionsListAt(at('/undated.csv')),
      sessionOf(ask),
      {},
      fixtureReach(memoryStore()),
    ),
  );
  if (!read.ok) throw new Error(read.refusal);
  expect(answer.parse(read.output).publishedAt).toBe('2026-10-08');
});

test('a known file that a tool stored with no provider gets the provider of the UK list', async () => {
  const sha = createHash('sha256').update(CSV).digest('hex');
  const found = await rolledBack('research', async (ask) => {
    await ask(
      `SELECT public.put_fetched_document('url', 'An older read', $1, $2, $3, 'text/csv',
         (clock_timestamp() AT TIME ZONE 'UTC')::date)`,
      [`raw/${sha}`, at('/docs/UK-Sanctions-List.csv'), sha],
    );
    const read = await callTool(
      ukSanctionsListAt(at('/docs/UK-Sanctions-List.csv')),
      sessionOf(ask),
      {},
      fixtureReach(memoryStore()),
    );
    if (!read.ok) throw new Error(read.refusal);
    const got = answer.parse(read.output);
    return { status: got.status, provider: await ask(PROVIDER, [got.document]) };
  });
  expect(found).toStrictEqual({
    status: 'known',
    provider: [{ provider_id: 'uk_sanctions_list' }],
  });
});

test('an identifier that the file does not hold is refused with the reason', async () => {
  const read = await rolledBack('research', async (ask) =>
    callTool(
      ukSanctionsListAt(at('/docs/UK-Sanctions-List.csv')),
      sessionOf(ask),
      { uniqueId: 'RUS9999' },
      fixtureReach(memoryStore()),
    ),
  );
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.refusal).toMatch(
    /^the UK Sanctions List of 2026-10-07 \(document .+\) holds no entry RUS9999$/u,
  );
});

test.each([
  [
    '/not-the-list.csv',
    'the FCDO gave a file that is not the UK Sanctions List, so nothing is stored',
  ],
  ['/no-imo.csv', 'the UK Sanctions List has no column "IMO number", so nothing is stored'],
])('the answer of %s is refused, and nothing is stored', async (path, refusal) => {
  const store = memoryStore();
  const read = await rolledBack('research', async (ask) =>
    callTool(ukSanctionsListAt(at(path)), sessionOf(ask), {}, fixtureReach(store)),
  );
  expect(read).toStrictEqual({ ok: false, refusal });
  expect(store.puts).toStrictEqual([]);
});
