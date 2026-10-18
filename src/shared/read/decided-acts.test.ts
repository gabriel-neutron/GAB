import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const DECIDED_ROW = {
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
  status: 'accepted',
  created_at: '2026-08-25T03:25:13.734752+00:00',
  decided_at: '2026-08-25T04:00:00+00:00',
  decided_by: 'the writer door',
  decided_as: null,
  decision_origin: null,
  origin_label: null,
  batch_id: null,
};

let acceptedRows: readonly unknown[] = [DECIDED_ROW];

const listed = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

const stub = vi.fn((input: URL): Promise<Response> => {
  const status = input.searchParams.get('status');
  if (status === 'eq.accepted') return Promise.resolve(listed(acceptedRows));
  return Promise.resolve(listed([]));
});

const asked = (): readonly string[] =>
  stub.mock.calls.map(([input]) => `${input.pathname}${input.search}`).sort();

beforeEach(() => {
  acceptedRows = [DECIDED_ROW];
  stub.mockClear();
  vi.stubGlobal('fetch', stub);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the history reads the promoted acts, and no pending act and no rejected act', async () => {
  const { loadDecidedActs } = await import('./decided-acts');

  const read = await loadDecidedActs();

  expect(asked()).toStrictEqual(['/proposal?status=eq.accepted']);
  expect(
    read.map((held) =>
      'unreadable' in held ? [held.id] : [held.act.id, held.verdict, held.decidedBy],
    ),
  ).toStrictEqual([['07e80431-1df2-4b32-ab9c-16f3cab6d2c7', 'accepted', 'the writer door']]);
});

test('an act that gives only the start date of a relation is read, as an end-date act is', async () => {
  const START_ROW = {
    ...DECIDED_ROW,
    id: '17e80431-1df2-4b32-ab9c-16f3cab6d2c7',
    op: 'update_relation',
    target_kind: 'relation',
    payload: { valid_from: '2019-05-02' },
    prior_value: { valid_from: null, sources: ['manual'] },
  };
  acceptedRows = [START_ROW];
  const { loadDecidedActs } = await import('./decided-acts');

  const read = await loadDecidedActs();

  expect(read).toHaveLength(1);
  expect(read[0]).toMatchObject({
    act: { payload: { kind: 'start', valid_from: '2019-05-02' } },
    verdict: 'accepted',
  });
});

test('a decided act that arrives without its hour gives one marked line and no failed page', async () => {
  acceptedRows = [DECIDED_ROW, { ...DECIDED_ROW, id: 'bad', decided_at: null }];
  const { loadDecidedActs } = await import('./decided-acts');

  const read = await loadDecidedActs();

  expect(read.map((held) => ('unreadable' in held ? 'unread' : 'read'))).toStrictEqual([
    'read',
    'unread',
  ]);
  expect(read[1]).toStrictEqual({ unreadable: true, id: 'bad' });
});

test('a refresh of the corpus forgets the history, so a later decision reaches it', async () => {
  const { loadDecidedActs } = await import('./decided-acts');
  const { refreshCorpus } = await import('./corpus');

  await loadDecidedActs();
  await loadDecidedActs();
  expect(asked()).toHaveLength(1);

  await refreshCorpus(async () => {
    await loadDecidedActs();
  });
  expect(asked()).toHaveLength(2);
});
