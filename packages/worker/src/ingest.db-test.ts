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
  dryRun: false,
} as const;

const BODIES = {
  'first.txt': 'ingest suite, the first file',
  'second.md': 'ingest suite, the second file',
  'third.csv': 'ingest suite,third,file',
} as const;
const COPY = 'copy-of-first.txt';

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
const ids = (): string[] => Object.values(BODIES).map((text) => `doc_${hashOf(text).slice(0, 12)}`);

const clean = async (): Promise<void> => {
  const list = ids();
  await owner.query('DELETE FROM public.document_text WHERE document_id = ANY($1::text[])', [list]);
  await owner.query('DELETE FROM public.jobs WHERE document_id = ANY($1::text[])', [list]);
  await owner.query('DELETE FROM public.documents WHERE id = ANY($1::text[])', [list]);
};

beforeAll(async () => {
  await clean();
  folder = await mkdtemp(join(tmpdir(), 'ingest-db-suite-'));
  for (const [name, text] of Object.entries(BODIES)) await writeFile(join(folder, name), text);
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
