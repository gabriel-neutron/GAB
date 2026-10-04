// Each tool runs against the disposable database as gabriel_research, the role with the narrowest
// grants. Each gesture runs inside a transaction that rolls back, so the corpus stays as it was.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { callTool, type Session, type Tool } from './tool.ts';

const SHA = 'f'.repeat(64);
const DOC = `doc_${SHA.slice(0, 12)}`;
const ABSENT = '00000000-0000-4000-8000-000000000000';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const call = async (ask: Ask, name: string, raw: unknown) =>
  callTool(toolNamed(name), sessionOf(ask), raw);

const output = async (ask: Ask, name: string, raw: unknown): Promise<unknown> => {
  const outcome = await call(ask, name, raw);
  if (!outcome.ok) throw new Error(`${name} refused: ${outcome.refusal}`);
  return outcome.output;
};

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

// The research role stores the document and its text through its own doors.
const withDocument = async (ask: Ask, pages: readonly string[]): Promise<void> => {
  await ask(STORE, [
    'url',
    'A report of the tool test',
    `raw/${SHA}`,
    'https://example.org/report',
    SHA,
    'application/pdf',
    '2026-09-02',
    null,
  ]);
  await ask(WRITE_TEXT, [DOC, JSON.stringify(pages), 'tool-test-1']);
};

const entityRow = z.object({ id: z.uuid(), label: z.string() });

const connected = async (ask: Ask) => {
  const [row] = z.array(entityRow).parse(
    await ask(`SELECT e.id::text AS id, e.label FROM api.entity e
        JOIN api.relation r ON r.src_kind = 'entity' AND r.dst_kind = 'entity' AND r.src_id = e.id
        ORDER BY e.id LIMIT 1`),
  );
  if (row === undefined) throw new Error('the fixture holds no relation between two entities');
  return row;
};

const hits = z.object({
  entities: z.array(z.object({ id: z.uuid(), label: z.string(), type: z.string() })),
});

// ---------------------------------------------------------- search_graph ---

test('search_graph finds an entity by a part of its name', async () => {
  const found = await rolledBack('research', async (ask) => {
    const held = await connected(ask);
    return {
      held,
      result: hits.parse(await output(ask, 'search_graph', { query: held.label.slice(1, 4) })),
    };
  });
  expect(found.result.entities.map((entity) => entity.id)).toContain(found.held.id);
});

test('search_graph narrows by type, and a wrong type finds nothing', async () => {
  const found = await rolledBack('research', async (ask) => {
    const held = await connected(ask);
    return hits.parse(
      await output(ask, 'search_graph', { query: held.label, type: 'no_such_type' }),
    );
  });
  expect(found.entities).toStrictEqual([]);
});

test('search_graph reads a percent sign as a letter and not as a wildcard', async () => {
  const found = await rolledBack('research', async (ask) =>
    hits.parse(await output(ask, 'search_graph', { query: '%' })),
  );
  expect(found.entities).toStrictEqual([]);
});

test('search_graph holds the list to the limit', async () => {
  const found = await rolledBack('research', async (ask) =>
    hits.parse(await output(ask, 'search_graph', { query: 'a', limit: 2 })),
  );
  expect(found.entities.length).toBeLessThanOrEqual(2);
});

// --------------------------------------------------------- neighbourhood ---

const walk = z.object({
  entities: z.array(
    z.object({ id: z.uuid(), label: z.string(), type: z.string(), hop: z.number() }),
  ),
});

test('neighbourhood returns the root at hop zero and a neighbour at hop one', async () => {
  const found = await rolledBack('research', async (ask) => {
    const held = await connected(ask);
    return {
      held,
      result: walk.parse(await output(ask, 'neighbourhood', { root: held.id, depth: 1 })),
    };
  });
  const hops = found.result.entities.map((entity) => entity.hop);
  expect(found.result.entities.find((entity) => entity.hop === 0)?.id).toBe(found.held.id);
  expect(Math.max(...hops)).toBe(1);
});

test('neighbourhood of an identifier that no entity holds is empty', async () => {
  const found = await rolledBack('research', async (ask) =>
    walk.parse(await output(ask, 'neighbourhood', { root: ABSENT })),
  );
  expect(found.entities).toStrictEqual([]);
});

// --------------------------------------------------------- document_text ---

const text = z.object({
  document: z.string(),
  extractor: z.string().nullable(),
  pages: z.array(z.object({ page: z.number(), text: z.string() })),
  lastPage: z.number().nullable(),
  truncated: z.boolean(),
});

test('document_text returns the pages of the range and the last page of the set', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one', 'page two', 'page three']);
    return text.parse(
      await output(ask, 'document_text', { document: DOC, fromPage: 2, toPage: 3 }),
    );
  });
  expect(found).toStrictEqual({
    document: DOC,
    extractor: 'tool-test-1',
    pages: [
      { page: 2, text: 'page two' },
      { page: 3, text: 'page three' },
    ],
    lastPage: 3,
    truncated: false,
  });
});

test('document_text without a range starts at page one', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one', 'page two']);
    return text.parse(await output(ask, 'document_text', { document: DOC }));
  });
  expect(found.pages.map((page) => page.page)).toStrictEqual([1, 2]);
});

test('document_text cuts a long page at the size cap and says so', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['x'.repeat(60_000), 'second']);
    return text.parse(await output(ask, 'document_text', { document: DOC }));
  });
  expect(found.truncated).toBe(true);
  expect(found.pages.reduce((sum, page) => sum + page.text.length, 0)).toBeLessThanOrEqual(40_000);
});

test('document_text of a document with no text is empty', async () => {
  const found = await rolledBack('research', async (ask) =>
    text.parse(await output(ask, 'document_text', { document: 'doc_absent' })),
  );
  expect(found).toStrictEqual({
    document: 'doc_absent',
    extractor: null,
    pages: [],
    lastPage: null,
    truncated: false,
  });
});

test('document_text refuses a range above the cap', async () => {
  const outcome = await rolledBack('research', (ask) =>
    call(ask, 'document_text', { document: DOC, fromPage: 1, toPage: 11 }),
  );
  expect(outcome.ok).toBe(false);
});

// --------------------------------------------------------- lookup_entity ---

const KEYED = `SELECT e.id::text AS id, k.key, e.attrs -> k.key -> 'v' #>> '{}' AS value
  FROM api.entity e CROSS JOIN LATERAL jsonb_object_keys(e.attrs) AS k(key)
  WHERE jsonb_typeof(e.attrs -> k.key -> 'v') = 'string'
  ORDER BY e.id, k.key LIMIT 1`;

const keyed = z.array(z.object({ id: z.uuid(), key: z.string(), value: z.string() }));

test('lookup_entity finds the entity that holds an identifier value', async () => {
  const found = await rolledBack('research', async (ask) => {
    const [held] = keyed.parse(await ask(KEYED));
    if (held === undefined) throw new Error('the fixture holds no string attribute');
    return {
      held,
      result: hits.parse(await output(ask, 'lookup_entity', { key: held.key, value: held.value })),
    };
  });
  expect(found.result.entities.map((entity) => entity.id)).toContain(found.held.id);
});

test('lookup_entity finds nothing for a value that no entity holds', async () => {
  const found = await rolledBack('research', async (ask) =>
    hits.parse(await output(ask, 'lookup_entity', { key: 'imo', value: 'no such value' })),
  );
  expect(found.entities).toStrictEqual([]);
});

// -------------------------------------------------------- propose_change ---

const proposed = z.object({ proposalId: z.uuid(), op: z.string() });

const CREATE = {
  op: 'create_entity',
  type: 'vessel',
  label: 'Nayara',
  attrs: { imo: { v: '9123456' } },
};

const STORED = `SELECT author_role, status, src::text[] AS src, payload
  FROM public.proposals WHERE id = $1`;

const stored = z.array(
  z.object({
    author_role: z.string(),
    status: z.string(),
    src: z.array(z.string()),
    payload: z.record(z.string(), z.unknown()),
  }),
);

test('propose_change stores a proposal under the name of the role and the cited document', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const made = proposed.parse(
      await output(ask, 'propose_change', { act: CREATE, documents: [DOC] }),
    );
    return { made, rows: stored.parse(await ask(STORED, [made.proposalId])) };
  });
  expect(found.made.op).toBe('create_entity');
  expect(found.rows).toHaveLength(1);
  expect(found.rows[0]).toMatchObject({
    author_role: 'gabriel_research',
    status: 'pending',
    src: [DOC],
  });
  expect(found.rows[0]?.payload['attrs']).toStrictEqual({ imo: { v: '9123456', src: [DOC] } });
});

test('propose_change proposes a relation between two entities that exist', async () => {
  const made = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const held = await connected(ask);
    const [other] = z
      .array(z.object({ id: z.uuid() }))
      .parse(await ask('SELECT id::text AS id FROM api.entity WHERE id <> $1 LIMIT 1', [held.id]));
    return proposed.parse(
      await output(ask, 'propose_change', {
        act: { op: 'create_relation', type: 'owns', srcId: held.id, dstId: other?.id },
        documents: [DOC],
      }),
    );
  });
  expect(made.op).toBe('create_relation');
});

test('propose_change refuses a relation whose end does not exist', async () => {
  const outcome = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const held = await connected(ask);
    return call(ask, 'propose_change', {
      act: { op: 'create_relation', type: 'owns', srcId: held.id, dstId: ABSENT },
      documents: [DOC],
    });
  });
  expect(outcome).toMatchObject({ ok: false, refusal: expect.stringContaining(ABSENT) as string });
});

test('propose_change updates attributes and keeps the documents the value already held', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const [held] = keyed.parse(await ask(KEYED));
    if (held === undefined) throw new Error('the fixture holds no string attribute');
    const made = proposed.parse(
      await output(ask, 'propose_change', {
        act: {
          op: 'update_attrs',
          targetKind: 'entity',
          targetId: held.id,
          attrs: { [held.key]: { v: held.value } },
        },
        documents: [DOC],
      }),
    );
    return stored.parse(await ask(STORED, [made.proposalId]));
  });
  expect(found[0]?.src).toContain(DOC);
  expect(found[0]?.src).not.toContain('manual');
});

test('propose_change refuses an update of a target that does not exist', async () => {
  const outcome = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    return call(ask, 'propose_change', {
      act: { op: 'update_attrs', targetKind: 'entity', targetId: ABSENT, attrs: { a: { v: 'b' } } },
      documents: [DOC],
    });
  });
  expect(outcome.ok).toBe(false);
});

test('propose_change refuses a payload that the proposal package refuses', async () => {
  const outcome = await rolledBack('research', (ask) =>
    call(ask, 'propose_change', {
      act: { op: 'create_entity', type: '', label: 'Nayara' },
      documents: [DOC],
    }),
  );
  expect(outcome.ok).toBe(false);
});

test('propose_change of a document that is not stored is a fault of the database', async () => {
  await expect(
    rolledBack('research', (ask) => call(ask, 'propose_change', { act: CREATE, documents: [DOC] })),
  ).rejects.toMatchObject({ code: expect.any(String) as string });
});

// --------------------------------------------------------- proposal_read ---

const read = z.object({
  id: z.uuid(),
  op: z.string(),
  status: z.string(),
  payload: z.record(z.string(), z.unknown()),
  src: z.array(z.string()),
  authorRole: z.string(),
});

test('proposal_read returns the proposal with its payload and its sources', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const made = proposed.parse(
      await output(ask, 'propose_change', { act: CREATE, documents: [DOC] }),
    );
    return {
      made,
      read: read.parse(await output(ask, 'proposal_read', { proposal: made.proposalId })),
    };
  });
  expect(found.read).toMatchObject({
    id: found.made.proposalId,
    op: 'create_entity',
    status: 'pending',
    src: [DOC],
    authorRole: 'gabriel_research',
  });
  expect(found.read.payload['label']).toBe('Nayara');
});

test('proposal_read refuses an identifier that names no proposal', async () => {
  const outcome = await rolledBack('research', (ask) =>
    call(ask, 'proposal_read', { proposal: ABSENT }),
  );
  expect(outcome).toMatchObject({ ok: false, refusal: expect.stringContaining(ABSENT) as string });
});

// ------------------------------------------------------- enqueue_extract ---

const queued = z.object({ jobId: z.uuid() });

const JOBS = z.object({
  document: z.string(),
  jobs: z.array(
    z.object({
      id: z.uuid(),
      status: z.string(),
      attempts: z.number(),
      failureReason: z.string().nullable(),
      finishedAt: z.string().nullable(),
    }),
  ),
});

test('enqueue_extract queues one job, and job_status reports it with the stored row', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const job = queued.parse(await output(ask, 'enqueue_extract', { document: DOC }));
    return { job, status: JOBS.parse(await output(ask, 'job_status', { document: DOC })) };
  });
  expect(found.status.document).toBe(DOC);
  const waiting = found.status.jobs.find((job) => job.id === found.job.jobId);
  expect(waiting).toMatchObject({
    status: 'queued',
    attempts: 0,
    failureReason: null,
    finishedAt: null,
  });
  expect(found.status.jobs.map((job) => job.status).sort()).toStrictEqual(['done', 'queued']);
});

test('enqueue_extract of a second open job for one document is a fault of the database', async () => {
  await expect(
    rolledBack('research', async (ask) => {
      await withDocument(ask, ['page one']);
      await output(ask, 'enqueue_extract', { document: DOC });
      return call(ask, 'enqueue_extract', { document: DOC });
    }),
  ).rejects.toMatchObject({ code: '23505' });
});

test('enqueue_extract of a document that does not exist is a fault of the database', async () => {
  await expect(
    rolledBack('research', (ask) => call(ask, 'enqueue_extract', { document: 'doc_absent' })),
  ).rejects.toMatchObject({ code: '23503' });
});

test('job_status of a document with no job is an empty list', async () => {
  const found = await rolledBack('research', async (ask) =>
    JOBS.parse(await output(ask, 'job_status', { document: 'doc_absent' })),
  );
  expect(found.jobs).toStrictEqual([]);
});
