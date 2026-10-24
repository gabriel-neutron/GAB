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

const ID = DECIDED_ROW.id;

// The stub answers like the read API: it keeps the rows that match each filter of the request.
let acceptedRows: readonly unknown[] = [DECIDED_ROW];

const listed = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

const stub = vi.fn((input: URL): Promise<Response> => {
  const status = input.searchParams.get('status');
  const id = input.searchParams.get('id');
  if (status !== 'eq.accepted' || id === null) return Promise.resolve(listed([]));
  const wanted = id.replace(/^eq\./u, '');
  const kept = acceptedRows.filter((row) => (row as { id: string }).id === wanted);
  return Promise.resolve(listed(kept));
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

test('the read asks for the one accepted act that the entity names, and no other', async () => {
  const { loadDecidedActs } = await import('./decided-acts');

  const read = await loadDecidedActs(ID);

  expect(asked()).toStrictEqual([`/proposal?id=eq.${ID}&status=eq.accepted`]);
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

  const read = await loadDecidedActs(START_ROW.id);

  expect(read).toHaveLength(1);
  expect(read[0]).toMatchObject({
    act: { payload: { kind: 'start', valid_from: '2019-05-02' } },
    verdict: 'accepted',
  });
});

test('a decided act that arrives without its hour gives one marked line and no failed page', async () => {
  acceptedRows = [DECIDED_ROW, { ...DECIDED_ROW, id: 'bad', decided_at: null }];
  const { loadDecidedActs } = await import('./decided-acts');

  const read = await loadDecidedActs('bad');

  expect(read).toStrictEqual([{ unreadable: true, id: 'bad' }]);
});

test('an act that the record does not hold gives no line', async () => {
  const { loadDecidedActs } = await import('./decided-acts');

  expect(await loadDecidedActs('absent')).toStrictEqual([]);
});

test('the held answer is per act, so two entities never share one result', async () => {
  const OTHER = { ...DECIDED_ROW, id: '27e80431-1df2-4b32-ab9c-16f3cab6d2c7' };
  acceptedRows = [DECIDED_ROW, OTHER];
  const { loadDecidedActs } = await import('./decided-acts');

  const first = await loadDecidedActs(ID);
  const second = await loadDecidedActs(OTHER.id);
  await loadDecidedActs(ID);

  expect(first.map((held) => ('unreadable' in held ? '' : held.act.id))).toStrictEqual([ID]);
  expect(second.map((held) => ('unreadable' in held ? '' : held.act.id))).toStrictEqual([OTHER.id]);
  expect(asked()).toStrictEqual([
    `/proposal?id=eq.${ID}&status=eq.accepted`,
    `/proposal?id=eq.${OTHER.id}&status=eq.accepted`,
  ]);
});

test('a refresh of the corpus forgets the history, so a later decision reaches it', async () => {
  const { loadDecidedActs } = await import('./decided-acts');
  const { refreshCorpus } = await import('./corpus');

  await loadDecidedActs(ID);
  await loadDecidedActs(ID);
  expect(asked()).toHaveLength(1);

  await refreshCorpus(async () => {
    await loadDecidedActs(ID);
  });
  expect(asked()).toHaveLength(2);
});
