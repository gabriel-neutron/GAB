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
import { ukSanctionsListAt } from './uk-sanctions-list.ts';

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// The first line, the header and the order of the columns of the official file. One entry has a
// line for each of its names and addresses.
const CSV =
  'Report Date: 08-Oct-2026\n' +
  'Last Updated,Unique ID,OFSI Group ID,UN Reference Number,Name 6,Name 1,Name type,' +
  'Regime Name,Designation Type,IMO number\n' +
  `04/08/2026,AFG0001,12703,TAe.010,EXCHANGE ${RUN},,Primary Name,Afghanistan,Entity,\n` +
  `09/05/2025,RUS2001,16100,,TANKER ${RUN},,Primary Name,Russia,Ship,9123456\n` +
  `09/05/2025,RUS2001,16100,,FORMER NAME ${RUN},,Alias,Russia,Ship,9123456\n`;

const PATH = '/docs/UK-Sanctions-List.csv';

let fixture: Fixture;
let address: string;

beforeAll(async () => {
  fixture = await startFixture({
    // The FCDO serves the file as a download with no text type.
    [PATH]: {
      body: CSV,
      headers: {
        'content-type': 'application/octet-stream',
        'last-modified': 'Thu, 08 Oct 2026 14:31:21 GMT',
      },
    },
    '/docs/not-the-list.csv': {
      body: '<html><body>Service unavailable</body></html>',
      headers: { 'content-type': 'text/html' },
    },
  });
  address = `http://${FIXTURE_HOST}:${String(fixture.port)}${PATH}`;
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
  entry: z.object({ uniqueId: z.string(), page: z.number(), excerpt: z.string() }).nullable(),
});

const RECORD = `SELECT (SELECT count(*) FROM public.entities)::int AS entities,
                       (SELECT count(*) FROM public.relations)::int AS relations`;

test('the whole file is stored once with its hash, its date and its provider, and an entry is cited by its identifier', async () => {
  const store = memoryStore();
  const tool = ukSanctionsListAt(address);
  const sha = createHash('sha256').update(CSV).digest('hex');
  const read = await rolledBack('research', async (ask) => {
    const before = await ask(RECORD);
    const first = await callTool(
      tool,
      sessionOf(ask),
      { uniqueId: 'RUS2001' },
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
      cited: await ask(
        `SELECT strpos(t.text, $2) > 0 AS found FROM public.document_text t
          WHERE t.document_id = $1 AND t.page = 1`,
        [got.document, got.entry?.excerpt ?? ''],
      ),
    };
  });
  expect(read.got).toMatchObject({
    status: 'stored',
    title: 'UK Sanctions List (CSV), published 2026-10-08',
    url: address,
    sha256: sha,
    publishedAt: '2026-10-08',
    entry: {
      uniqueId: 'RUS2001',
      page: 1,
      excerpt: `09/05/2025,RUS2001,16100,,TANKER ${RUN},,Primary Name,Russia,Ship,9123456`,
    },
  });
  expect(read.again).toMatchObject({ status: 'known', document: read.got.document, entry: null });
  expect(read.row).toStrictEqual([
    { uri: address, mime: 'text/csv', sha256: sha, provider_id: 'uk_sanctions_list', pages: 1 },
  ]);
  expect(read.cited).toStrictEqual([{ found: true }]);
  // The tool stores the file and loads no entry of it into the record.
  expect(read.after).toStrictEqual(read.before);
  expect(store.puts.map((put) => put.mime)).toStrictEqual(['text/csv']);
});

test('an identifier that the file does not hold is refused with the reason', async () => {
  const store = memoryStore();
  const read = await rolledBack('research', async (ask) =>
    callTool(
      ukSanctionsListAt(address),
      sessionOf(ask),
      { uniqueId: 'RUS9999' },
      fixtureReach(store),
    ),
  );
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.refusal).toMatch(
    /^the UK Sanctions List of 2026-10-08 \(document .+\) holds no entry RUS9999$/u,
  );
});

test('an answer that is not the UK Sanctions List is refused, and nothing is stored', async () => {
  const store = memoryStore();
  const read = await rolledBack('research', async (ask) =>
    callTool(
      ukSanctionsListAt(`http://${FIXTURE_HOST}:${String(fixture.port)}/docs/not-the-list.csv`),
      sessionOf(ask),
      {},
      fixtureReach(store),
    ),
  );
  expect(read).toStrictEqual({
    ok: false,
    refusal: 'the FCDO gave a file that is not the UK Sanctions List, so nothing is stored',
  });
  expect(store.puts).toStrictEqual([]);
});
