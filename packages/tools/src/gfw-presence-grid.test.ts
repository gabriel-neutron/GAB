// gfw_presence_grid, offline: a web that answers from a fixture and a store in memory. No test
// reaches the network.

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool } from './tool.ts';
import {
  bytes,
  hashDatabase,
  json,
  stubWeb,
  text,
  type Answerer,
  type PostAnswerer,
} from './web-stub.ts';

const tool = CATALOGUE.find((entry) => entry.name === 'gfw_presence_grid');
if (tool === undefined) throw new Error('the catalogue holds no gfw_presence_grid');

const TOKEN = 'gfw-secret-9';
const INPUT = {
  vesselIds: ['bbbbbbbb-1', 'aaaaaaaa-2', 'bbbbbbbb-1'],
  from: '2026-01-01',
  to: '2026-02-01',
  spatialResolution: 'LOW',
  temporalResolution: 'MONTHLY',
};

// One cell in two months, and a second cell.
const GRID = {
  total: 3,
  nextOffset: null,
  entries: [
    {
      'public-global-presence:v3.0': [
        { date: '2026-01', lat: 60.1, lon: 28.1, hours: 1.5, vesselIDs: 2 },
        { date: '2026-02', lat: 60.1, lon: 28.1, hours: 2.25, vesselIDs: 1 },
        { date: '2026-02', lat: 44.7, lon: 37.8, hours: 4, vesselIDs: 1 },
      ],
    },
  ],
};

const setup = (
  poster: PostAnswerer = () => bytes(JSON.stringify(GRID)),
  answer: Answerer = () => text('absent', 404),
  settings: { gfwToken?: string } = { gfwToken: TOKEN },
) => {
  const web = stubWeb(answer, settings, poster);
  const store = memoryStore();
  const pauses: number[] = [];
  return {
    web,
    store,
    pauses,
    session: hashDatabase(),
    reach: {
      store,
      web,
      now: () => new Date('2026-10-28T10:00:00Z'),
      sleep: (ms: number) => {
        pauses.push(ms);
        return Promise.resolve();
      },
    },
  };
};

const refusalOf = (result: unknown): string => JSON.stringify(result);

test('the tool posts the region, filters the vessels and stores one document with the terms', async () => {
  const { web, store, session, reach } = setup();
  const result = await callTool(tool, session, INPUT, reach);
  expect(result).toEqual({
    ok: true,
    output: {
      document: expect.any(String) as unknown,
      status: 'stored',
      cells: 2,
      hours: 7.75,
      filterChecked: true,
      recovered: false,
      licence: 'CC BY-NC 4.0',
      citation: 'Global Fishing Watch',
      limit: expect.stringContaining('AIS only') as unknown,
    },
  });

  const [post] = web.posted;
  const params = post?.url.searchParams;
  expect(post?.url.pathname).toBe('/v3/4wings/report');
  expect(params?.get('datasets[0]')).toBe('public-global-presence:latest');
  expect(params?.get('format')).toBe('JSON');
  expect(params?.get('spatial-aggregation')).toBe('false');
  expect(params?.get('spatial-resolution')).toBe('LOW');
  expect(params?.get('temporal-resolution')).toBe('MONTHLY');
  expect(params?.get('date-range')).toBe('2026-01-01,2026-02-01');
  expect(params?.get('filters[0]')).toBe("vessel_id in ('aaaaaaaa-2', 'bbbbbbbb-1')");
  expect(params?.has('group-by')).toBe(false);
  expect(JSON.parse(post?.body ?? '')).toMatchObject({ geojson: { type: 'Polygon' } });

  expect(store.puts).toHaveLength(1);
  expect(JSON.parse(new TextDecoder().decode(store.puts[0]?.bytes))).toMatchObject({
    licence: 'CC BY-NC 4.0',
    limit: expect.stringContaining('AIS only') as unknown,
    response: GRID,
  });
});

test('the token goes in a header and never in an address, a document or the output', async () => {
  const { web, store, session, reach } = setup();
  const result = await callTool(tool, session, INPUT, reach);
  expect(web.posted[0]?.headers['authorization']).toBe(`Bearer ${TOKEN}`);
  expect(web.posted[0]?.url.href).not.toContain(TOKEN);
  expect(JSON.stringify(result)).not.toContain(TOKEN);
  expect(new TextDecoder().decode(store.puts[0]?.bytes)).not.toContain(TOKEN);
  for (const values of session.stored) expect(JSON.stringify(values)).not.toContain(TOKEN);
});

test('with no token the tool names the setting and calls nothing', async () => {
  const { web, session, reach } = setup(undefined, undefined, {});
  const result = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(result)).toContain('GFW_API_TOKEN');
  expect(web.posted).toHaveLength(0);
});

test('a quote in a vessel id never reaches the filter', async () => {
  const { web, session, reach } = setup();
  const result = await callTool(
    tool,
    session,
    { ...INPUT, vesselIds: ["aaaaaaaa') or ('1'='1"] },
    reach,
  );
  expect(result).toMatchObject({ ok: false });
  expect(web.posted).toHaveLength(0);
});

test('more than 100 vessels is a refusal', async () => {
  const { web, session, reach } = setup();
  const vesselIds = Array.from({ length: 101 }, (_, at) => `vessel-${String(at).padStart(3, '0')}`);
  expect(await callTool(tool, session, { ...INPUT, vesselIds }, reach)).toMatchObject({
    ok: false,
  });
  expect(web.posted).toHaveLength(0);
});

test('a cell with more vessels than the list stores nothing, as the filter did not apply', async () => {
  const crowded = { entries: [{ lat: 1, lon: 2, hours: 3, vesselIDs: 3 }] };
  const { store, session, reach } = setup(() => bytes(JSON.stringify(crowded)));
  const result = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(result)).toContain('did not apply the vessel filter');
  expect(store.puts).toHaveLength(0);
});

test('an answer with no vessel count says that the filter has no check', async () => {
  const flat = { entries: [{ lat: 1, lon: 2, hours: 3 }] };
  const { session, reach } = setup(() => bytes(JSON.stringify(flat)));
  expect(await callTool(tool, session, INPUT, reach)).toMatchObject({
    ok: true,
    output: { cells: 1, hours: 3, filterChecked: false },
  });
});

test('a 429 says that one report runs for each user', async () => {
  const { store, session, reach } = setup(() => bytes('{}', 429));
  const result = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(result)).toContain('one report for each user');
  expect(store.puts).toHaveLength(0);
});

test('a 524 reads the last report until it is ready', async () => {
  const answers = [json({ uri: '/x', status: 'running', lastUpdate: 'now' }), json(GRID)];
  const { web, pauses, session, reach } = setup(
    () => bytes('timeout', 524),
    () => answers.shift() ?? text('absent', 404),
  );
  expect(await callTool(tool, session, INPUT, reach)).toMatchObject({
    ok: true,
    output: { cells: 2, recovered: true },
  });
  expect(web.asked.map((asked) => asked.url.pathname)).toEqual([
    '/v3/4wings/last-report',
    '/v3/4wings/last-report',
  ]);
  expect(web.asked[0]?.headers['authorization']).toBe(`Bearer ${TOKEN}`);
  expect(pauses).toHaveLength(1);
});

test('a time limit of the POST also reads the last report', async () => {
  const late = new Error('late');
  late.name = 'TimeoutError';
  const { session, reach } = setup(
    () => late,
    () => json(GRID),
  );
  expect(await callTool(tool, session, INPUT, reach)).toMatchObject({
    ok: true,
    output: { recovered: true },
  });
});

test('a report that still runs after the polls is a refusal that says to call again', async () => {
  const { store, session, reach } = setup(
    () => bytes('timeout', 524),
    () => json({ status: 'running' }),
  );
  const result = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(result)).toContain('still runs');
  expect(store.puts).toHaveLength(0);
});

test('a last report that ended with an error is a refusal', async () => {
  const { store, session, reach } = setup(
    () => bytes('timeout', 524),
    () => json({ message: { statusCode: 422, error: 'bad' }, status: 422 }),
  );
  const result = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(result)).toContain('answered 422');
  expect(store.puts).toHaveLength(0);
});

test('a refusal of the API shows its reason and never the token', async () => {
  const { session, reach } = setup(() =>
    bytes(JSON.stringify({ error: `vessel_id is not a filter, token ${TOKEN}` }), 422),
  );
  const result = refusalOf(await callTool(tool, session, INPUT, reach));
  expect(result).toContain('answered 422');
  expect(result).toContain('vessel_id is not a filter');
  expect(result).not.toContain(TOKEN);
});

test('an answer that echoes the token is not stored', async () => {
  const echoed = { echo: TOKEN, entries: [] };
  const { store, session, reach } = setup(() => bytes(JSON.stringify(echoed)));
  expect(await callTool(tool, session, INPUT, reach)).toMatchObject({ ok: false });
  expect(store.puts).toHaveLength(0);
});
