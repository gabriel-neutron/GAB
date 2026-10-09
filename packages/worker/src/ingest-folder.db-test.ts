import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from './address.ts';
import { buildReport, summaryLines } from './ingest-report.ts';
import { expandPaths } from './ingest-walk.ts';
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
const WALK = { recursive: true, include: ['*.pdf'] };

// A PDF written by hand. Each page holds one text line, or none.
const pdfOf = (pages: readonly (string | null)[]): Uint8Array => {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((line, i) => {
    const stream = line === null ? '' : `BT /F1 18 Tf 20 100 Td (${line}) Tj ET`;
    objects[4 + i * 2] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] ' +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objects[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1)
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
};

const BORN_DIGITAL = pdfOf(['folder suite born digital page one', 'folder suite page two']);
const NEAR_COPY = pdfOf([
  'folder suite born digital page one',
  'folder suite page two',
  'folder suite page three',
]);
const NO_TEXT = pdfOf([null, null]);

const FILES: Readonly<Record<string, Uint8Array | string>> = {
  'alpha.pdf': BORN_DIGITAL,
  'alpha_compressed.pdf': NEAR_COPY,
  'beta.pdf': BORN_DIGITAL,
  'scan.pdf': NO_TEXT,
  'script.py': 'print("never taken")',
};

const puts: string[] = [];
const door: IngestDoor = {
  connect: () => app.connect(),
  put: (object) => {
    puts.push(object.key);
    return Promise.resolve(object.key);
  },
};

const hashOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const hashes = [BORN_DIGITAL, NEAR_COPY, NO_TEXT].map(hashOf);
const ids = hashes.map((hash) => `doc_${hash.slice(0, 12)}`);

const clean = async (): Promise<void> => {
  await owner.query('DELETE FROM public.document_text WHERE document_id = ANY($1::text[])', [ids]);
  await owner.query('DELETE FROM public.jobs WHERE document_id = ANY($1::text[])', [ids]);
  await owner.query('DELETE FROM public.documents WHERE id = ANY($1::text[])', [ids]);
};

const rowCounts = async (): Promise<number[]> => {
  const counts: number[] = [];
  for (const [table, column] of [
    ['documents', 'id'],
    ['document_text', 'document_id'],
    ['jobs', 'document_id'],
  ] as const) {
    const result = await owner.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.${table} WHERE ${column} = ANY($1::text[])`,
      [ids],
    );
    counts.push(result.rows[0]?.n ?? -1);
  }
  return counts;
};

let folder = '';
beforeAll(async () => {
  await clean();
  folder = await mkdtemp(join(tmpdir(), 'ingest-folder-suite-'));
  for (const [name, body] of Object.entries(FILES)) await writeFile(join(folder, name), body);
});
afterAll(async () => {
  await clean();
  await rm(folder, { recursive: true, force: true });
  await app.end();
  await owner.end();
});

test('a dry run reports what it would store and writes no row and no object', async () => {
  const files = await expandPaths([folder], WALK);
  expect(files.map((file) => file.slice(folder.length + 1))).toStrictEqual([
    'alpha.pdf',
    'alpha_compressed.pdf',
    'beta.pdf',
    'scan.pdf',
  ]);

  const outcomes = await ingestFiles(door, files, { ...OPTIONS, dryRun: true });
  expect(outcomes.map((o) => o.status)).toStrictEqual(['stored', 'stored', 'known', 'stored']);
  expect(puts).toHaveLength(0);
  expect(await rowCounts()).toStrictEqual([0, 0, 0]);

  const report = buildReport(outcomes, true);
  expect(report.dryRun).toBe(true);
  expect(report.counts).toStrictEqual({ stored: 3, known: 1, refused: 0 });
  expect(summaryLines(report).join('\n')).toContain('would store 3');
});

test('the run stores three documents, reports one known, and names the scan and the pair', async () => {
  const files = await expandPaths([folder], WALK);
  const outcomes = await ingestFiles(door, files, OPTIONS);
  expect(outcomes.map((o) => o.status)).toStrictEqual(['stored', 'stored', 'known', 'stored']);
  expect(puts).toHaveLength(3);
  // One text row for each page: 2 + 3 + 2.
  expect(await rowCounts()).toStrictEqual([3, 7, 3]);

  const report = buildReport(outcomes, false);
  expect(report.counts).toStrictEqual({ stored: 3, known: 1, refused: 0 });
  expect(report.noTextLayer.map((entry) => entry.path)).toStrictEqual([join(folder, 'scan.pdf')]);
  expect(report.noTextLayer[0]?.pageCount).toBe(2);
  expect(report.partialText).toStrictEqual([]);
  expect(report.nearCopies).toHaveLength(1);
  expect(report.nearCopies[0]?.files.map((file) => file.path)).toStrictEqual([
    join(folder, 'alpha.pdf'),
    join(folder, 'alpha_compressed.pdf'),
  ]);
  expect(outcomes.some((o) => o.path.endsWith('script.py'))).toBe(false);

  const documents = await owner.query<{ id: string }>(
    'SELECT id FROM public.documents WHERE id = ANY($1::text[]) ORDER BY id',
    [ids],
  );
  expect(documents.rows.map((row) => row.id)).toStrictEqual([...ids].sort());
});
