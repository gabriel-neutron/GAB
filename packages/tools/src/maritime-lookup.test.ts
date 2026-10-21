// The two maritime lookups, offline: a web that answers from a table, a store in memory and a
// database that is a map of hashes. No test reaches the network.

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type Tool, type ToolOutcome } from './tool.ts';
import { hashDatabase, json, noSql, stubWeb, text, type Asked } from './web-stub.ts';

const refusalOf = (outcome: ToolOutcome): string => (outcome.ok ? '' : outcome.refusal);

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const setup = (web: ReturnType<typeof stubWeb>) => {
  const store = memoryStore();
  return {
    store,
    session: hashDatabase(),
    reach: { store, web, now: () => new Date('2026-10-05T10:00:00Z') },
  };
};

test('the catalogue holds the two maritime lookups', () => {
  const names = CATALOGUE.map((tool) => tool.name);
  expect(names).toContain('sanctions_match');
  expect(names).toContain('vessel_events');
});

const OS_KEY = 'os-secret-1';
const ENTITY = 'NK-abc123';
const IMO = '9321483';

const entity = {
  id: ENTITY,
  caption: 'Sea Star',
  schema: 'Vessel',
  datasets: ['us_ofac_sdn'],
  properties: {
    sanctions: [
      {
        schema: 'Sanction',
        properties: {
          authority: ['OFAC'],
          sourceUrl: ['https://sanctionssearch.ofac.treas.gov/Details.aspx?id=1'],
          program: ['IRAN'],
        },
      },
      { schema: 'Sanction', properties: {} },
    ],
  },
};

const osWeb = (settings: { openSanctionsKey?: string } = { openSanctionsKey: OS_KEY }) =>
  stubWeb((asked: Asked) => {
    const path = asked.url.pathname;
    if (path === `/entities/${ENTITY}`) return json(entity);
    if (path === '/search/default')
      return json({
        results: [{ id: ENTITY, caption: 'Sea Star', schema: 'Vessel', datasets: ['us_ofac_sdn'] }],
      });
    return text('absent', 404);
  }, settings);

test('sanctions_match stores one entity once and sends the reader to the official entry', async () => {
  const { store, session, reach } = setup(osWeb());
  const tool = toolNamed('sanctions_match');
  const first = await callTool(tool, session, { entityId: ENTITY }, reach);
  expect(first).toMatchObject({
    ok: true,
    output: {
      entity: {
        id: ENTITY,
        caption: 'Sea Star',
        schema: 'Vessel',
        datasets: ['us_ofac_sdn'],
        status: 'stored',
        entries: [
          {
            authority: 'OFAC',
            sourceUrl: 'https://sanctionssearch.ofac.treas.gov/Details.aspx?id=1',
          },
        ],
      },
      leads: [],
      repeater: expect.stringContaining('official entry') as unknown,
    },
  });
  expect(store.puts).toHaveLength(1);
  expect(session.stored[0]?.[8]).toBe('api');
  const second = await callTool(tool, session, { entityId: ENTITY }, reach);
  expect(second).toMatchObject({ ok: true, output: { entity: { status: 'known' } } });
  expect(store.puts).toHaveLength(1);
});

test('the key goes in a header and never in an address or a stored value', async () => {
  const web = osWeb();
  const { session, reach } = setup(web);
  await callTool(toolNamed('sanctions_match'), session, { entityId: ENTITY }, reach);
  for (const asked of web.asked) {
    expect(asked.headers['authorization']).toBe(`ApiKey ${OS_KEY}`);
    expect(asked.url.href).not.toContain(OS_KEY);
  }
  for (const values of session.stored) expect(JSON.stringify(values)).not.toContain(OS_KEY);
});

test('a search by IMO number or by name is a list of leads and stores nothing', async () => {
  const web = osWeb();
  const { store, reach } = setup(web);
  const tool = toolNamed('sanctions_match');
  const byImo = await callTool(tool, noSql, { imo: `IMO ${IMO}` }, reach);
  expect(byImo).toMatchObject({
    ok: true,
    output: {
      entity: null,
      leads: [{ id: ENTITY, caption: 'Sea Star', schema: 'Vessel', datasets: ['us_ofac_sdn'] }],
    },
  });
  expect(web.asked[0]?.url.searchParams.get('q')).toBe(IMO);
  expect(web.asked[0]?.url.searchParams.get('schema')).toBe('Vessel');
  await callTool(tool, noSql, { name: 'Sea Star', schema: 'Company' }, reach);
  expect(web.asked[1]?.url.searchParams.get('schema')).toBe('Company');
  expect(store.puts).toStrictEqual([]);
});

test('sanctions_match with no key refuses, names the setting and asks nothing', async () => {
  const web = osWeb({});
  const outcome = await callTool(
    toolNamed('sanctions_match'),
    noSql,
    { entityId: ENTITY },
    { store: memoryStore(), web, now: () => new Date() },
  );
  expect(refusalOf(outcome)).toContain('OPENSANCTIONS_API_KEY');
  expect(web.asked).toStrictEqual([]);
});

test('sanctions_match refuses with a sentence that says what to correct', async () => {
  const { session, reach } = setup(osWeb());
  const tool = toolNamed('sanctions_match');
  expect(refusalOf(await callTool(tool, session, {}, reach))).toContain('entityId');
  expect(refusalOf(await callTool(tool, session, { imo: '9321484' }, reach))).toContain(
    'check digit',
  );
  expect(refusalOf(await callTool(tool, session, { imo: '12' }, reach))).toContain('seven digits');
  expect(refusalOf(await callTool(tool, session, { imo: IMO, name: 'Sea Star' }, reach))).toContain(
    'one of',
  );
  expect(refusalOf(await callTool(tool, session, { entityId: 'a/b?c' }, reach))).toContain(
    'entityId',
  );
  expect(await callTool(tool, session, { entityId: 'NK-missing' }, reach)).toStrictEqual({
    ok: false,
    refusal: 'OpenSanctions holds no entity NK-missing',
  });
  expect(
    await callTool(tool, session, { entityId: ENTITY }, { now: () => new Date() }),
  ).toMatchObject({
    ok: false,
  });
});

const VESSEL = 'abc12345-def6';
const MMSI = '412345678';
const GFW_TOKEN = 'gfw-secret-1';

const events = {
  entries: [
    {
      id: 'ev1',
      type: 'loitering',
      start: '2026-01-02T00:00:00Z',
      end: '2026-01-03T00:00:00Z',
      position: { lat: 1.5, lon: 2.5 },
    },
    { id: 'ev2', type: 'gap', start: '2026-02-01T00:00:00Z', end: null },
    { id: 'ev4', type: 'port_visit', start: '2026-02-07T00:00:00Z', port_visit: {} },
    {
      id: 'ev3',
      type: 'port_visit',
      start: '2026-02-05T00:00:00Z',
      end: '2026-02-06T00:00:00Z',
      position: { lat: 59.7, lon: 28.4 },
      port_visit: {
        startAnchorage: {
          id: 'rus-ust-luga',
          name: 'UST LUGA',
          flag: 'RUS',
          atDock: true,
          lat: 59.68,
          lon: 28.4,
        },
      },
    },
  ],
  nextOffset: 200,
};

const gfwWeb = (
  identities: unknown[][] = [[{ id: VESSEL, ssvid: MMSI }]],
  registry: (readonly { imo: string }[])[] = [],
) =>
  stubWeb(
    (asked: Asked) => {
      const path = asked.url.pathname;
      if (path === '/v3/events') return json(events);
      if (path === '/v3/vessels/search')
        return json({
          entries: identities.map((selfReportedInfo, at) => ({
            selfReportedInfo,
            registryInfo: registry[at] ?? [],
          })),
        });
      return text('absent', 404);
    },
    { gfwToken: GFW_TOKEN },
  );

const RANGE = { from: '2026-01-01', to: '2026-03-01' };

test('vessel_events stores the events of one vessel once, and gives the plain fields', async () => {
  const web = gfwWeb();
  const { store, session, reach } = setup(web);
  const tool = toolNamed('vessel_events');
  const first = await callTool(tool, session, { vesselId: VESSEL, ...RANGE }, reach);
  expect(first).toMatchObject({
    ok: true,
    output: {
      status: 'stored',
      matchedBy: 'vesselId',
      vesselIds: [VESSEL],
      lead: null,
      nextOffset: 200,
      events: [
        { id: 'ev1', type: 'loitering', lat: 1.5, lon: 2.5, end: '2026-01-03T00:00:00Z' },
        { id: 'ev2', type: 'gap', lat: null, lon: null, end: null, anchorage: null },
        { id: 'ev4', type: 'port_visit', anchorage: null },
        {
          id: 'ev3',
          type: 'port_visit',
          anchorage: { id: 'rus-ust-luga', name: 'UST LUGA', flag: 'RUS', atDock: true },
        },
      ],
    },
  });
  expect(store.puts).toHaveLength(1);
  expect(session.stored[0]?.[8]).toBe('api');
  expect(web.asked[0]?.headers['authorization']).toBe(`Bearer ${GFW_TOKEN}`);
  expect(web.asked[0]?.url.href).not.toContain(GFW_TOKEN);
  expect(web.asked[0]?.url.searchParams.get('vessels[0]')).toBe(VESSEL);
  expect(web.asked[0]?.url.searchParams.get('start-date')).toBe('2026-01-01');
  const second = await callTool(tool, session, { vesselId: VESSEL, ...RANGE }, reach);
  expect(second).toMatchObject({ ok: true, output: { status: 'known' } });
  expect(JSON.stringify(first)).not.toContain('"near"');
  expect(store.puts).toHaveLength(1);
});

test('a match by MMSI is a lead: the search is not stored and the output says so', async () => {
  const web = gfwWeb();
  const { store, session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('vessel_events'),
    session,
    { mmsi: MMSI, ...RANGE },
    reach,
  );
  expect(outcome).toMatchObject({
    ok: true,
    output: {
      matchedBy: 'mmsi',
      vesselIds: [VESSEL],
      lead: expect.stringContaining('MMSI') as unknown,
    },
  });
  expect(web.asked.map((asked) => asked.url.pathname)).toStrictEqual([
    '/v3/vessels/search',
    '/v3/events',
  ]);
  expect(store.puts).toHaveLength(1);
});

test('an MMSI that names two identities is refused, and the events are not read', async () => {
  const web = gfwWeb([[{ id: 'aaaaaaaa-1', ssvid: MMSI }], [{ id: 'bbbbbbbb-2', ssvid: MMSI }]]);
  const { session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('vessel_events'),
    session,
    { mmsi: MMSI, ...RANGE },
    reach,
  );
  expect(refusalOf(outcome)).toContain('vesselId');
  expect(web.asked).toHaveLength(1);
});

test('an IMO number found in the registry info reads the events and is no lead', async () => {
  const web = gfwWeb([[{ id: VESSEL, ssvid: MMSI }]], [[{ imo: IMO }]]);
  const { store, session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('vessel_events'),
    session,
    { imo: IMO, ...RANGE },
    reach,
  );
  expect(outcome).toMatchObject({
    ok: true,
    output: { matchedBy: 'imo', vesselIds: [VESSEL], lead: null },
  });
  expect(web.asked[0]?.url.searchParams.get('query')).toBe(IMO);
  expect(store.puts).toHaveLength(1);
});

test('an IMO number that the registry info does not hold is refused', async () => {
  const tool = toolNamed('vessel_events');
  // A near miss of the fuzzy search, and an IMO number that only the crew reports.
  for (const registry of [[[{ imo: '9074730' }]], [[]]]) {
    const web = gfwWeb([[{ id: VESSEL, ssvid: MMSI }]], registry);
    const { session, reach } = setup(web);
    const outcome = await callTool(tool, session, { imo: IMO, ...RANGE }, reach);
    expect(refusalOf(outcome)).toContain(`no vessel with the IMO ${IMO}`);
    expect(web.asked).toHaveLength(1);
  }
});

test('two identities of one IMO number are described so that a reader can choose', async () => {
  const web = gfwWeb(
    [
      [
        {
          id: 'aaaaaaaa-1',
          ssvid: MMSI,
          shipname: 'ALPHA',
          flag: 'PAN',
          vesselType: 'carrier',
          transmissionDateFrom: '2020-01-01T00:00:00Z',
          transmissionDateTo: '2021-01-01T00:00:00Z',
        },
        {
          id: 'aaaaaaaa-3',
          ssvid: MMSI,
          transmissionDateFrom: '2019-06-01T00:00:00Z',
          transmissionDateTo: '2020-06-01T00:00:00Z',
        },
      ],
      [{ id: 'bbbbbbbb-2', ssvid: '273000001', shipname: 'BETA', flag: 'RUS' }],
    ],
    [[{ imo: IMO }], [{ imo: IMO }]],
  );
  const { session, reach } = setup(web);
  const refusal = refusalOf(
    await callTool(toolNamed('vessel_events'), session, { imo: IMO, ...RANGE }, reach),
  );
  expect(refusal).toContain('names 2 vessel identities');
  expect(refusal).toContain(
    JSON.stringify({
      vesselIds: ['aaaaaaaa-1', 'aaaaaaaa-3'],
      name: 'ALPHA',
      mmsi: MMSI,
      flag: 'PAN',
      vesselType: 'carrier',
      firstSeen: '2019-06-01T00:00:00Z',
      lastSeen: '2021-01-01T00:00:00Z',
      imo: IMO,
    }),
  );
  expect(refusal).toContain('"name":"BETA","mmsi":"273000001","flag":"RUS"');
  expect(web.asked).toHaveLength(1);
});

test('the answer of one identity gives its details', async () => {
  const web = gfwWeb([[{ id: VESSEL, ssvid: MMSI, shipname: 'ALPHA' }]], [[{ imo: IMO }]]);
  const { session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('vessel_events'),
    session,
    { imo: IMO, ...RANGE },
    reach,
  );
  expect(outcome).toMatchObject({
    ok: true,
    output: { identities: [{ vesselIds: [VESSEL], name: 'ALPHA', mmsi: MMSI, imo: IMO }] },
  });
});

test('an IMO number that two registry entries hold is refused, and the events are not read', async () => {
  const web = gfwWeb(
    [[{ id: 'aaaaaaaa-1', ssvid: MMSI }], [{ id: 'bbbbbbbb-2', ssvid: MMSI }]],
    [[{ imo: IMO }], [{ imo: IMO }]],
  );
  const { session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('vessel_events'),
    session,
    { imo: IMO, ...RANGE },
    reach,
  );
  expect(refusalOf(outcome)).toContain('aaaaaaaa-1');
  expect(web.asked).toHaveLength(1);
});

test('an IMO number of the wrong size, or two vessel keys, are refused', async () => {
  const { session, reach } = setup(gfwWeb());
  const tool = toolNamed('vessel_events');
  expect(refusalOf(await callTool(tool, session, { imo: '123456', ...RANGE }, reach))).toContain(
    'seven digits',
  );
  expect(
    refusalOf(await callTool(tool, session, { imo: IMO, mmsi: MMSI, ...RANGE }, reach)),
  ).toContain('one of vesselId, mmsi or imo');
});

test('vessel_events with no token refuses, names the setting and asks nothing', async () => {
  const web = stubWeb(() => json({}));
  const outcome = await callTool(
    toolNamed('vessel_events'),
    noSql,
    { vesselId: VESSEL, ...RANGE },
    { store: memoryStore(), web, now: () => new Date() },
  );
  expect(refusalOf(outcome)).toContain('GFW_API_TOKEN');
  expect(web.asked).toStrictEqual([]);
});

test('vessel_events refuses with a sentence that says what to correct', async () => {
  const { session, reach } = setup(gfwWeb());
  const tool = toolNamed('vessel_events');
  expect(refusalOf(await callTool(tool, session, RANGE, reach))).toContain(
    'one of vesselId, mmsi or imo',
  );
  expect(refusalOf(await callTool(tool, session, { mmsi: '12', ...RANGE }, reach))).toContain(
    'nine digits',
  );
  expect(
    refusalOf(
      await callTool(
        tool,
        session,
        { vesselId: VESSEL, from: '2026-03-01', to: '2026-01-01' },
        reach,
      ),
    ),
  ).toContain('from comes before to');
  expect(
    refusalOf(
      await callTool(tool, session, { vesselId: VESSEL, from: '1 Jan', to: '2026-01-01' }, reach),
    ),
  ).toContain('YYYY-MM-DD');
  expect(
    refusalOf(await callTool(tool, session, { mmsi: '999999999', ...RANGE }, reach)),
  ).toContain('no vessel with the MMSI 999999999');
});

test('an entity that moved to another id is refused with the new id, and the redirect is not followed', async () => {
  const web = stubWeb(
    () =>
      text('', 308, { location: 'https://api.opensanctions.org/entities/NK-new123?nested=true' }),
    { openSanctionsKey: OS_KEY },
  );
  const { store, session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('sanctions_match'),
    session,
    { entityId: ENTITY },
    reach,
  );
  expect(refusalOf(outcome)).toContain('NK-new123');
  expect(refusalOf(outcome)).toContain('read that id');
  expect(web.asked).toHaveLength(1);
  expect(store.puts).toStrictEqual([]);
});

test('the same read in another order of types has one address and one document', async () => {
  const web = gfwWeb();
  const { store, session, reach } = setup(web);
  const tool = toolNamed('vessel_events');
  await callTool(tool, session, { vesselId: VESSEL, ...RANGE, types: ['gap', 'encounter'] }, reach);
  await callTool(tool, session, { vesselId: VESSEL, ...RANGE, types: ['encounter', 'gap'] }, reach);
  expect(web.asked[0]?.url.href).toBe(web.asked[1]?.url.href);
  expect(web.asked[0]?.url.searchParams.get('datasets[0]')).toContain('encounters');
  expect(store.puts).toHaveLength(1);
});

test('vessel_events reads the port visits of a vessel from the port visit dataset', async () => {
  const web = gfwWeb();
  const { session, reach } = setup(web);
  const tool = toolNamed('vessel_events');
  await callTool(tool, session, { vesselId: VESSEL, ...RANGE, types: ['port_visit'] }, reach);
  expect(web.asked[0]?.url.searchParams.get('datasets[0]')).toBe(
    'public-global-port-visits-events:latest',
  );
  await callTool(tool, session, { vesselId: VESSEL, ...RANGE }, reach);
  expect(web.asked[1]?.url.searchParams.get('datasets[3]')).toBe(
    'public-global-port-visits-events:latest',
  );
});

test('nearKm keeps the events near a terminal of the record and names the nearest one', async () => {
  const web = gfwWeb();
  const { session, reach } = setup(web);
  const site = { id: 'site-1', label: 'Ust-Luga terminal', lat: 59.7, lon: 28.4 };
  const withSites = {
    ...session,
    query: (statement: string, values: unknown[]) =>
      statement.includes("'export_terminal'")
        ? Promise.resolve({ rows: [site] })
        : session.query(statement, values),
  };
  const outcome = await callTool(
    toolNamed('vessel_events'),
    withSites,
    { vesselId: VESSEL, ...RANGE, nearKm: 3 },
    reach,
  );
  expect(outcome).toMatchObject({ ok: true });
  const output = outcome.ok
    ? (outcome.output as { events: { id: string; near: unknown }[] })
    : null;
  const kept = output?.events ?? [];
  expect(kept.map((event) => event.id)).toStrictEqual(['ev3']);
  expect(kept[0]?.near).toMatchObject({ id: 'site-1', name: 'Ust-Luga terminal' });
});

test('an MMSI search that answers 404 is a vessel that is not known', async () => {
  const web = stubWeb(() => text('absent', 404), { gfwToken: GFW_TOKEN });
  const { session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('vessel_events'),
    session,
    { mmsi: MMSI, ...RANGE },
    reach,
  );
  expect(refusalOf(outcome)).toContain(`knows no vessel with the MMSI ${MMSI}`);
});
