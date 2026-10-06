// The claims load runs through the doors of gabriel_app, inside a transaction that rolls back. The
// test reads the tables as the superuser, so each door call switches the session user for the
// length of that one call. Every file of the fixture is invented, and no file of the private data
// repository is read.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseClaims } from '@gab/worker/report-claims';
import type { StoredFile, StoreResult } from '@gab/worker/ingest';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { rowsOfCsv } from './csv.ts';
import { loadClaims, planClaims, type ClaimDoor } from './load-claims.ts';
import { rolledBack as rolledBackOnce, type Ask } from './probe.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures/claims');
const DAY = '2026-10-05';

// Other test files commit rows into the shared tables while this file runs, so a count read twice
// in one transaction can differ without a write of the load. One snapshot gives each count the
// same view, and the rows that the load itself writes stay visible to it.
const rolledBack = <T>(identity: 'superuser', work: (ask: Ask) => Promise<T>): Promise<T> =>
  rolledBackOnce(identity, async (ask) => {
    await ask('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    return work(ask);
  });

const asOperator =
  (ask: Ask): Ask =>
  async (text, values) => {
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await ask('SAVEPOINT one_door');
    try {
      return await ask(text, values);
    } catch (error) {
      await ask('ROLLBACK TO SAVEPOINT one_door');
      throw error;
    } finally {
      await ask('RESET SESSION AUTHORIZATION');
    }
  };

const held = z.array(z.object({ id: z.string() }));

// The store of the test writes the document row through the operator door and no object, so the
// transaction of the test stays the only one. It answers known for bytes it holds, as the real
// door does.
const storeIn =
  (ask: Ask) =>
  async (file: StoredFile): Promise<StoreResult> => {
    const sha256 = createHash('sha256').update(file.bytes).digest('hex');
    const [known] = held.parse(
      await asOperator(ask)('SELECT id FROM public.documents WHERE sha256 = $1', [sha256]),
    );
    if (known !== undefined) return { status: 'known', id: known.id, sha256 };
    const id = `doc_${sha256.slice(0, 12)}`;
    await asOperator(ask)(
      'SELECT public.put_document($1, $2, $3, $4, NULL, NULL, $5, $6, $7::date)',
      [id, file.kind, file.title, `raw/${sha256}`, sha256, 'text/markdown', file.retrievedAt],
    );
    return { status: 'stored', id, sha256, pageCount: 1, emptyPages: [] };
  };

const doorOf = (ask: Ask): ClaimDoor => ({ ask: asOperator(ask), store: storeIn(ask) });

const fixturePlan = async (alpha?: string) => {
  const alphaText = alpha ?? (await readFile(join(FIXTURES, 'alpha-final.md'), 'utf8'));
  const betaText = await readFile(join(FIXTURES, 'beta-final.md'), 'utf8');
  const map = rowsOfCsv(await readFile(join(FIXTURES, 'sources-map.csv'), 'utf8'));
  return planClaims(
    [...parseClaims(alphaText, 'alpha-final.md'), ...parseClaims(betaText, 'beta-final.md')],
    map,
  );
};

const count = async (ask: Ask, table: string): Promise<number> =>
  z
    .array(z.object({ n: z.number() }))
    .parse(await ask(`SELECT count(*)::int AS n FROM public.${table}`))[0]?.n ?? -1;

// The tables that the load must never write, counted when they exist.
const untouched = async (ask: Ask): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const table of ['citation', 'proposals', 'claim_eval']) {
    const [present] = z
      .array(z.object({ here: z.boolean() }))
      .parse(await ask('SELECT to_regclass($1) IS NOT NULL AS here', [`public.${table}`]));
    if (present?.here === true) counts[table] = await count(ask, table);
  }
  return counts;
};

const reportDocuments = async (ask: Ask) =>
  z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        admiralty: z.string().nullable(),
        retrieved_at: z.string(),
        jobs: z.number(),
      }),
    )
    .parse(
      await ask(
        `SELECT d.id, d.title, d.admiralty, d.retrieved_at::text,
                (SELECT count(*)::int FROM public.jobs j
                  WHERE j.document_id = d.id AND j.kind = 'extract_text') AS jobs
           FROM public.documents d
          WHERE d.kind = 'report' AND d.title LIKE 'C-%' ORDER BY d.title`,
      ),
    );

const statusOf = (report: Awaited<ReturnType<typeof loadClaims>>) =>
  Object.fromEntries(report.lines.map((line) => [line.claimId, [line.status, ...line.flags]]));

test('the fixture load stores one report document and one job for each kept block', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const before = await untouched(ask);
    const report = await loadClaims(await fixturePlan(), doorOf(ask), DAY);
    return { report, before, after: await untouched(ask), documents: await reportDocuments(ask) };
  });

  expect(statusOf(outcome.report)).toStrictEqual({
    'C-ALPHA-1': ['stored'],
    'C-ALPHA-2': ['stored', 'unmapped'],
    'C-ALPHA-3': ['deleted'],
    'C-ALPHA-4': ['stored'],
    'C-BETA-1': ['stored', 'no source'],
  });
  expect(outcome.report.lines.find((line) => line.claimId === 'C-ALPHA-3')?.detail).toContain(
    'The invented figure repeats C-ALPHA-1.',
  );
  expect(outcome.report.unknownClaims).toStrictEqual(['C-GAMMA-9']);
  expect(outcome.documents.map((row) => row.title)).toStrictEqual([
    'C-ALPHA-1',
    'C-ALPHA-2',
    'C-ALPHA-4',
    'C-BETA-1',
  ]);
  for (const document of outcome.documents) {
    expect(document.admiralty).toBeNull();
    expect(document.retrieved_at).toBe(DAY);
    expect(document.jobs).toBe(1);
  }
  expect(outcome.after).toStrictEqual(outcome.before);
});

test('the stored text names the cited document ids and keeps the ADMIRALTY field', async () => {
  const plan = await fixturePlan();
  const first = plan.claims.find((claim) => claim.block.claimId === 'C-ALPHA-1');
  const outcome = await rolledBack('superuser', async (ask) => {
    const report = await loadClaims(plan, doorOf(ask), DAY);
    return report.lines.find((line) => line.claimId === 'C-ALPHA-1')?.documentId;
  });

  const text = new TextDecoder().decode(first?.bytes);
  expect(text).toContain('Sources: doc_a1a1a1a1a1a1, doc_b2b2b2b2b2b2\n');
  expect(text).toContain('- **ADMIRALTY** : B2\n');
  const sha256 = createHash('sha256')
    .update(first?.bytes ?? new Uint8Array())
    .digest('hex');
  expect(outcome).toBe(`doc_${sha256.slice(0, 12)}`);
});

test('a rerun reports each block as known and writes no document and no job', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const plan = await fixturePlan();
    await loadClaims(plan, doorOf(ask), DAY);
    const before = { documents: await count(ask, 'documents'), jobs: await count(ask, 'jobs') };
    const again = await loadClaims(plan, doorOf(ask), DAY);
    const after = { documents: await count(ask, 'documents'), jobs: await count(ask, 'jobs') };
    return { again, before, after };
  });

  expect(
    outcome.again.lines.filter((line) => line.status !== 'deleted').map((line) => line.status),
  ).toStrictEqual(['known', 'known', 'known', 'known']);
  expect(outcome.after).toStrictEqual(outcome.before);
});

test('a block that changed since the first run is reported as changed and is not stored', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    await loadClaims(await fixturePlan(), doorOf(ask), DAY);
    const original = await readFile(join(FIXTURES, 'alpha-final.md'), 'utf8');
    const edited = original.replace('handled 12 invented units', 'handled 13 invented units');
    const before = { documents: await count(ask, 'documents'), jobs: await count(ask, 'jobs') };
    const again = await loadClaims(await fixturePlan(edited), doorOf(ask), DAY);
    const after = { documents: await count(ask, 'documents'), jobs: await count(ask, 'jobs') };
    return { again, before, after };
  });

  expect(statusOf(outcome.again)['C-ALPHA-1']).toStrictEqual(['changed']);
  expect(outcome.after).toStrictEqual(outcome.before);
});

test('the second of two blocks with one claim id and other bytes is changed in the same run', async () => {
  const plan = planClaims(
    parseClaims('### C-SHAPE-3\n**Énoncé** : one\n\n### C-SHAPE-3\n**Énoncé** : two\n', 'x.md'),
    [],
  );
  const report = await rolledBack('superuser', async (ask) => loadClaims(plan, doorOf(ask), DAY));

  expect(report.lines.map((line) => line.status)).toStrictEqual(['stored', 'changed']);
});

test('a kept block with no Énoncé is stored with one job, and the report names the gap', async () => {
  const plan = planClaims(
    parseClaims('### C-SHAPE-4\n- **Chiffre** : 4\n- **Source** : an invented note\n', 'x.md'),
    [],
  );
  const outcome = await rolledBack('superuser', async (ask) => {
    const report = await loadClaims(plan, doorOf(ask), DAY);
    const documents = (await reportDocuments(ask)).filter((row) => row.title === 'C-SHAPE-4');
    return { report, documents };
  });

  const [line] = outcome.report.lines;
  expect(line?.status).toBe('stored');
  expect(line?.detail).toContain('missing Énoncé');
  expect(outcome.documents).toHaveLength(1);
  expect(outcome.documents[0]?.id).toBe(line?.documentId);
  expect(outcome.documents[0]?.jobs).toBe(1);
});

test('a load with no retrieval day stops before it writes', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const before = await count(ask, 'documents');
    const refusal = await loadClaims(await fixturePlan(), doorOf(ask), '').then(
      () => 'no refusal',
      (error: unknown) => (error instanceof Error ? error.message : 'refused'),
    );
    return { refusal, before, after: await count(ask, 'documents') };
  });

  expect(outcome.refusal).toMatch(/--retrieved-at is required/);
  expect(outcome.after).toBe(outcome.before);
});
