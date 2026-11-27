// Migration 0100 gives the address of OFAC to each document that kept a signed address of the
// S3 bucket of the OFAC list service, and its check refuses each later signed address. The case
// runs the file inside a transaction that always rolls back.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from './probe.ts';

const MIGRATION = join(
  import.meta.dirname,
  '..',
  'db',
  'migrations',
  '0100_signed_document_address.sql',
);

const SIGNED =
  'https://wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com/Published/a/2026-10-27/b/ADD.CSV' +
  '?X-Amz-Expires=3600&X-Amz-Security-Token=test&X-Amz-Signature=test';

const PUT = `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, sha256)
             VALUES ($1, 'url', 'A test of migration 0100', $2, '2026-10-31', $3)`;

const HASH = 'a'.repeat(64);

test('a signed OFAC address becomes the export address, and the bytes and the hash stay', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    // The test database ran the migration already, so the case drops its check first.
    await ask('ALTER TABLE public.documents DROP CONSTRAINT documents_uri_unsigned');
    await ask(PUT, ['doc_m0100_ofac', SIGNED, HASH]);
    await ask(PUT, ['doc_m0100_page', 'https://example.org/a?Auth=AB', null]);
    await ask(await readFile(MIGRATION, 'utf8'));
    const rows = z
      .array(z.object({ id: z.string(), uri: z.string(), sha256: z.string().nullable() }))
      .parse(
        await ask(
          `SELECT id, uri, sha256 FROM public.documents WHERE id LIKE 'doc_m0100_%' ORDER BY id`,
        ),
      );
    const refused = await ask(PUT, ['doc_m0100_late', SIGNED, null]).then(
      () => 'stored',
      (fault: unknown) => (fault instanceof Error ? fault.message : String(fault)),
    );
    return { rows, refused };
  });
  expect(held.rows).toStrictEqual([
    {
      id: 'doc_m0100_ofac',
      uri: 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ADD.CSV',
      sha256: HASH,
    },
    { id: 'doc_m0100_page', uri: 'https://example.org/a?Auth=AB', sha256: null },
  ]);
  expect(held.refused).toMatch(/documents_uri_unsigned/u);
});
