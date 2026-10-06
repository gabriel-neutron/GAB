// Migration 0043 fails each open job of the second reader, with its reason. The case runs the file
// inside a transaction that always rolls back.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from './probe.ts';

const MIGRATION = join(import.meta.dirname, '..', 'db', 'migrations', '0043_second_read_ends.sql');

const QUEUED = 'doc_migration_0043_queued';
const RUNNING = 'doc_migration_0043_running';

const PUT = `SELECT public.put_document($1, 'file', 'A test of migration 0043', $2, NULL, NULL,
  NULL, 'application/pdf', '2026-10-06'::date)`;

const jobs = z.array(
  z.object({
    document_id: z.string(),
    kind: z.string(),
    status: z.string(),
    failure_reason: z.string().nullable(),
  }),
);

test('each open job of the second reader fails with its reason, and no other job changes', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    for (const document of [QUEUED, RUNNING]) await ask(PUT, [document, `raw/${document}.pdf`]);
    await ask(`INSERT INTO public.jobs (document_id, kind) VALUES ($1, 'second_read')`, [QUEUED]);
    await ask(
      `INSERT INTO public.jobs (document_id, kind, status, claimed_by, claimed_at)
       VALUES ($1, 'second_read', 'running', 'gabriel_agent', now())`,
      [RUNNING],
    );
    await ask("SELECT public.enqueue_job($1, 'extract_text')", [QUEUED]);

    await ask(await readFile(MIGRATION, 'utf8'));

    return jobs.parse(
      await ask(
        `SELECT document_id, kind, status, failure_reason FROM public.jobs
          WHERE document_id = ANY($1::text[]) AND kind <> 'store_only'
          ORDER BY document_id, kind`,
        [[QUEUED, RUNNING]],
      ),
    );
  });

  const reason = 'the second reader is gone, and a check by another model replaces it';
  expect(held).toStrictEqual([
    { document_id: QUEUED, kind: 'extract_text', status: 'queued', failure_reason: null },
    { document_id: QUEUED, kind: 'second_read', status: 'failed', failure_reason: reason },
    { document_id: RUNNING, kind: 'second_read', status: 'failed', failure_reason: reason },
  ]);
});
