// gfw_port_visits, offline: a web that answers from a fixture and a store in memory. No test
// reaches the network.

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool } from './tool.ts';
import { hashDatabase, json, stubWeb, text, type Asked } from './web-stub.ts';

const tool = CATALOGUE.find((entry) => entry.name === 'gfw_port_visits');
if (tool === undefined) throw new Error('the catalogue holds no gfw_port_visits');

const TOKEN = 'gfw-secret-9';
const INPUT = {
  anchorageIds: ['rus-primorsk', 'rus-ust-luga'],
  vesselType: 'CARGO',
  from: '2026-01-01',
  to: '2026-02-01',
};

const fixture = {
  total: 2,
  nextOffset: null,
  entries: [
    {
      id: 'pv1',
      type: 'port_visit',
      vessel: { id: 'v1', name: 'ONE', ssvid: '273000001' },
      port_visit: {
        confidence: 4,
        startAnchorage: { anchorageId: '0d2f61f7', id: 'rus-primorsk' },
      },
    },
    {
      id: 'pv2',
      type: 'port_visit',
      vessel: { id: 'v2', name: 'TWO', ssvid: '273000002' },
      port_visit: {
        confidence: 3,
        startAnchorage: { anchorageId: '0d2f61f8', id: 'rus-ust-luga' },
      },
    },
  ],
};

// Shaped like the Vessels API documentation: a registry record with an IMO and a class, and one
// vessel that only has AIS data.
const vessels = {
  total: 2,
  metadata: { idsFound: ['v1', 'v2'], idsNotFound: [] },
  entries: [
    {
      dataset: 'public-global-vessel-identity:latest',
      registryInfo: [{ id: 'v1', imo: '9000001', shipname: 'ONE' }],
      combinedSourcesInfo: [
        {
          registryVesselClass: [{ source: 'REGISTRY', value: 'CRUDE_OIL_TANKER' }],
          shiptypes: [{ name: 'CARGO', source: 'GFW' }],
        },
      ],
      selfReportedInfo: [{ id: 'v1', imo: null, ssvid: '273000001' }],
    },
    {
      dataset: 'public-global-vessel-identity:latest',
      registryInfo: [],
      selfReportedInfo: [{ id: 'v2', imo: null, shiptype: 'OTHER_NON_FISHING' }],
    },
  ],
};

const setup = (settings: { gfwToken?: string } = { gfwToken: TOKEN }) => {
  const web = stubWeb((asked: Asked) => {
    if (asked.url.pathname === '/v3/events') return json(fixture);
    if (asked.url.pathname === '/v3/vessels') return json(vessels);
    return text('absent', 404);
  }, settings);
  const store = memoryStore();
  return {
    web,
    store,
    session: hashDatabase(),
    reach: {
      store,
      web,
      now: () => new Date('2026-10-28T10:00:00Z'),
      sleep: () => Promise.resolve(),
    },
  };
};

test('the tool reads the port visits of the anchorages and stores them once with the terms', async () => {
  const { web, store, session, reach } = setup();
  const first = await callTool(tool, session, INPUT, reach);
  expect(first).toMatchObject({
    ok: true,
    output: {
      status: 'stored',
      events: 2,
      total: 2,
      nextOffset: null,
      licence: 'CC BY-NC 4.0',
      citation: 'Global Fishing Watch',
    },
  });
  const params = web.asked[0]?.url.searchParams;
  expect(params?.get('datasets[0]')).toBe('public-global-port-visits-events:latest');
  expect(params?.get('types[0]')).toBe('PORT_VISIT');
  expect(params?.get('vessel-types[0]')).toBe('CARGO');
  expect(params?.get('confidences[0]')).toBe('3');
  expect(params?.get('confidences[1]')).toBe('4');
  expect(first).toMatchObject({ output: { imos: ['9000001'] } });
  expect(params?.get('port-ids[0]')).toBe('rus-primorsk');
  expect(params?.get('port-ids[1]')).toBe('rus-ust-luga');
  expect(params?.get('start-date')).toBe('2026-01-01');
  expect(params?.get('end-date')).toBe('2026-02-01');

  expect(store.puts).toHaveLength(2);
  const stored = new TextDecoder().decode(store.puts[0]?.bytes);
  expect(JSON.parse(stored)).toMatchObject({
    licence: 'CC BY-NC 4.0',
    citation: 'Global Fishing Watch',
    limit: expect.stringContaining('AIS only') as unknown,
    response: fixture,
  });

  const second = await callTool(tool, session, INPUT, reach);
  expect(second).toMatchObject({ ok: true, output: { status: 'known' } });
  expect(store.puts).toHaveLength(2);
});

test('the token goes in a header and never in an address, a document or a stored value', async () => {
  const { web, store, session, reach } = setup();
  await callTool(tool, session, INPUT, reach);
  for (const asked of web.asked) {
    expect(asked.headers['authorization']).toBe(`Bearer ${TOKEN}`);
    expect(asked.url.href).not.toContain(TOKEN);
  }
  for (const put of store.puts) expect(new TextDecoder().decode(put.bytes)).not.toContain(TOKEN);
  for (const values of session.stored) expect(JSON.stringify(values)).not.toContain(TOKEN);
});

test('the order of the anchorages makes no new document', async () => {
  const { store, session, reach } = setup();
  await callTool(tool, session, INPUT, reach);
  await callTool(
    tool,
    session,
    { ...INPUT, anchorageIds: [...INPUT.anchorageIds].reverse() },
    reach,
  );
  expect(store.puts).toHaveLength(2);
});

test('with no token the tool refuses, names the setting and asks nothing', async () => {
  const { web, session, reach } = setup({});
  const outcome = await callTool(tool, session, INPUT, reach);
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('GFW_API_TOKEN') as unknown,
  });
  expect(web.asked).toHaveLength(0);
});

test('a window that does not run forward is refused', async () => {
  const { session, reach } = setup();
  const outcome = await callTool(tool, session, { ...INPUT, to: INPUT.from }, reach);
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('from comes before to') as unknown,
  });
});

test('a value outside the documentation is refused before the call, with the valid values', async () => {
  const { web, session, reach } = setup();
  const cases: [Record<string, unknown>, string][] = [
    [{ vesselType: 'TANKER' }, 'SEISMIC_VESSEL'],
    [{ anchorageIds: ['RUS-PRIMORSK'] }, 'lower case'],
    [{ confidences: [1] }, 'confidences'],
  ];
  for (const [bad, word] of cases) {
    const outcome = await callTool(tool, session, { ...INPUT, ...bad }, reach);
    expect(outcome).toMatchObject({ ok: false });
    expect(JSON.stringify(outcome)).toContain(word);
  }
  expect(web.asked).toHaveLength(0);
});

test('a refusal of GFW shows the body of the error and never the token', async () => {
  const web = stubWeb(
    () => json({ error: `bad filter for ${TOKEN}`, messages: ['port-ids is not valid'] }, 422),
    { gfwToken: TOKEN },
  );
  const reach = { store: memoryStore(), web, now: () => new Date('2026-10-28T10:00:00Z') };
  const result = await callTool(tool, hashDatabase(), INPUT, reach);
  expect(result).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('answered 422') as unknown,
  });
  const message = JSON.stringify(result);
  expect(message).toContain('port-ids is not valid');
  expect(message).not.toContain(TOKEN);
});

test('the registry step reads the vessel ids in one call, stores the answer and fills the IMO', async () => {
  const { web, store, session, reach } = setup();
  const result = await callTool(tool, session, INPUT, reach);
  const asked = web.asked.filter((a) => a.url.pathname === '/v3/vessels');
  expect(asked).toHaveLength(1);
  expect(asked[0]?.url.searchParams.get('ids[0]')).toBe('v1');
  expect(asked[0]?.url.searchParams.get('ids[1]')).toBe('v2');
  expect(asked[0]?.url.searchParams.get('datasets[0]')).toBe(
    'public-global-vessel-identity:latest',
  );
  expect(result).toMatchObject({
    ok: true,
    output: {
      imos: ['9000001'],
      withoutRegistry: 1,
      vessels: [
        { vesselId: 'v1', imo: '9000001', tanker: true, inRegistry: true },
        { vesselId: 'v2', imo: null, tanker: false, inRegistry: false },
      ],
    },
  });
  const second = new TextDecoder().decode(store.puts[1]?.bytes);
  expect(JSON.parse(second)).toMatchObject({ licence: 'CC BY-NC 4.0', response: vessels });
});

test('tankersOnly keeps the tanker vessels and counts the vessels with no registry record', async () => {
  const { session, reach } = setup();
  const result = await callTool(tool, session, { ...INPUT, tankersOnly: true }, reach);
  expect(result).toMatchObject({
    ok: true,
    output: { events: 1, imos: ['9000001'], withoutRegistry: 1 },
  });
  expect(JSON.stringify(result)).not.toContain('"vesselId":"v2"');
});

test('many vessel ids go in batches with a pause, and a 429 of the Vessels API is a refusal', async () => {
  const many = {
    ...fixture,
    entries: Array.from({ length: 45 }, (_, n) => ({
      id: `pv${String(n)}`,
      type: 'port_visit',
      vessel: { id: `vessel-${String(n).padStart(3, '0')}` },
    })),
  };
  let limited = false;
  const web = stubWeb(
    (asked: Asked) =>
      asked.url.pathname === '/v3/events'
        ? json(many)
        : limited
          ? text('slow down', 429)
          : json({ entries: [] }),
    { gfwToken: TOKEN },
  );
  const pauses: number[] = [];
  const reach = {
    store: memoryStore(),
    web,
    now: () => new Date('2026-10-28T10:00:00Z'),
    sleep: (ms: number) => {
      pauses.push(ms);
      return Promise.resolve();
    },
  };
  const ok = await callTool(tool, hashDatabase(), INPUT, reach);
  expect(ok).toMatchObject({ ok: true, output: { withoutRegistry: 45 } });
  expect(web.asked.filter((a) => a.url.pathname === '/v3/vessels')).toHaveLength(3);
  expect(pauses).toEqual([1000, 1000]);
  limited = true;
  const refused = await callTool(tool, hashDatabase(), { ...INPUT, offset: 200 }, reach);
  expect(refused).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('429') as unknown,
  });
});
