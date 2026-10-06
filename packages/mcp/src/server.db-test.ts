// The server runs against the disposable database as gabriel_research. Each call goes through one
// session inside a transaction that rolls back, because the ledger refuses a delete.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from '../../../tools/probe.ts';
import { assertSessionRole } from './role.ts';
import { createServer, type SessionPool } from './server.ts';

const SHA = 'e'.repeat(64);
const DOC = `doc_${SHA.slice(0, 12)}`;
const URL = 'https://example.org/server-report';
const TITLE = 'A report of the server test';

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';

const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

const PAGE = 'The Council adopted Regulation 2025/1476 on 18 July 2025.';

const STORED = 'SELECT author_role, status FROM public.proposals WHERE id = $1';

const ABSENT = '00000000-0000-4000-8000-000000000000';

const answer = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  isError: z.boolean().optional(),
});

// Every call of the server takes the one session of the test, so a call inside a transaction
// stays inside it.
const poolOf = (ask: Ask): SessionPool => ({
  connect: () =>
    Promise.resolve({
      query: async (text: string, values: unknown[]) => ({ rows: await ask(text, values) }),
      release: () => undefined,
    }),
});

interface Called {
  readonly refused: boolean;
  readonly text: string;
}

type Call = (name: string, args: Record<string, unknown>) => Promise<Called>;

// A client of the server on the session of the test, closed when the work ends.
const withServer = async <T>(ask: Ask, work: (call: Call) => Promise<T>): Promise<T> => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(poolOf(ask)).connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  try {
    return await work(async (name, args) => {
      const result = answer.parse(await client.callTool({ name, arguments: args }));
      return {
        refused: result.isError === true,
        text: result.content.map((part) => part.text).join(''),
      };
    });
  } finally {
    await client.close();
  }
};

const outputOf = (called: Called): unknown => {
  if (called.refused) throw new Error(`the server refused the call: ${called.text}`);
  return JSON.parse(called.text);
};

const withDocument = async (ask: Ask): Promise<void> => {
  await ask(STORE, ['url', TITLE, `raw/${SHA}`, URL, SHA, 'application/pdf', '2026-09-02', null]);
  await ask(WRITE_TEXT, [DOC, JSON.stringify([PAGE]), 'server-test-1']);
};

const ITEM = {
  ref: 'act',
  act: { op: 'create_entity', type: 'legal_act', label: 'Regulation 2025/1476' },
  originator: 'The Council',
  modality: 'enacts',
  evidence: [{ document: DOC, page: 1, excerpt: 'adopted Regulation 2025/1476' }],
};

const proposed = z.object({ proposals: z.array(z.object({ proposalId: z.uuid() })).length(1) });

const listed = z.object({
  proposals: z.array(
    z.object({ id: z.uuid(), status: z.string(), documents: z.array(z.string()) }),
  ),
});

const CONNECTED = `SELECT r.src_id::text AS id, r.id::text AS relation, r.dst_id::text AS other
  FROM api.relation r WHERE r.src_kind = 'entity' AND r.dst_kind = 'entity'
  ORDER BY r.id LIMIT 1`;

const connected = z.array(z.object({ id: z.uuid(), relation: z.uuid(), other: z.uuid() }));

test('the session check refuses a session that logs in as another role', async () => {
  await expect(probe('app', (ask) => assertSessionRole(poolOf(ask)))).rejects.toThrow(
    'the MCP server runs only as gabriel_research; the credentials name gabriel_app',
  );
});

test('the session check accepts a session that logs in as gabriel_research', async () => {
  await expect(probe('research', (ask) => assertSessionRole(poolOf(ask)))).resolves.toBe(undefined);
});

// ------------------------------------------------------------------------- propose ---

test('a call of propose through the server stores a proposal of gabriel_research', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask);
    const made = await withServer(ask, async (call) =>
      proposed.parse(outputOf(await call('propose', { items: [ITEM] }))),
    );
    return ask(STORED, [made.proposals[0]?.proposalId]);
  });
  expect(found).toStrictEqual([{ author_role: 'gabriel_research', status: 'pending' }]);
});

test('list_proposals gives the pending proposal of a document and of the entity it names', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask);
    const [held] = connected.parse(await ask(CONNECTED));
    if (held === undefined) throw new Error('the fixture holds no relation between two entities');
    return withServer(ask, async (call) => {
      const made = proposed.parse(
        outputOf(
          await call('propose', {
            items: [
              {
                ...ITEM,
                ref: 'update',
                act: {
                  op: 'update_attrs',
                  targetKind: 'entity',
                  targetId: held.id,
                  attrs: { celex: { v: '32025R1476' } },
                },
                evidence: [{ document: DOC, page: 1, excerpt: 'Regulation 2025/1476' }],
              },
            ],
          }),
        ),
      );
      return {
        made: made.proposals[0]?.proposalId,
        byDocument: listed.parse(outputOf(await call('list_proposals', { document: DOC }))),
        byEntity: listed.parse(outputOf(await call('list_proposals', { entity: held.id }))),
        accepted: listed.parse(
          outputOf(await call('list_proposals', { document: DOC, status: 'accepted' })),
        ),
      };
    });
  });
  expect(found.byDocument.proposals).toStrictEqual([
    { ...found.byDocument.proposals[0], id: found.made, status: 'pending', documents: [DOC] },
  ]);
  expect(found.byEntity.proposals.map((one) => one.id)).toContain(found.made);
  expect(found.accepted.proposals).toStrictEqual([]);
});

// -------------------------------------------------------------- the record reads ---

const entityRead = z.object({
  id: z.uuid(),
  relations: z.array(
    z.object({
      id: z.uuid(),
      direction: z.enum(['out', 'in']),
      reads: z.string().nullable(),
      other: z.object({ kind: z.string(), id: z.uuid(), label: z.string().nullable() }),
      sources: z.array(z.string()),
    }),
  ),
  documents: z.array(z.object({ id: z.string(), title: z.string() })),
  sources: z.array(z.string()),
});

test('read_entity gives the relations of an entity with their direction and the other end', async () => {
  const found = await rolledBack('research', async (ask) => {
    const [held] = connected.parse(await ask(CONNECTED));
    if (held === undefined) throw new Error('the fixture holds no relation between two entities');
    return {
      held,
      read: await withServer(ask, async (call) =>
        entityRead.parse(outputOf(await call('read_entity', { entity: held.id }))),
      ),
    };
  });
  const relation = found.read.relations.find((one) => one.id === found.held.relation);
  expect(relation).toMatchObject({
    direction: 'out',
    other: { kind: 'entity', id: found.held.other },
  });
  expect(relation?.reads).toEqual(expect.any(String));
  const cited = new Set(found.read.documents.map((one) => one.id));
  for (const source of [...found.read.sources, ...(relation?.sources ?? [])])
    expect(cited.has(source)).toBe(true);
});

test('read_entity of an id that names no entity is refused with the reason', async () => {
  const called = await rolledBack('research', (ask) =>
    withServer(ask, (call) => call('read_entity', { entity: ABSENT })),
  );
  expect(called).toStrictEqual({ refused: true, text: `the record holds no entity ${ABSENT}` });
});

const vocabulary = z.object({
  entityTypes: z.array(z.object({ key: z.string() })),
  relationTypes: z.array(
    z.object({ key: z.string(), inverseLabel: z.string(), takesInterval: z.boolean() }),
  ),
  identifierKeys: z.record(z.string(), z.array(z.string())),
});

test('list_vocabulary gives the live types and the identifier keys', async () => {
  const found = await rolledBack('research', (ask) =>
    withServer(ask, async (call) => vocabulary.parse(outputOf(await call('list_vocabulary', {})))),
  );
  expect(found.entityTypes.map((one) => one.key)).toContain('vessel');
  expect(found.relationTypes.length).toBeGreaterThan(0);
  expect(found.identifierKeys['vessel']).toContain('imo');
});

const hits = z.object({ entities: z.array(z.object({ id: z.uuid() })) });

const NUMBERED = `UPDATE public.entities
  SET attrs = attrs || jsonb_build_object('imo', jsonb_build_object('v', 9074729, 'src', sources))
  WHERE id = (SELECT id FROM public.entities ORDER BY id LIMIT 1)
  RETURNING id::text AS id`;

test('search_graph finds an identifier that the record holds as a number', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const [held] = z.array(z.object({ id: z.uuid() })).parse(await ask(NUMBERED));
    await ask('SET LOCAL ROLE gabriel_research');
    return {
      held,
      hits: await withServer(ask, async (call) =>
        hits.parse(
          outputOf(await call('search_graph', { identifier: { key: 'imo', value: '9074729' } })),
        ),
      ),
    };
  });
  expect(found.hits.entities.map((one) => one.id)).toStrictEqual([found.held?.id]);
});

// -------------------------------------------------------------------- documents ---

const documents = z.object({
  documents: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      url: z.string().nullable(),
      textPages: z.number().nullable(),
    }),
  ),
});

test('find_document finds a stored document by its address and by its title', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask);
    return withServer(ask, async (call) => ({
      byUrl: documents.parse(outputOf(await call('find_document', { url: URL }))),
      byTitle: documents.parse(outputOf(await call('find_document', { title: 'server test' }))),
    }));
  });
  const stored = { id: DOC, title: TITLE, url: URL, textPages: 1 };
  expect(found.byUrl.documents[0]).toMatchObject(stored);
  expect(found.byTitle.documents).toContainEqual(expect.objectContaining(stored));
});

test('document_text gives the title and the address of the document', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask);
    return withServer(ask, async (call) =>
      outputOf(await call('document_text', { document: DOC })),
    );
  });
  expect(found).toMatchObject({
    document: DOC,
    title: TITLE,
    url: URL,
    pages: [{ page: 1, text: PAGE }],
  });
});

test('document_text of a document that the record does not hold is refused', async () => {
  const called = await rolledBack('research', (ask) =>
    withServer(ask, (call) => call('document_text', { document: 'doc_absent' })),
  );
  expect(called.refused).toBe(true);
  expect(called.text).toContain('the record holds no document doc_absent');
});

// ------------------------------------------------------------------------- jobs ---

const jobs = z.object({
  jobs: z.array(
    z.object({
      id: z.uuid(),
      kind: z.string(),
      status: z.string(),
      failureReason: z.string().nullable(),
      proposals: z.number(),
    }),
  ),
});

test('enqueue_extract returns the job id, and job_status gives its kind, status and count', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask);
    return withServer(ask, async (call) => ({
      queued: z
        .object({ jobId: z.uuid() })
        .parse(outputOf(await call('enqueue_extract', { document: DOC }))),
      status: jobs.parse(outputOf(await call('job_status', { document: DOC }))),
      again: await call('enqueue_extract', { document: DOC }),
    }));
  });
  expect(found.status.jobs).toStrictEqual([
    {
      id: found.queued.jobId,
      kind: 'extract_text',
      status: 'queued',
      proposals: 0,
      failureReason: null,
    },
  ]);
  expect(found.again.refused).toBe(true);
  expect(found.again.text).toContain(`an extraction of ${DOC} is queued or runs already`);
});

test('a refusal of the record reaches the AI with its reason', async () => {
  const called = await rolledBack('research', (ask) =>
    withServer(ask, (call) => call('enqueue_extract', { document: 'doc_absent' })),
  );
  expect(called).toStrictEqual({
    refused: true,
    text: 'the record refused the call: document doc_absent does not exist',
  });
});

test('the public read role cannot read the jobs of a document', async () => {
  await expect(
    rolledBack('read', (ask) => ask("SELECT * FROM public.document_jobs('doc_absent')")),
  ).rejects.toMatchObject({ code: '42501' });
});

// ------------------------------------------------------------------------ leads ---

test('start_lead starts a lead of gabriel_research and returns its job id', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
    const started = await withServer(ask, async (call) =>
      z
        .object({ jobId: z.uuid() })
        .parse(outputOf(await call('start_lead', { lead: 'Intershipping and its vessels' }))),
    );
    await ask('RESET SESSION AUTHORIZATION');
    return ask('SELECT kind, lead, lead_by, status FROM public.jobs WHERE id = $1', [
      started.jobId,
    ]);
  });
  expect(found).toStrictEqual([
    {
      kind: 'research_lead',
      lead: 'Intershipping and its vessels',
      lead_by: 'gabriel_research',
      status: 'queued',
    },
  ]);
});
