// The research role stores a fetched document through one narrow door, and its proposals are
// stamped with its own name. Each gesture below runs inside a transaction that rolls back.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const SHA = 'd'.repeat(64);
const OTHER_SHA = 'e'.repeat(64);
const ID = `doc_${SHA.slice(0, 12)}`;

const PUT = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';

interface Fetched {
  readonly kind: string | null;
  readonly title: string | null;
  readonly key: string | null;
  readonly uri: string | null;
  readonly sha: string | null;
  readonly mime: string | null;
  readonly at: string | null;
  readonly archive: string | null;
}

const WHOLE: Fetched = {
  kind: 'url',
  title: 'A statement of reasons',
  key: `raw/${SHA}`,
  uri: 'https://example.org/statement',
  sha: SHA,
  mime: 'application/pdf',
  at: '2026-09-02',
  archive: null,
};

const ids = z.array(z.object({ id: z.string() }));

const fetchedBy = async (ask: Ask, held: Partial<Fetched> = {}): Promise<string> => {
  const w = { ...WHOLE, ...held };
  const [row] = ids.parse(
    await ask(PUT, [w.kind, w.title, w.key, w.uri, w.sha, w.mime, w.at, w.archive]),
  );
  if (row === undefined) throw new Error('no row came back');
  return row.id;
};

for (const identity of ['research', 'agent'] as const)
  test(`gabriel_${identity} stores a fetched document under the id of its hash`, async () => {
    const found = await rolledBack(identity, async (ask) => {
      const id = await fetchedBy(ask);
      const row = await ask(
        'SELECT kind, uri, sha256, retrieved_at::text AS at FROM public.documents WHERE id = $1',
        [id],
      );
      return { id, row };
    });
    expect(found.id).toBe(ID);
    expect(found.row).toStrictEqual([
      { kind: 'url', uri: WHOLE.uri, sha256: SHA, at: '2026-09-02' },
    ]);
  });

test('an api document is accepted', async () => {
  const id = await rolledBack('research', (ask) => fetchedBy(ask, { kind: 'api' }));
  expect(id).toBe(ID);
});

// gabriel_research holds no grant on jobs, so the agent reads the row that the door wrote.
test('the door writes one store_only job that is already done', async () => {
  const jobs = await rolledBack('agent', async (ask) => {
    const id = await fetchedBy(ask);
    return ask('SELECT kind, status FROM public.jobs WHERE document_id = $1', [id]);
  });
  expect(jobs).toStrictEqual([{ kind: 'store_only', status: 'done' }]);
});

for (const kind of ['file', 'report', 'manual', 'other'])
  test(`a document of the kind ${kind} is refused`, async () => {
    await expect(rolledBack('research', (ask) => fetchedBy(ask, { kind }))).rejects.toMatchObject({
      code: '22023',
    });
  });

const MISSING: readonly (readonly [string, Partial<Fetched>])[] = [
  ['the hash', { sha: null }],
  ['the address', { uri: null }],
  ['the date', { at: null }],
  ['the object key', { key: null }],
  ['the title', { title: null }],
  ['the kind', { kind: null }],
  ['a blank address', { uri: '  ' }],
  ['a blank title', { title: ' \t' }],
  ['a blank object key', { key: '' }],
];

for (const [name, held] of MISSING)
  test(`a document with no ${name} is refused`, async () => {
    await expect(rolledBack('research', (ask) => fetchedBy(ask, held))).rejects.toMatchObject({
      code: '22023',
    });
  });

test('a second row for the same hash is refused, whatever the address', async () => {
  await expect(
    rolledBack('research', async (ask) => {
      await fetchedBy(ask);
      return fetchedBy(ask, { uri: 'https://example.org/another' });
    }),
  ).rejects.toMatchObject({ code: '23505', message: expect.stringContaining(SHA) as string });
});

test('a second hash is a second document', async () => {
  const second = await rolledBack('research', async (ask) => {
    await fetchedBy(ask);
    return fetchedBy(ask, { sha: OTHER_SHA, key: `raw/${OTHER_SHA}` });
  });
  expect(second).toBe(`doc_${OTHER_SHA.slice(0, 12)}`);
});

// A machine proposes a batch, and each act cites a page of the stored text.
const PROPOSE = 'SELECT proposal_id AS id FROM public.propose_batch($1::jsonb)';
const TEXT = `SELECT public.put_document_text($1, '["A research test"]'::jsonb, 'text-1')`;

const batchOf = (src: readonly string[]): string =>
  JSON.stringify([
    {
      id: randomUUID(),
      op: 'create_entity',
      payload: { type: 'vessel', label: 'A research test' },
      src,
      names: [],
      originator: 'A research test',
      modality: 'asserts',
      citations: [{ document: src[0], text_extractor: 'text-1', page: 1, start: 0, end: 4 }],
    },
  ]);

const proposed = z.array(
  z.object({ author_role: z.string(), model_call_id: z.string().nullable() }),
);

test('a proposal of gabriel_research is stamped with its own name and no model call', async () => {
  const stored = await rolledBack('research', async (ask) => {
    const id = await fetchedBy(ask);
    await ask(TEXT, [id]);
    const [made] = ids.parse(await ask(PROPOSE, [batchOf([id])]));
    return proposed.parse(
      await ask('SELECT author_role, model_call_id FROM public.proposals WHERE id = $1', [
        made?.id,
      ]),
    );
  });
  expect(stored).toStrictEqual([{ author_role: 'gabriel_research', model_call_id: null }]);
});

for (const document of ['manual', 'inherited'])
  test(`a proposal of gabriel_research that cites ${document} is refused`, async () => {
    await expect(
      rolledBack('research', async (ask) => {
        const id = await fetchedBy(ask);
        await ask(TEXT, [id]);
        return ask(PROPOSE, [batchOf([id, document])]);
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('proposals_machine_not_reserved') as string,
    });
  });

test('gabriel_research enqueues work for a fetched document and stores its text', async () => {
  const found = await rolledBack('research', async (ask) => {
    const id = await fetchedBy(ask);
    await ask("SELECT public.enqueue_job($1, 'extract_text')", [id]);
    return ask(`SELECT public.put_document_text($1, '["one page"]'::jsonb, 'text-1') AS n`, [id]);
  });
  expect(found).toStrictEqual([{ n: 1 }]);
});

test('gabriel_research cannot store a document of any kind through put_document', async () => {
  await expect(
    rolledBack('research', (ask) =>
      ask(
        "SELECT public.put_document('doc_a1b2c3', 'url', 'A title', NULL, 'https://example.org')",
      ),
    ),
  ).rejects.toMatchObject({ code: '42501' });
});

test('gabriel_research cannot promote a proposal', async () => {
  await expect(
    rolledBack('research', (ask) =>
      ask("SELECT public.promote_proposal(gen_random_uuid(), 'a research test')"),
    ),
  ).rejects.toMatchObject({ code: '42501' });
});

test('gabriel_research carries a thirty second statement timeout', async () => {
  const held = await rolledBack('research', (ask) => ask('SHOW statement_timeout'));
  expect(held).toStrictEqual([{ statement_timeout: '30s' }]);
});
