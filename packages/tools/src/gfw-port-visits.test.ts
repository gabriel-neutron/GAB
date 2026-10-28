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
  from: '2026-01-01',
  to: '2026-02-01',
};

const fixture = {
  total: 2,
  nextOffset: null,
  entries: [
    { id: 'pv1', type: 'port_visit', vessel: { id: 'v1', ssvid: '273000001', type: 'TANKER' } },
    { id: 'pv2', type: 'port_visit', vessel: { id: 'v2', ssvid: '273000002', type: 'TANKER' } },
  ],
};

const setup = (settings: { gfwToken?: string } = { gfwToken: TOKEN }) => {
  const web = stubWeb((asked: Asked) => {
    if (asked.url.pathname === '/v3/events') return json(fixture);
    return text('absent', 404);
  }, settings);
  const store = memoryStore();
  return {
    web,
    store,
    session: hashDatabase(),
    reach: { store, web, now: () => new Date('2026-10-28T10:00:00Z') },
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
  expect(params?.get('vesselTypes[0]')).toBe('TANKER');
  expect(params?.get('portIds[0]')).toBe('rus-primorsk');
  expect(params?.get('portIds[1]')).toBe('rus-ust-luga');
  expect(params?.get('start-date')).toBe('2026-01-01');
  expect(params?.get('end-date')).toBe('2026-02-01');

  expect(store.puts).toHaveLength(1);
  const stored = new TextDecoder().decode(store.puts[0]?.bytes);
  expect(JSON.parse(stored)).toMatchObject({
    licence: 'CC BY-NC 4.0',
    citation: 'Global Fishing Watch',
    limit: expect.stringContaining('AIS only') as unknown,
    response: fixture,
  });

  const second = await callTool(tool, session, INPUT, reach);
  expect(second).toMatchObject({ ok: true, output: { status: 'known' } });
  expect(store.puts).toHaveLength(1);
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
  expect(store.puts).toHaveLength(1);
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
