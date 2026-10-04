// One hash is one document. A second document with the same bytes is refused by the index, and a
// migration that meets two rows with one hash stops and names them. Each gesture runs inside a
// transaction that rolls back.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { rolledBack } from './probe.ts';

const SHA = 'c'.repeat(64);
const MIGRATION = join(
  import.meta.dirname,
  '..',
  'db',
  'migrations',
  '0028_document_hash_unique.sql',
);

const INSERT = `INSERT INTO public.documents (id, kind, title, s3_key, sha256, mime, retrieved_at)
  VALUES ($1, 'file', 'a report', $2, $3, 'application/pdf', current_date)`;

test('a second document with the same hash is refused by name', async () => {
  const error = await rolledBack('superuser', async (ask) => {
    await ask(INSERT, ['doc_c0de01', 'raw/one', SHA]);
    try {
      await ask(INSERT, ['doc_c0de02', 'raw/two', SHA]);
      return null;
    } catch (caught) {
      return caught as { code?: string; constraint?: string };
    }
  });
  expect(error?.code).toBe('23505');
  expect(error?.constraint).toBe('documents_sha256_key');
});

test('rows with no hash are not held by the index', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    await ask(
      `INSERT INTO public.documents (id, kind, title, uri, retrieved_at)
       VALUES ('doc_c0de03', 'url', 'one', 'https://example.org/1', current_date),
              ('doc_c0de04', 'url', 'two', 'https://example.org/2', current_date)`,
    );
    return ask("SELECT id FROM public.documents WHERE id IN ('doc_c0de03', 'doc_c0de04')");
  });
  expect(held).toHaveLength(2);
});

test('the migration stops on two rows with one hash and names the hash and both ids', async () => {
  const sql = await readFile(MIGRATION, 'utf8');
  const message = await rolledBack('superuser', async (ask) => {
    await ask('DROP INDEX public.documents_sha256_key');
    await ask(INSERT, ['doc_c0de05', 'raw/one', SHA]);
    await ask(INSERT, ['doc_c0de06', 'raw/two', SHA]);
    try {
      await ask(sql);
      return '';
    } catch (caught) {
      return (caught as Error).message;
    }
  });
  expect(message).toContain(SHA);
  expect(message).toContain('doc_c0de05');
  expect(message).toContain('doc_c0de06');
});
