// Migration 0068 gives its provider to each document that the tool of the EU acts or the tool of
// the OFAC SDN list stored before the tools gave it. The case runs the file inside a transaction
// that always rolls back.

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
  '0068_official_document_provider.sql',
);

const SDN = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV';

const PUT = `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, provider_id)
             VALUES ($1, $2, 'A test of migration 0068', $3, '2026-10-10', $4)`;

test('an EU act and an SDN list get their provider, and each other document stays as it is', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    await ask(PUT, [
      'doc_m0068_act',
      'url',
      'https://publications.europa.eu/resource/cellar/a/DOC_1',
      null,
    ]);
    await ask(PUT, ['doc_m0068_sdn', 'url', SDN, null]);
    await ask(PUT, ['doc_m0068_page', 'url', 'https://example.org/a-page', null]);
    await ask(PUT, ['doc_m0068_api', 'api', 'https://publications.europa.eu/resource/x', null]);
    await ask(PUT, ['doc_m0068_kept', 'url', SDN, 'gfw']);

    await ask(await readFile(MIGRATION, 'utf8'));

    return z
      .array(z.object({ id: z.string(), provider_id: z.string().nullable() }))
      .parse(
        await ask(
          `SELECT id, provider_id FROM public.documents WHERE id LIKE 'doc_m0068_%' ORDER BY id`,
        ),
      );
  });
  expect(held).toStrictEqual([
    { id: 'doc_m0068_act', provider_id: 'eu_eurlex' },
    { id: 'doc_m0068_api', provider_id: null },
    { id: 'doc_m0068_kept', provider_id: 'gfw' },
    { id: 'doc_m0068_page', provider_id: null },
    { id: 'doc_m0068_sdn', provider_id: 'ofac_sdn' },
  ]);
});
