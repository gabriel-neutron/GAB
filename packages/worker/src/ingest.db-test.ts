import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from './address.ts';
import { ingestFiles, type IngestDoor } from './ingest.ts';

// Departure: the suite signs as gabriel_app, the role that the command runs as, and reads the
// result as the owner of the database, because no api view shows a private table.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const app = new Pool({ connectionString: roleAddress('gabriel_app', 'GABRIEL_APP_PASSWORD') });
const owner = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD') });

const OPTIONS = {
  retrievedAt: '2026-09-01',
  kind: 'file',
  title: undefined,
  uri: undefined,
  providerId: undefined,
  costEur: undefined,
  dryRun: false,
} as const;

const BODIES = {
  'first.txt': 'ingest suite, the first file',
  'second.md': 'ingest suite, the second file',
  'third.csv': 'ingest suite,third,file',
} as const;
const COPY = 'copy-of-first.txt';
// PU1: an upload with its address is a public document, and a bought one is not.
const SOURCED = { 'public-page.txt': 'ingest suite, a file from a public page' } as const;
const BOUGHT = { 'bought.txt': 'ingest suite, a bought file' } as const;

let folder = '';
const puts: string[] = [];
const door: IngestDoor = {
  connect: () => app.connect(),
  put: (object) => {
    puts.push(object.key);
    return Promise.resolve(object.key);
  },
};

const hashOf = (text: string): string => createHash('sha256').update(text).digest('hex');
const idOf = (text: string): string => `doc_${hashOf(text).slice(0, 12)}`;
const ids = (): string[] => Object.values(BODIES).map(idOf);

const clean = async (): Promise<void> => {
  const list = [...ids(), ...Object.values(SOURCED).map(idOf), ...Object.values(BOUGHT).map(idOf)];
  await owner.query('DELETE FROM public.document_text WHERE document_id = ANY($1::text[])', [list]);
  await owner.query('DELETE FROM public.jobs WHERE document_id = ANY($1::text[])', [list]);
  await owner.query('DELETE FROM public.documents WHERE id = ANY($1::text[])', [list]);
};

beforeAll(async () => {
  await clean();
  folder = await mkdtemp(join(tmpdir(), 'ingest-db-suite-'));
  for (const [name, text] of Object.entries({ ...BODIES, ...SOURCED, ...BOUGHT }))
    await writeFile(join(folder, name), text);
  await writeFile(join(folder, COPY), BODIES['first.txt']);
});
afterAll(async () => {
  await clean();
  await rm(folder, { recursive: true, force: true });
  await app.end();
  await owner.end();
});

const paths = (...names: string[]): string[] => names.map((name) => join(folder, name));

test('three files give three documents, three done store_only jobs and their text', async () => {
  const outcomes = await ingestFiles(door, paths(...Object.keys(BODIES)), OPTIONS);
  expect(outcomes.map((o) => o.status)).toStrictEqual(['stored', 'stored', 'stored']);

  const documents = await owner.query<{ s3_key: string; sha256: string; day: string }>(
    `SELECT s3_key, sha256, retrieved_at::text AS day FROM public.documents
      WHERE id = ANY($1::text[])`,
    [ids()],
  );
  expect(documents.rows).toHaveLength(3);
  for (const row of documents.rows) {
    expect(row.s3_key).toBe(`raw/${row.sha256}`);
    expect(row.day).toBe('2026-09-01');
  }

  const jobs = await owner.query(
    'SELECT kind, status FROM public.jobs WHERE document_id = ANY($1::text[])',
    [ids()],
  );
  expect(jobs.rows).toStrictEqual([
    { kind: 'store_only', status: 'done' },
    { kind: 'store_only', status: 'done' },
    { kind: 'store_only', status: 'done' },
  ]);

  const text = await owner.query(
    'SELECT count(*)::int AS n FROM public.document_text WHERE document_id = ANY($1::text[])',
    [ids()],
  );
  expect(text.rows).toStrictEqual([{ n: 3 }]);
});

test('a second run reports three known files and writes nothing', async () => {
  const before = puts.length;
  const outcomes = await ingestFiles(door, paths(...Object.keys(BODIES)), OPTIONS);
  expect(outcomes.map((o) => o.status)).toStrictEqual(['known', 'known', 'known']);
  expect(puts).toHaveLength(before);
});

test('two files with the same bytes and different names give one document', async () => {
  const [outcome] = await ingestFiles(door, paths(COPY), OPTIONS);
  expect(outcome?.status).toBe('known');
  const count = await owner.query(
    'SELECT count(*)::int AS n FROM public.documents WHERE sha256 = $1',
    [hashOf(BODIES['first.txt'])],
  );
  expect(count.rows).toStrictEqual([{ n: 1 }]);
});

const addressOf = async (id: string): Promise<unknown> =>
  (
    await owner.query<{ uri: unknown; open: boolean }>(
      `SELECT d.uri, EXISTS (SELECT 1 FROM public.public_document p WHERE p.id = d.id) AS open
         FROM public.documents d WHERE d.id = $1`,
      [id],
    )
  ).rows[0];

const PAGE = 'https://example.org/public-page';

test('a file of the command with its address is public, and a bought one is not', async () => {
  const [sourced] = await ingestFiles(door, paths('public-page.txt'), { ...OPTIONS, uri: PAGE });
  expect(sourced?.status).toBe('stored');
  expect(await addressOf(idOf(SOURCED['public-page.txt']))).toStrictEqual({
    uri: PAGE,
    open: true,
  });

  const bought = { ...OPTIONS, uri: 'https://example.org/shop', costEur: '25.00' };
  const [paid] = await ingestFiles(door, paths('bought.txt'), bought);
  expect(paid?.status).toBe('stored');
  expect(await addressOf(idOf(BOUGHT['bought.txt']))).toStrictEqual({
    uri: 'https://example.org/shop',
    open: false,
  });
});

test('a known file with no address gets the address, and another address is refused', async () => {
  const id = idOf(SOURCED['public-page.txt']);
  await owner.query('UPDATE public.documents SET uri = NULL WHERE id = $1', [id]);

  const [filled] = await ingestFiles(door, paths('public-page.txt'), { ...OPTIONS, uri: PAGE });
  expect(filled?.status).toBe('known');
  expect(await addressOf(id)).toStrictEqual({ uri: PAGE, open: true });

  const other = { ...OPTIONS, uri: 'https://example.org/another-page' };
  const [refused] = await ingestFiles(door, paths('public-page.txt'), other);
  expect(refused).toMatchObject({ status: 'refused' });
  expect(refused?.reason).toMatch(/with another address/u);
  expect(await addressOf(id)).toStrictEqual({ uri: PAGE, open: true });
});
