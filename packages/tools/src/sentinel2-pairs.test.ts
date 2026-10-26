// The Sentinel-2 pair tool, offline: a web that answers from recorded answers in the assumed shape
// of the Sentinel Hub APIs of the Copernicus Data Space, a store in memory and a database that is
// a map of hashes. No test reaches the network, and no test spends a unit of the quota.

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type ToolOutcome } from './tool.ts';
import { bytes, hashDatabase, stubWeb, text, type AskedPost } from './web-stub.ts';

const ID = 'client-id-1';
const SECRET = 'client-secret-1';
const TOKEN = 'token-value-1';
const tool = CATALOGUE.find((entry) => entry.name === 'sentinel2_pairs');
if (tool === undefined) throw new Error('the catalogue holds no sentinel2_pairs');

const JPEG = (seed: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, seed]);

interface Scenes {
  /** The scenes of the catalogue as [id, datetime]. */
  readonly scenes: readonly (readonly [string, string])[];
  /** The cloud share of each day. A day with no entry has no statistics. */
  readonly clouds: Readonly<Record<string, number>>;
}

// The strike is on 2026-05-15, so the window before is 05-01 to 05-14 and after is 05-16 to 05-30.
const FULL: Scenes = {
  scenes: [
    ['S2B_before_far', '2026-05-03T08:50:00Z'],
    ['S2B_before_near', '2026-05-13T08:50:00Z'],
    ['S2A_strike_day', '2026-05-15T08:50:00Z'],
    ['S2A_after_near', '2026-05-18T08:50:00Z'],
    ['S2B_after_far', '2026-05-23T08:50:00Z'],
  ],
  clouds: {
    '2026-05-03': 0.02,
    '2026-05-13': 0.01,
    '2026-05-15': 0,
    '2026-05-18': 0.05,
    '2026-05-23': 0.04,
  },
};

const setup = (scenes: Scenes = FULL, options: { token?: number; tokenLife?: number } = {}) => {
  let image = 0;
  const poster = (asked: AskedPost) => {
    const path = asked.url.pathname;
    if (path.endsWith('/token'))
      return options.token === undefined || options.token === 200
        ? bytes(JSON.stringify({ access_token: TOKEN, expires_in: options.tokenLife ?? 600 }))
        : bytes('{}', options.token);
    if (path.endsWith('/catalog/1.0.0/search'))
      return bytes(
        JSON.stringify({
          features: scenes.scenes.map(([id, datetime]) => ({ id, properties: { datetime } })),
        }),
      );
    if (path.endsWith('/statistics'))
      return bytes(
        JSON.stringify({
          data: Object.entries(scenes.clouds).map(([date, mean]) => ({
            interval: { from: `${date}T00:00:00Z` },
            outputs: { cloud: { bands: { B0: { stats: { mean } } } } },
          })),
        }),
      );
    image += 1;
    return bytes(JPEG(image));
  };
  const web = stubWeb(() => text('', 404), { cdseClientId: ID, cdseClientSecret: SECRET }, poster);
  const store = memoryStore();
  const session = hashDatabase();
  const reach = { store, web, now: () => new Date('2026-10-27T10:00:00Z') };
  return { web, store, session, reach };
};

const STRIKE = { ref: 'afipsky', day: '2026-05-15', latitude: 44.86, longitude: 38.65 };
const refusalOf = (outcome: ToolOutcome): string => (outcome.ok ? '' : outcome.refusal);

const outputOf = (outcome: ToolOutcome) => {
  if (!outcome.ok) throw new Error(outcome.refusal);
  return outcome.output as {
    pair: number;
    one: number;
    none: number;
    error: number;
    results: {
      outcome: string;
      notes: string[];
      before: { image: Record<string, unknown> | null; tried: unknown[] } | null;
      after: { image: Record<string, unknown> | null } | null;
    }[];
  };
};

test('the nearest clear scene before and after gives a pair, stored with its scene, date, share, box and credit', async () => {
  const { session, reach, web } = setup();
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(output).toMatchObject({ pair: 1, one: 0, none: 0, error: 0 });
  const [result] = output.results;
  expect(result?.before?.image).toMatchObject({
    scene: 'S2B_before_near',
    date: '2026-05-13',
    cloud: 0.01,
    attribution: 'Contains modified Copernicus Sentinel data 2026',
  });
  expect(result?.after?.image).toMatchObject({ scene: 'S2A_after_near', date: '2026-05-18' });
  // The day of the strike counts for neither side.
  expect(JSON.stringify(output)).not.toContain('S2A_strike_day');
  const box = result?.before?.image?.['box'] as Record<string, number>;
  expect(box['north']).toBeGreaterThan(44.86);
  expect(box['south']).toBeLessThan(44.86);
  // One catalogue call, one statistics call, two image calls and one token for the strike.
  expect(web.posted.map((asked) => asked.url.pathname.split('/').at(-1))).toEqual([
    'token',
    'search',
    'statistics',
    'process',
    'process',
  ]);
});

test('the stored document holds the scene, the date, the share, the box and the credit in its text and no key in its address', async () => {
  const { session, reach } = setup();
  await callTool(tool, session, { strikes: [STRIKE] }, reach);
  expect(session.stored).toHaveLength(2);
  for (const values of session.stored) {
    const [title, , uri, , mime, , pages] = values.map(String);
    expect(mime).toBe('image/jpeg');
    expect(`${title}${uri}`).not.toContain(SECRET);
    expect(`${title}${uri}`).not.toContain(TOKEN);
    expect(uri).toContain('sentinel-2-l2a');
    const page = (JSON.parse(pages ?? '[]') as string[])[0] ?? '';
    expect(page).toContain('Contains modified Copernicus Sentinel data 2026.');
    expect(page).toMatch(/Scene S2[AB]_/u);
    expect(page).toContain('Cloud share over the box');
    expect(page).toContain('Box (WGS 84)');
    expect(page).toContain('states no damage');
  }
});

test('a cloudy scene is passed over for the next one, and the share comes from the classification layer', async () => {
  const { session, reach, web } = setup({
    scenes: FULL.scenes,
    clouds: { ...FULL.clouds, '2026-05-13': 0.6 },
  });
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(output.results[0]?.before?.image).toMatchObject({ scene: 'S2B_before_far' });
  const statistics = web.posted.find((asked) => asked.url.pathname.endsWith('/statistics'));
  expect(statistics?.body).toContain('SCL');
});

test('a share at the threshold is not clear', async () => {
  const { session, reach } = setup({
    scenes: [['S2B_edge', '2026-05-13T08:50:00Z']],
    clouds: { '2026-05-13': 0.2 },
  });
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(output.results[0]?.outcome).toBe('none');
});

test('one clear side gives one image, and the other side says no clear image with the dates tried', async () => {
  const { session, reach } = setup({
    scenes: FULL.scenes,
    clouds: { '2026-05-03': 0.9, '2026-05-13': 0.5, '2026-05-18': 0.0, '2026-05-23': 0.0 },
  });
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(output).toMatchObject({ pair: 0, one: 1, none: 0 });
  expect(output.results[0]?.notes).toEqual([
    'no clear image before (window 2026-04-30 to 2026-05-14): tried 2026-05-13 (50 percent cloud), ' +
      '2026-05-03 (90 percent cloud)',
  ]);
});

test('no scene in the window gives none, and the note names the window', async () => {
  const { session, reach } = setup({ scenes: [], clouds: {} });
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(output).toMatchObject({ pair: 0, one: 0, none: 1 });
  expect(output.results[0]?.notes).toEqual([
    'no clear image before (window 2026-04-30 to 2026-05-14): the catalogue holds no scene',
    'no clear image after (window 2026-05-16 to 2026-05-30): the catalogue holds no scene',
  ]);
});

test('a scene with no share for its day is not clear', async () => {
  const { session, reach } = setup({
    scenes: [['S2B_blind', '2026-05-13T08:50:00Z']],
    clouds: {},
  });
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(output.results[0]?.outcome).toBe('none');
  expect(output.results[0]?.notes[0]).toContain('2026-05-13 (no share)');
});

test('a night strike takes the scene before its first day and after its last day', async () => {
  const { session, reach } = setup({
    scenes: [
      ['S2_on_first', '2026-05-14T08:50:00Z'],
      ['S2_on_last', '2026-05-15T08:50:00Z'],
      ['S2_after', '2026-05-16T08:50:00Z'],
      ['S2_before', '2026-05-13T08:50:00Z'],
    ],
    clouds: { '2026-05-13': 0, '2026-05-14': 0, '2026-05-15': 0, '2026-05-16': 0 },
  });
  const output = outputOf(
    await callTool(
      tool,
      session,
      { strikes: [{ ...STRIKE, day: '2026-05-14', until: '2026-05-15' }] },
      reach,
    ),
  );
  expect(output.results[0]?.before?.image).toMatchObject({ scene: 'S2_before' });
  expect(output.results[0]?.after?.image).toMatchObject({ scene: 'S2_after' });
});

test('the run counts the strikes with a pair, with one image and with none', async () => {
  const { session, reach } = setup();
  const output = outputOf(
    await callTool(
      tool,
      session,
      {
        strikes: [
          STRIKE,
          // A strike in the far past: every scene of the table is after the window.
          { ...STRIKE, ref: 'old', day: '2026-01-01' },
        ],
      },
      reach,
    ),
  );
  expect(output).toMatchObject({ pair: 1, none: 1 });
});

test('the client leaves in the body of the token request and never in an address or a message', async () => {
  const { session, reach, web } = setup();
  await callTool(tool, session, { strikes: [STRIKE] }, reach);
  const [token] = web.posted;
  expect(token?.body).toContain(`client_id=${ID}`);
  expect(token?.body).toContain(`client_secret=${SECRET}`);
  for (const asked of web.posted) {
    expect(asked.url.href).not.toContain(SECRET);
    expect(asked.url.href).not.toContain(ID);
    if (asked !== token) expect(asked.body).not.toContain(SECRET);
  }
  expect(
    web.posted.filter((asked) => asked.headers['authorization'] === `Bearer ${TOKEN}`),
  ).toHaveLength(4);
});

test('the catalogue search asks for GeoJSON, the only type that the service accepts', async () => {
  const { session, reach, web } = setup();
  await callTool(tool, session, { strikes: [STRIKE] }, reach);
  const searches = web.posted.filter((asked) =>
    asked.url.pathname.endsWith('/catalog/1.0.0/search'),
  );
  expect(searches.length).toBeGreaterThan(0);
  for (const asked of searches) expect(asked.headers['accept']).toBe('application/geo+json');
});

test('the token is read again when it is about to end', async () => {
  const { session, reach, web } = setup(FULL, { tokenLife: 90 });
  await callTool(
    tool,
    session,
    { strikes: [STRIKE] },
    {
      ...reach,
      now: (() => {
        let clock = Date.parse('2026-10-27T10:00:00Z');
        return () => new Date((clock += 20_000));
      })(),
    },
  );
  expect(
    web.posted.filter((asked) => asked.url.pathname.endsWith('/token')).length,
  ).toBeGreaterThan(1);
});

test('with no client the tool refuses and names both settings', async () => {
  const { session, reach } = setup();
  const web = stubWeb(
    () => text('', 404),
    {},
    () => bytes('{}'),
  );
  const refusal = refusalOf(
    await callTool(tool, session, { strikes: [STRIKE] }, { ...reach, web }),
  );
  expect(refusal).toContain('CDSE_CLIENT_ID');
  expect(refusal).toContain('CDSE_CLIENT_SECRET');
  expect(web.posted).toHaveLength(0);
});

test('a refused token ends the run with a status and no secret', async () => {
  const { session, reach } = setup(FULL, { token: 401 });
  const refusal = refusalOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(refusal).toContain('401');
  expect(refusal).not.toContain(SECRET);
});

test('a limit of the service ends the run', async () => {
  const { session, reach } = setup();
  const web = stubWeb(
    () => text('', 404),
    { cdseClientId: ID, cdseClientSecret: SECRET },
    (asked) =>
      asked.url.pathname.endsWith('/token')
        ? bytes(JSON.stringify({ access_token: TOKEN, expires_in: 600 }))
        : bytes('slow down', 429),
  );
  expect(
    refusalOf(await callTool(tool, session, { strikes: [STRIKE] }, { ...reach, web })),
  ).toContain('429');
});

test('a fault of one strike is an error of that strike and the others go on', async () => {
  const { session, reach } = setup();
  let searches = 0;
  const web = stubWeb(
    () => text('', 404),
    { cdseClientId: ID, cdseClientSecret: SECRET },
    (asked) => {
      const path = asked.url.pathname;
      if (path.endsWith('/token'))
        return bytes(JSON.stringify({ access_token: TOKEN, expires_in: 600 }));
      if (path.endsWith('/search')) {
        searches += 1;
        return searches === 1 ? bytes('boom', 500) : bytes(JSON.stringify({ features: [] }));
      }
      return bytes(JSON.stringify({ data: [] }));
    },
  );
  const output = outputOf(
    await callTool(
      tool,
      session,
      { strikes: [STRIKE, { ...STRIKE, ref: 'second' }] },
      { ...reach, web },
    ),
  );
  expect(output).toMatchObject({ error: 1, none: 1 });
});

test('an answer that is no JPEG stores nothing', async () => {
  const { session, reach } = setup();
  const web = stubWeb(
    () => text('', 404),
    { cdseClientId: ID, cdseClientSecret: SECRET },
    (asked) => {
      const path = asked.url.pathname;
      if (path.endsWith('/token'))
        return bytes(JSON.stringify({ access_token: TOKEN, expires_in: 600 }));
      if (path.endsWith('/search'))
        return bytes(
          JSON.stringify({
            features: [{ id: 'S2B_x', properties: { datetime: '2026-05-13T08:50:00Z' } }],
          }),
        );
      if (path.endsWith('/statistics'))
        return bytes(
          JSON.stringify({
            data: [
              {
                interval: { from: '2026-05-13T00:00:00Z' },
                outputs: { cloud: { bands: { B0: { stats: { mean: 0 } } } } },
              },
            ],
          }),
        );
      return bytes('<error/>');
    },
  );
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, { ...reach, web }));
  expect(output.error).toBe(1);
  expect(session.stored).toHaveLength(0);
});

test('the same scene and box a second time is the same document', async () => {
  const { session, reach } = setup();
  const first = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  // A second web gives the same bytes for the same call.
  const again = setup();
  const twice = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, again.reach));
  expect(twice.results[0]?.before?.image?.['document']).toBe(
    first.results[0]?.before?.image?.['document'],
  );
  expect(twice.results[0]?.before?.image?.['status']).toBe('known');
});

test('a strike whose last day comes before its first day is an error of that strike only', async () => {
  const { session, reach } = setup();
  const output = outputOf(
    await callTool(
      tool,
      session,
      {
        strikes: [
          { ...STRIKE, until: '2026-05-10' },
          { ...STRIKE, ref: 'good' },
        ],
      },
      reach,
    ),
  );
  expect(output).toMatchObject({ error: 1, pair: 1 });
});

test('the statistics range ends at the start of the day after the window, so the last day has a share', async () => {
  const { session, reach, web } = setup();
  await callTool(tool, session, { strikes: [STRIKE] }, reach);
  const statistics = web.posted.find((asked) => asked.url.pathname.endsWith('/statistics'));
  expect(statistics?.body).toContain('"to":"2026-05-31T00:00:00Z"');
});

test('a full page of the catalogue is an error, and not a silent cut', async () => {
  const many = {
    scenes: Array.from({ length: 100 }, (_, at): readonly [string, string] => [
      `S2_${String(at)}`,
      '2026-05-13T08:50:00Z',
    ]),
    clouds: {},
  };
  const { session, reach } = setup(many);
  const output = outputOf(await callTool(tool, session, { strikes: [STRIKE] }, reach));
  expect(output.error).toBe(1);
});
