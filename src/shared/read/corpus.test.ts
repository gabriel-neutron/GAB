// The memory of the corpus, with a stubbed fetch. One read of the five views serves every
// caller, a failure clears the memory, and a refresh reads again. The words of the relation types
// travel with the corpus and are read once, because a refresh of the record does not change them.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Corpus } from './model';

// A row of each view, copied whole. Nothing here reaches a database or a network.
const DOCUMENT_ROW = {
  id: 'doc_8f2a41',
  kind: 'report',
  title: 'Port of Rotterdam — bulk cargo throughput, Q2 2026',
  uri: null,
  archive_uri: null,
  sha256: null,
  mime: null,
  retrieved_at: null,
  created_at: '2026-08-25T03:25:13.270163+00:00',
  cost_eur: null,
};

const NORTHERN = {
  id: '94172363-dab1-4fc3-ae2a-16e3430879be',
  type: 'vessel',
  proposed_type: null,
  label: 'MV Northern Ledger',
  geom: { type: 'Point', coordinates: [4.4777, 51.9244] },
  attrs: { imo: { v: '9482137', src: ['doc_8f2a41'] } },
  sources: ['doc_8f2a41'],
  promoted_from: '5f8d5190-1df6-46b4-b6aa-8066b505c01d',
  created_at: '2026-08-25T03:25:13.270163+00:00',
  updated_at: '2026-08-25T03:25:13.270163+00:00',
};

const SOUTHERN = {
  ...NORTHERN,
  id: '0ea482d0-cd00-4c77-911e-419dd2d1779f',
  label: 'MV Southern Ledger',
};

// A row of `full_map` for one entity. It stands at its own point, so it borrows from nobody and
// it names no parent. The word is absent: the fixture states nothing about this position.
const placedAt = (entity: { id: string; geom: unknown }): unknown => ({
  id: entity.id,
  type: 'vessel',
  label: 'MV Northern Ledger',
  geom: entity.geom,
  position_precision: null,
  parent_id: null,
});

const RELATION_ROW = {
  id: 'e0a8a817-0dac-49db-8627-a342609a3092',
  type: 'operates',
  proposed_type: null,
  src_kind: 'entity',
  src_id: '0ea482d0-cd00-4c77-911e-419dd2d1779f',
  dst_kind: 'entity',
  dst_id: '94172363-dab1-4fc3-ae2a-16e3430879be',
  valid_from: null,
  valid_to: null,
  attrs: {},
  sources: ['doc_8f2a41'],
  promoted_from: '5f8d5190-1df6-46b4-b6aa-8066b505c01d',
  created_at: '2026-08-25T03:25:13.270163+00:00',
  updated_at: '2026-08-25T03:25:13.270163+00:00',
};

const RELATION_TYPE_ROW = {
  key: 'operates',
  label: 'operates',
  inverse_label: 'is operated by',
  takes_interval: true,
  retired: false,
};

const PROPOSAL_ROW = {
  id: '07e80431-1df2-4b32-ab9c-16f3cab6d2c7',
  op: 'update_attrs',
  target_kind: 'entity',
  target_id: '94172363-dab1-4fc3-ae2a-16e3430879be',
  payload: { attrs: { flag: { v: 'PA', src: ['doc_8f2a41'] } } },
  src: ['doc_8f2a41'],
  names: [],
  prior_value: null,
  dissent: false,
  author_role: 'gabriel_agent',
  proposer: 'extractor',
  model_call_id: null,
  status: 'pending',
  created_at: '2026-08-25T03:25:13.734752+00:00',
  decided_at: null,
  decided_by: null,
  decided_as: null,
  batch_id: null,
};

let entityRows: readonly (typeof NORTHERN)[] = [NORTHERN];
let refuseEntity = false;

const listed = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const rowsOf = (view: string): readonly unknown[] => {
  if (view === 'document') return [DOCUMENT_ROW];
  if (view === 'entity') return entityRows;
  if (view === 'relation') return [RELATION_ROW];
  if (view === 'relation_type') return [RELATION_TYPE_ROW];
  // The view answers for every entity, so its rows follow the entity rows of the moment.
  if (view === 'full_map') return entityRows.map((row) => placedAt(row));
  return [PROPOSAL_ROW];
};

const stub = vi.fn((input: URL): Promise<Response> => {
  const view = input.pathname.slice(1);
  if (view === 'entity' && refuseEntity) return Promise.resolve(listed({ message: 'no' }, 503));
  return Promise.resolve(listed(rowsOf(view)));
});

const viewsRead = (): readonly string[] =>
  stub.mock.calls.map(([input]) => input.pathname.slice(1)).sort();

const READ_ONCE = ['document', 'entity', 'full_map', 'proposal', 'relation'];

const VOCABULARY = 'relation_type';

// The whole sentence of a refusal, so a test cannot pass on a failure of another kind.
const refusalOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (cause) {
    return cause instanceof Error ? cause.message : 'a refusal that carries no sentence';
  }
  throw new Error('the corpus arrived from a read that must fail');
};

beforeEach(() => {
  entityRows = [NORTHERN];
  refuseEntity = false;
  stub.mockClear();
  vi.stubGlobal('fetch', stub);
  // The module holds the answer of the read, so each test takes its own copy of the module.
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('two callers of the corpus make one read of each view, and share the answer', async () => {
  const { loadCorpus } = await import('./corpus');

  const first = await loadCorpus();
  const second = await loadCorpus();

  expect(viewsRead()).toStrictEqual([...READ_ONCE, VOCABULARY].sort());
  expect(second).toBe(first);
});

test('two callers that ask together make one read of each view', async () => {
  const { loadCorpus } = await import('./corpus');

  const [first, second] = await Promise.all([loadCorpus(), loadCorpus()]);

  expect(viewsRead()).toStrictEqual([...READ_ONCE, VOCABULARY].sort());
  expect(second).toBe(first);
});

test('a read that fails clears the memory, so the next caller reads again and arrives', async () => {
  refuseEntity = true;
  const { loadCorpus } = await import('./corpus');

  expect(await refusalOf(() => loadCorpus())).toBe(
    'The read API refused the entity list, and answered 503.',
  );

  refuseEntity = false;
  const read = await loadCorpus();

  expect(read.entities.map((entity) => entity.label)).toStrictEqual(['MV Northern Ledger']);
  expect(viewsRead()).toStrictEqual([...READ_ONCE, ...READ_ONCE, VOCABULARY].sort());
});

test('a refresh reads the five views again, and gives the later record', async () => {
  const { loadCorpus, refreshCorpus } = await import('./corpus');

  const before = await loadCorpus();
  entityRows = [NORTHERN, SOUTHERN];
  const seen: Corpus[] = [];
  await refreshCorpus(async () => {
    seen.push(await loadCorpus());
  });
  const after = seen[0];

  expect(viewsRead()).toStrictEqual([...READ_ONCE, ...READ_ONCE, VOCABULARY].sort());
  expect(before.entities.map((entity) => entity.label)).toStrictEqual(['MV Northern Ledger']);
  expect(after?.entities.map((entity) => entity.label)).toStrictEqual([
    'MV Northern Ledger',
    'MV Southern Ledger',
  ]);
});

test('a refresh holds its later answer, and a caller after it reads no view again', async () => {
  const { loadCorpus, refreshCorpus } = await import('./corpus');

  await loadCorpus();
  await refreshCorpus(async () => {
    await loadCorpus();
  });
  await loadCorpus();

  expect(viewsRead()).toStrictEqual([...READ_ONCE, ...READ_ONCE, VOCABULARY].sort());
});
