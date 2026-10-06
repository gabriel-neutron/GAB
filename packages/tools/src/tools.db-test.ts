// Each tool runs against the disposable database as gabriel_research, the role with the narrowest
// grants. Each gesture runs inside a transaction that rolls back, so the corpus stays as it was.

import { expect, test } from 'vitest';
import { IDENTIFIER_KEYS } from '@gab/proposal/identifiers';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from '../../../tools/probe.ts';
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

const proposed = z.object({ proposals: z.array(z.object({ proposalId: z.uuid() })).length(1) });

// One item that cites the first page of the test document, as the research role gives it.
const citedOnPageOne = (act: Readonly<Record<string, unknown>>) => ({
  items: [
    {
      ref: 'one',
      act,
      originator: 'The tool test',
      modality: 'asserts',
      evidence: [{ document: DOC, page: 1, excerpt: 'page one' }],
    },
  ],
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

const IMO_HELD = `SELECT id::text AS id, attrs -> 'imo' ->> 'v' AS value
  FROM api.entity WHERE jsonb_typeof(attrs -> 'imo' -> 'v') = 'string'
  ORDER BY id LIMIT 1`;

const imoHeld = z.array(z.object({ id: z.uuid(), value: z.string() }));

test('each entity type of the map of spellings is a live type of the record', async () => {
  const live = await probe('read', async (ask) =>
    z
      .array(z.object({ key: z.string() }))
      .parse(await ask('SELECT key FROM api.entity_type WHERE NOT retired')),
  );
  const keys = live.map((row) => row.key);
  for (const type of Object.keys(IDENTIFIER_KEYS)) expect(keys).toContain(type);
});

test('search_graph finds a hull by its imo, and the next proposal on it is update_attrs', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const [held] = imoHeld.parse(await ask(IMO_HELD));
    if (held === undefined) throw new Error('the fixture holds no entity with an imo');
    const result = hits.parse(
      await output(ask, 'search_graph', { identifier: { key: 'imo', value: held.value } }),
    );
    const [hull] = result.entities;
    if (hull === undefined) throw new Error('search_graph found no entity for the imo');
    const made = proposed.parse(
      await output(
        ask,
        'propose',
        citedOnPageOne({
          op: 'update_attrs',
          targetKind: 'entity',
          targetId: hull.id,
          attrs: { imo: { v: held.value } },
        }),
      ),
    );
    return { held, result, made };
  });
  expect(found.result.entities.map((entity) => entity.id)).toStrictEqual([found.held.id]);
  expect(found.made.proposals).toHaveLength(1);
});

test('search_graph finds nothing for an imo that no entity holds', async () => {
  const found = await rolledBack('research', async (ask) =>
    hits.parse(await output(ask, 'search_graph', { identifier: { key: 'imo', value: '9074729' } })),
  );
  expect(found.entities).toStrictEqual([]);
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

// --------------------------------------------------------------- propose ---

const PAGE_ONE =
  'On 12 March 2024 the tanker NAYARA, of 41 200 dwt, left Sikka. Rosneft owns the ves-\n' +
  'sel through Sea­trade Ltd.';

const item = (
  ref: string,
  act: Readonly<Record<string, unknown>>,
  excerpt: string,
): Readonly<Record<string, unknown>> => ({
  ref,
  act,
  originator: 'The port authority',
  modality: 'asserts',
  evidence: [{ document: DOC, page: 1, excerpt }],
});

const NAYARA = item(
  'nayara',
  {
    op: 'create_entity',
    type: 'vessel',
    label: 'Nayara',
    attrs: { departed_on: { v: '2024-03-12' }, capacity_dwt: { v: 41200 } },
  },
  'On 12 March 2024 the tanker NAYARA, of 41 200 dwt',
);

const proposedBatch = z.object({
  proposals: z.array(
    z.object({
      ref: z.string(),
      proposalId: z.uuid(),
      written: z.boolean(),
      disputed: z.boolean(),
      unstated: z.array(z.string()),
    }),
  ),
});

// The research role cannot read a citation, so the owner opens the transaction, the research
// role makes each call, and the owner reads the rows that the call wrote.
const asResearch = async <T>(ask: Ask, work: () => Promise<T>): Promise<T> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

const proposeAgain = (ask: Ask, items: readonly unknown[]) =>
  asResearch(ask, () => call(ask, 'propose', { items }));

const proposeOnPage = async (ask: Ask, items: readonly unknown[]) => {
  await asResearch(ask, () => withDocument(ask, [PAGE_ONE]));
  return proposeAgain(ask, items);
};

const batchOf = (outcome: Awaited<ReturnType<typeof call>>) => {
  if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
  return proposedBatch.parse(outcome.output);
};

const ROWS = `SELECT p.id::text AS id, p.author_role, p.status, p.src::text[] AS src, p.payload,
    p.dissent, p.originator, c.page, c.start, c."end", c.modality, c.text_extractor
  FROM public.proposals p LEFT JOIN public.citation c ON c.claim_id = p.id
  WHERE p.src::text[] @> ARRAY[$1::text] ORDER BY p.created_at, p.id`;

const documentRows = z.array(
  z.object({
    id: z.uuid(),
    author_role: z.string(),
    status: z.string(),
    src: z.array(z.string()),
    payload: z.record(z.string(), z.unknown()),
    dissent: z.boolean(),
    originator: z.string().nullable(),
    page: z.number().nullable(),
    start: z.number().nullable(),
    end: z.number().nullable(),
    modality: z.string().nullable(),
    text_extractor: z.string().nullable(),
  }),
);

const rowsOfDocument = async (ask: Ask) => documentRows.parse(await ask(ROWS, [DOC]));

const spanOf = (start: number | null | undefined, end: number | null | undefined): string =>
  Array.from(PAGE_ONE)
    .slice(start ?? 0, end ?? 0)
    .join('');

test('propose stores the act of the role, its originator and the citation of its excerpt', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [NAYARA]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { ref: 'nayara', written: true, disputed: false, unstated: [] },
  ]);
  expect(found.rows).toHaveLength(1);
  const [row] = found.rows;
  expect(row).toMatchObject({
    id: found.batch.proposals[0]?.proposalId,
    author_role: 'gabriel_research',
    status: 'pending',
    src: [DOC],
    dissent: false,
    originator: 'The port authority',
    page: 1,
    modality: 'asserts',
    text_extractor: 'tool-test-1',
  });
  expect(spanOf(row?.start, row?.end)).toBe('On 12 March 2024 the tanker NAYARA, of 41 200 dwt');
  expect(row?.payload['attrs']).toStrictEqual({
    departed_on: { v: '2024-03-12', src: [DOC] },
    capacity_dwt: { v: 41200, src: [DOC] },
  });
});

test('an excerpt with other white space, a soft hyphen and a hyphen at a line end is found', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [
      item(
        'owner',
        { op: 'create_entity', type: 'company', label: 'Seatrade Ltd' },
        'Rosneft  owns the vessel through Seatrade Ltd.',
      ),
    ]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  const [row] = found.rows;
  expect(spanOf(row?.start, row?.end)).toBe('Rosneft owns the ves-\nsel through Sea­trade Ltd.');
  expect(found.batch.proposals[0]?.disputed).toBe(false);
});

test('an excerpt that the page does not hold refuses the whole batch and names the item', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [
      NAYARA,
      item(
        'ghost',
        { op: 'create_entity', type: 'vessel', label: 'Ghost' },
        'the tanker Ghost left Vadinar',
      ),
    ]);
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(/^item ghost: .*does not hold the excerpt/u) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

test('a value that its excerpt does not state marks the item as disputed', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [
      item(
        'nayara',
        { op: 'create_entity', type: 'vessel', label: 'Nayara', attrs: { flag: { v: 'Panama' } } },
        'the tanker NAYARA',
      ),
    ]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { disputed: true, unstated: ['attrs.flag'], written: true },
  ]);
  expect(found.rows[0]?.dissent).toBe(true);
});

test('a relation of a batch names an entity that the same batch creates', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const outcome = await proposeOnPage(ask, [
      NAYARA,
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: 'nayara' },
        'Rosneft owns the vessel',
      ),
    ]);
    return { held, batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  const [vessel, link] = found.batch.proposals;
  const relation = found.rows.find((row) => row.id === link?.proposalId);
  expect(relation?.payload).toMatchObject({ src_id: found.held.id, dst_id: vessel?.proposalId });
});

test('a relation that names a later item or an absent entity refuses the batch', async () => {
  const outcomes = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const later = await proposeOnPage(ask, [
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: 'nayara' },
        'Rosneft owns the vessel',
      ),
      NAYARA,
    ]);
    const absent = await proposeAgain(ask, [
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: ABSENT },
        'Rosneft owns the vessel',
      ),
    ]);
    return { later, absent };
  });
  expect(outcomes.later).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('item owner: it names nayara') as string,
  });
  expect(outcomes.absent).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(ABSENT) as string,
  });
});

test('a retry of the same batch writes no second proposal and no second citation', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const batch = [
      NAYARA,
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: 'nayara' },
        'Rosneft owns the vessel',
      ),
    ];
    const first = batchOf(await proposeOnPage(ask, batch));
    const again = batchOf(await proposeAgain(ask, batch));
    return { first, again, rows: await rowsOfDocument(ask) };
  });
  expect(found.again.proposals.map((one) => one.proposalId)).toStrictEqual(
    found.first.proposals.map((one) => one.proposalId),
  );
  expect(found.again.proposals.map((one) => one.written)).toStrictEqual([false, false]);
  expect(found.rows).toHaveLength(2);
});

test('propose updates attributes and keeps the documents the value already held', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const [held] = keyed.parse(await ask(KEYED));
    if (held === undefined) throw new Error('the fixture holds no string attribute');
    const outcome = await proposeOnPage(ask, [
      item(
        'update',
        {
          op: 'update_attrs',
          targetKind: 'entity',
          targetId: held.id,
          attrs: { [held.key]: { v: held.value } },
        },
        'the tanker NAYARA',
      ),
    ]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.rows[0]?.src).toContain(DOC);
  expect(found.rows[0]?.src).not.toContain('manual');
  expect(found.batch.proposals[0]?.disputed).toBe(true);
});

test('propose refuses an act that the write contract refuses, and names the item', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item('blank', { op: 'create_entity', type: '', label: 'Nayara' }, 'the tanker NAYARA'),
    ]),
  );
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(/^item blank: /u) as string,
  });
});

test('propose refuses a page of a document that holds no stored text', async () => {
  const outcome = await rolledBack('research', (ask) => call(ask, 'propose', { items: [NAYARA] }));
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(`item nayara: document ${DOC} has no page 1`) as string,
  });
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
      await output(
        ask,
        'propose',
        citedOnPageOne({ op: 'create_entity', type: 'vessel', label: 'Nayara' }),
      ),
    );
    const proposalId = made.proposals[0]?.proposalId;
    return {
      proposalId,
      read: read.parse(await output(ask, 'proposal_read', { proposal: proposalId })),
    };
  });
  expect(found.read).toMatchObject({
    id: found.proposalId,
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
      failureReason: z.string().nullable(),
      finishedAt: z.string().nullable(),
    }),
  ),
});

test('enqueue_extract queues one extraction, and job_status reports it', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const job = queued.parse(await output(ask, 'enqueue_extract', { document: DOC }));
    return { job, status: JOBS.parse(await output(ask, 'job_status', { document: DOC })) };
  });
  expect(found.status.document).toBe(DOC);
  const waiting = found.status.jobs.find((job) => job.id === found.job.jobId);
  expect(waiting).toMatchObject({ status: 'queued', failureReason: null, finishedAt: null });
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
