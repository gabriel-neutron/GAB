// The originator load runs through the doors of gabriel_app, inside a transaction that rolls back.
// The test reads the private tables as the superuser, so each door call switches the session user
// for the length of that one call. Every row of the fixture is invented, and no file of the private
// data repository is read.

import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, expect, test } from 'vitest';
import { z } from 'zod';

import { loadOriginators, type OriginatorStore } from './load-originators.ts';
import { rolledBack, type Ask } from './probe.ts';

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

const source = (id: string, fields: Record<string, string> = {}): Record<string, string> => ({
  id,
  title: `Invented title of ${id}`,
  url: '',
  admiralty: 'A',
  date_consultation: '',
  ...fields,
});

const entry = (id: string, canonical: string, fields: Record<string, string> = {}) => ({
  id,
  canonical_id: canonical,
  kind: 'organisation',
  path: '',
  match_reason: '',
  ...fields,
});

const folders: string[] = [];
afterEach(async () => {
  await Promise.all(folders.splice(0).map((one) => rm(one, { recursive: true, force: true })));
});

// The store of the test writes the document row through the operator door and no object, so the
// transaction of the test stays the only one.
const storeIn =
  (ask: Ask, seen: string[] = []): OriginatorStore =>
  async (file) => {
    seen.push(file.title);
    const sha256 = createHash('sha256').update(file.bytes).digest('hex');
    const id = `doc_${sha256.slice(0, 12)}`;
    await asOperator(ask)(
      'SELECT public.put_document($1, $2, $3, $4, $5, NULL, $6, $7, $8::date)',
      [
        id,
        file.kind,
        file.title,
        `raw/${sha256}`,
        file.uri,
        sha256,
        'text/plain',
        file.retrievedAt,
      ],
    );
    return { status: 'stored', id, sha256, pageCount: 1, emptyPages: [] };
  };

const none: OriginatorStore = () => Promise.reject(new Error('this run holds no bytes'));

const inventedOriginator = z.object({
  id: z.string(),
  letter: z.string(),
  letter_origin: z.string(),
  operator_letter: z.string().nullable(),
  operator_letter_reason: z.string().nullable(),
  party: z.string(),
  jurisdiction: z.string().nullable(),
  contested: z.boolean(),
  kind: z.string(),
});

const originatorsOf = async (ask: Ask, ids: readonly string[]) =>
  z.array(inventedOriginator).parse(
    await ask(
      `SELECT id, letter, letter_origin, operator_letter, operator_letter_reason, party,
              jurisdiction, contested, kind
         FROM public.originator WHERE id = ANY($1::text[]) ORDER BY id`,
      [ids],
    ),
  );

const count = async (ask: Ask, table: string): Promise<number> =>
  z
    .array(z.object({ n: z.number() }))
    .parse(await ask(`SELECT count(*)::int AS n FROM public.${table}`))[0]?.n ?? -1;

const statuses = (report: { readonly rows: readonly { id: string; status: string }[] }) =>
  Object.fromEntries(report.rows.map((row) => [row.id, row.status]));

const FIVE = {
  sources: [
    source('S1', { url: 'https://invented-one.example/a', admiralty: 'A' }),
    source('S2', { admiralty: 'B' }),
    source('S3', { admiralty: 'Z' }),
    source('S4', { admiralty: 'A' }),
    source('S5', { admiralty: 'B' }),
  ],
  map: [
    entry('S1', 'host:invented-one.example'),
    entry('S2', 'host:invented-two.example'),
    entry('S3', 'host:invented-three.example'),
    entry('S4', 'host:invented-four.example'),
    entry('S5', 'host:invented-four.example'),
  ],
};

test('the valid rows give originators and documents, a bad letter is refused and a conflict is reported', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    const before = { documents: await count(ask, 'documents') };
    const report = await loadOriginators(
      { ...FIVE, dataFolder: null },
      { ask: asOperator(ask), store: none },
    );
    const originators = await originatorsOf(ask, [
      'host:invented-one.example',
      'host:invented-two.example',
      'host:invented-three.example',
      'host:invented-four.example',
    ]);
    const documents = z
      .array(
        z.object({
          id: z.string(),
          kind: z.string(),
          sha256: z.string().nullable(),
          admiralty: z.string().nullable(),
          retrieved_at: z.string().nullable(),
        }),
      )
      .parse(
        await ask(
          `SELECT id, kind, sha256, admiralty, retrieved_at::text FROM public.documents
            WHERE title LIKE 'Invented title of S%' ORDER BY title`,
        ),
      );
    return { report, originators, documents, before };
  });

  expect(statuses(held.report)).toStrictEqual({
    S1: 'loaded',
    S2: 'loaded',
    S3: 'refused',
    S4: 'refused',
    S5: 'refused',
  });
  expect(held.originators.map((row) => [row.id, row.letter, row.letter_origin])).toStrictEqual([
    ['host:invented-one.example', 'A', 'operator'],
    ['host:invented-two.example', 'B', 'operator'],
  ]);
  for (const row of held.originators) {
    expect(row.operator_letter).toBe(row.letter);
    expect(row.operator_letter_reason).not.toBeNull();
    expect(row.party).toBe('unknown');
  }
  expect(held.documents).toHaveLength(2);
  for (const document of held.documents) {
    expect(document.kind).toBe('url');
    expect(document.sha256).toBeNull();
    expect(document.admiralty).toBeNull();
    expect(document.retrieved_at).toBeNull();
  }
  expect(held.documents.map((row) => row.id)).toStrictEqual(
    held.report.rows.filter((row) => row.status === 'loaded').map((row) => row.documentId),
  );
  expect(held.report.licence).toContain('licence_rediffusion');
});

test('a rerun writes nothing', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    const door = { ask: asOperator(ask), store: none };
    await loadOriginators({ ...FIVE, dataFolder: null }, door);
    const before = {
      history: await count(ask, 'originator_letter_history'),
      originators: await count(ask, 'originator'),
      documents: await count(ask, 'documents'),
      jobs: await count(ask, 'jobs'),
    };
    const again = await loadOriginators({ ...FIVE, dataFolder: null }, door);
    const after = {
      history: await count(ask, 'originator_letter_history'),
      originators: await count(ask, 'originator'),
      documents: await count(ask, 'documents'),
      jobs: await count(ask, 'jobs'),
    };
    return { before, after, again: statuses(again) };
  });
  expect(held.after).toStrictEqual(held.before);
  expect(held.again).toMatchObject({ S1: 'unchanged', S2: 'unchanged' });
});

test('a state body keeps no jurisdiction and no role, so its party stays unknown', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    const report = await loadOriginators(
      {
        sources: [source('S1', { url: 'https://stat.gov.invented/table' })],
        map: [entry('S1', 'host:stat.gov.invented', { kind: 'state_body' })],
        dataFolder: null,
      },
      { ask: asOperator(ask), store: none },
    );
    return { report, rows: await originatorsOf(ask, ['host:stat.gov.invented']) };
  });
  expect(statuses(held.report)).toStrictEqual({ S1: 'loaded' });
  expect(held.rows).toHaveLength(1);
  expect(held.rows[0]).toMatchObject({ kind: 'state_body', party: 'unknown', jurisdiction: null });
});

test('a stored operator letter that differs is refused, and the door is not called', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    const operator = asOperator(ask);
    await operator('SELECT public.ensure_originator($1, $2, $3)', [
      'host:invented-held.example',
      'Invented held',
      'organisation',
    ]);
    await operator('SELECT public.set_operator_letter($1, $2, $3)', [
      'host:invented-held.example',
      'B',
      'the operator read the outlet',
    ]);
    await operator('SELECT public.contest_letter($1, $2)', [
      'host:invented-held.example',
      'a doubt that stays',
    ]);
    const stamp = () =>
      ask(
        `SELECT last_operator_act_at::text AS at FROM public.originator
          WHERE id = 'host:invented-held.example'`,
      );
    const before = await stamp();
    const report = await loadOriginators(
      {
        sources: [source('S1', { admiralty: 'A', title: 'Invented title of S1' })],
        map: [entry('S1', 'host:invented-held.example')],
        dataFolder: null,
      },
      { ask: operator, store: none },
    );
    return {
      report,
      rows: await originatorsOf(ask, ['host:invented-held.example']),
      same: JSON.stringify(before) === JSON.stringify(await stamp()),
      documents: await count(ask, 'documents'),
    };
  });
  expect(held.report.rows[0]?.status).toBe('refused');
  expect(held.report.rows[0]?.detail).toContain('stored letter differs');
  expect(held.rows[0]).toMatchObject({
    operator_letter: 'B',
    operator_letter_reason: 'the operator read the outlet',
    contested: true,
  });
  expect(held.same).toBe(true);
});

test('time alone does not change an operator letter, and no column of the row holds an expiry', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    await loadOriginators(
      {
        sources: [source('S1')],
        map: [entry('S1', 'host:invented-aging.example')],
        dataFolder: null,
      },
      { ask: asOperator(ask), store: none },
    );
    const letters = [];
    for (const year of [2027, 2036, 2056]) {
      letters.push(
        await ask(
          "SELECT public.refresh_originator('host:invented-aging.example', $1::timestamptz) AS letter",
          [`${year}-06-01T00:00:00Z`],
        ),
      );
    }
    const columns = z.array(z.object({ column_name: z.string() })).parse(
      await ask(
        `SELECT column_name FROM information_schema.columns
            WHERE table_name = 'originator' AND table_schema = 'public'`,
      ),
    );
    return { letters, columns: columns.map((row) => row.column_name) };
  });
  for (const letter of held.letters) expect(letter).toStrictEqual([{ letter: 'A' }]);
  expect(held.columns.filter((name) => /expir|until|valid_to/.test(name))).toStrictEqual([]);
});

test('a row with bytes goes to the store with its own reading date, and a missing date refuses the document only', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'gab-originators-'));
  folders.push(folder);
  await writeFile(join(folder, 'one.txt'), 'invented bytes of the first file');
  await writeFile(join(folder, 'two.txt'), 'invented bytes of the second file');

  const seen: string[] = [];
  const held = await rolledBack('superuser', async (ask) => {
    const report = await loadOriginators(
      {
        sources: [
          source('S1', {
            url: 'https://invented-bytes.example/one',
            date_consultation: '2026-03-04',
          }),
          source('S2', { url: 'https://invented-bytes.example/two', date_consultation: '' }),
        ],
        map: [
          entry('S1', 'host:invented-bytes.example', { path: 'one.txt' }),
          entry('S2', 'host:invented-bytes.example', { path: 'two.txt' }),
        ],
        dataFolder: folder,
      },
      { ask: asOperator(ask), store: storeIn(ask, seen) },
    );
    const documents = z
      .array(z.object({ retrieved_at: z.string(), admiralty: z.string().nullable() }))
      .parse(
        await ask(
          `SELECT retrieved_at::text, admiralty FROM public.documents WHERE title = 'Invented title of S1'`,
        ),
      );
    return {
      report,
      documents,
      originators: await originatorsOf(ask, ['host:invented-bytes.example']),
    };
  });
  expect(seen).toStrictEqual(['Invented title of S1']);
  expect(held.documents).toStrictEqual([{ retrieved_at: '2026-03-04', admiralty: null }]);
  expect(held.originators).toHaveLength(1);
  const second = held.report.rows.find((row) => row.id === 'S2');
  expect(second?.documentId).toBeUndefined();
  expect(second?.detail).toContain('reading date');
  expect(held.report.rows.find((row) => row.id === 'S1')?.documentId).toMatch(/^doc_[0-9a-f]{12}$/);
});
