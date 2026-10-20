// The FIRMS tool, offline: a web that answers from recorded answers, a store in memory and a
// database that is a map of hashes. No test reaches the network.

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type ToolOutcome } from './tool.ts';
import { hashDatabase, json, stubWeb, text, type Asked } from './web-stub.ts';

const KEY = 'firms-secret-key-1';
const tool = CATALOGUE.find((entry) => entry.name === 'firms_detections');
if (tool === undefined) throw new Error('the catalogue holds no firms_detections');

// Handwritten answer in the assumed shape of the FIRMS availability CSV. The archive of SNPP ends on 31 May, its near real
// time source starts on 20 May. NOAA-20 holds a near real time source only.
const AVAILABILITY = [
  'data_id,min_date,max_date',
  'MODIS_NRT,2026-04-01,2026-10-04',
  'VIIRS_SNPP_SP,2012-01-19,2026-05-31',
  'VIIRS_SNPP_NRT,2026-05-20,2026-10-04',
  'VIIRS_NOAA20_NRT,2026-01-01,2026-10-04',
].join('\n');

const TABLE =
  'latitude,longitude,acq_date,acq_time\n51.1,45.2,2026-06-01,0120\n51.2,45.3,2026-06-01,0125\n';

const setup = (options: { used?: number; step?: number; limit?: number; key?: string } = {}) => {
  let used = options.used ?? 0;
  const web = stubWeb(
    (asked: Asked) => {
      const path = asked.url.pathname;
      if (path.startsWith('/api/data_availability/')) return text(AVAILABILITY);
      if (path.startsWith('/mapserver/mapkey_status'))
        return json({ transaction_limit: options.limit ?? 5000, current_transactions: used });
      used += options.step ?? 1;
      return text(TABLE);
    },
    options.key === '' ? {} : { firmsKey: options.key ?? KEY },
  );
  const store = memoryStore();
  const session = hashDatabase();
  const reach = { store, web, now: () => new Date('2026-10-05T10:00:00Z') };
  return { web, store, session, reach };
};

const BOX = { west: 45, south: 51, east: 45.5, north: 51.5 };
const refusalOf = (outcome: ToolOutcome): string => (outcome.ok ? '' : outcome.refusal);
const areaPaths = (web: ReturnType<typeof setup>['web']): string[] =>
  web.asked
    .map((asked) => asked.url.pathname)
    .filter((path) => path.startsWith('/api/area/'))
    .map((path) => path.replace(KEY, '<key>'));

test('the sources come from the dates of FIRMS and a long period is cut into windows of five days', async () => {
  const { web, session, reach } = setup();
  const outcome = await callTool(
    tool,
    session,
    { ...BOX, from: '2026-05-29', to: '2026-06-07' },
    reach,
  );
  expect(outcome).toMatchObject({
    ok: true,
    output: {
      status: 'stored',
      calls: 5,
      detections: 10,
      uncoveredDays: 0,
      sources: ['VIIRS_SNPP_SP', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'],
      transactions: { limit: 5000, before: 0, after: 5 },
    },
  });
  expect(areaPaths(web)).toEqual([
    '/api/area/csv/<key>/VIIRS_SNPP_SP/45,51,45.5,51.5/3/2026-05-29',
    '/api/area/csv/<key>/VIIRS_SNPP_NRT/45,51,45.5,51.5/5/2026-06-01',
    '/api/area/csv/<key>/VIIRS_SNPP_NRT/45,51,45.5,51.5/2/2026-06-06',
    '/api/area/csv/<key>/VIIRS_NOAA20_NRT/45,51,45.5,51.5/5/2026-05-29',
    '/api/area/csv/<key>/VIIRS_NOAA20_NRT/45,51,45.5,51.5/5/2026-06-03',
  ]);
});

test('a period before the near real time source uses the archive and counts a day no source holds', async () => {
  const { web, session, reach } = setup();
  const outcome = await callTool(
    tool,
    session,
    { ...BOX, from: '2025-12-31', to: '2026-01-02' },
    reach,
  );
  expect(outcome).toMatchObject({
    ok: true,
    output: { sources: ['VIIRS_SNPP_SP', 'VIIRS_NOAA20_NRT'], uncoveredDays: 0 },
  });
  expect(areaPaths(web)).toHaveLength(2);
  const early = await callTool(
    tool,
    session,
    { ...BOX, from: '2011-12-30', to: '2012-01-19' },
    reach,
  );
  expect(early).toMatchObject({
    ok: true,
    output: { sources: ['VIIRS_SNPP_SP'], uncoveredDays: 20 },
  });
  const none = await callTool(
    tool,
    session,
    { ...BOX, from: '2000-01-01', to: '2000-01-02' },
    reach,
  );
  expect(refusalOf(none)).toContain('no VIIRS source');
});

test('a box above the maximum area is refused with the reason, and the web is not asked', async () => {
  const { web, session, reach } = setup();
  const outcome = await callTool(
    tool,
    session,
    { west: 30, south: 40, east: 50, north: 60, from: '2026-06-01', to: '2026-06-02' },
    reach,
  );
  expect(refusalOf(outcome)).toContain('a larger box returns the heat of a region');
  expect(web.asked).toHaveLength(0);
});

test('the stored document and its address hold no key, and a second read is known', async () => {
  const { store, session, reach } = setup();
  const input = { ...BOX, from: '2026-06-01', to: '2026-06-03' };
  const first = await callTool(tool, session, input, reach);
  expect(first).toMatchObject({ ok: true, output: { status: 'stored' } });
  const second = await callTool(tool, session, input, reach);
  expect(second).toMatchObject({ ok: true, output: { status: 'known' } });
  expect(store.puts).toHaveLength(1);
  expect(JSON.stringify(session.stored)).not.toContain(KEY);
  expect(JSON.stringify(first)).not.toContain(KEY);
  expect(new TextDecoder().decode(store.puts[0]?.bytes)).not.toContain(KEY);
  expect(session.stored[0]?.[2]).toBe(
    'https://firms.modaps.eosdis.nasa.gov/api/area/csv/45,51,45.5,51.5/2026-06-01/2026-06-03',
  );
});

test('a call of FIRMS has a long time limit and a timeout has its own sentence', async () => {
  const { web, session, reach } = setup();
  await callTool(tool, session, { ...BOX, from: '2026-06-01', to: '2026-06-02' }, reach);
  expect(web.asked.every((asked) => asked.request.timeoutMs === 60_000)).toBe(true);
  const slow = stubWeb(
    () => {
      throw new DOMException('timed out', 'TimeoutError');
    },
    { firmsKey: KEY },
  );
  const outcome = await callTool(
    tool,
    hashDatabase(),
    { ...BOX, from: '2026-06-01', to: '2026-06-02' },
    { store: memoryStore(), web: slow, now: () => new Date('2026-10-05T10:00:00Z') },
  );
  expect(refusalOf(outcome)).toBe('NASA FIRMS: no answer came before the time limit');
});

test('a fault of FIRMS is a refusal that repeats no address and no key', async () => {
  const web = stubWeb(() => new Error(`connect failed for /csv/${KEY}/`), { firmsKey: KEY });
  const outcome = await callTool(
    tool,
    hashDatabase(),
    { ...BOX, from: '2026-06-01', to: '2026-06-02' },
    { store: memoryStore(), web, now: () => new Date('2026-10-05T10:00:00Z') },
  );
  expect(refusalOf(outcome)).toBe('NASA FIRMS: no whole answer came');
  const bad = setup({ key: KEY });
  const refused = await callTool(
    tool,
    bad.session,
    { ...BOX, from: '2026-06-01', to: '2026-06-02' },
    { ...bad.reach, web: stubWeb(() => text('forbidden', 403), { firmsKey: KEY }) },
  );
  expect(refusalOf(refused)).toBe('NASA FIRMS answered 403');
});

test('with no key set the tool refuses and names the setting', async () => {
  const { web, session, reach } = setup({ key: '' });
  const outcome = await callTool(
    tool,
    session,
    { ...BOX, from: '2026-06-01', to: '2026-06-02' },
    reach,
  );
  expect(refusalOf(outcome)).toContain('FIRMS_MAP_KEY');
  expect(web.asked).toHaveLength(0);
});

test('the tool reads the cost and stops before the rate limit', async () => {
  const near = setup({ used: 4950 });
  const planned = await callTool(
    tool,
    near.session,
    { ...BOX, from: '2026-06-01', to: '2026-06-05' },
    near.reach,
  );
  expect(refusalOf(planned)).toContain('transactions left in this interval');
  expect(areaPaths(near.web)).toHaveLength(0);

  // Each call costs 400 here, more than the plan expected, so the tool stops by itself.
  const costly = setup({ step: 400, limit: 1000 });
  const stopped = await callTool(
    tool,
    costly.session,
    { ...BOX, from: '2026-06-01', to: '2026-06-15' },
    costly.reach,
  );
  expect(refusalOf(stopped)).toContain('stopped before the rate limit');
  expect(costly.store.puts).toHaveLength(0);
});

test('an availability answer that yields no source is refused as not understood', async () => {
  const { session, reach } = setup();
  const odd = stubWeb(() => text('<html>maintenance</html>'), { firmsKey: KEY });
  const outcome = await callTool(
    tool,
    session,
    { ...BOX, from: '2026-06-01', to: '2026-06-02' },
    { ...reach, web: odd },
  );
  expect(refusalOf(outcome)).toBe('NASA FIRMS: availability not understood');
});
