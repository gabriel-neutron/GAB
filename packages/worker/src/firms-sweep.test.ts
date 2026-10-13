// The FIRMS sweep, offline: recorded answers, a store in memory, and a session that knows the
// stored documents by address. No test reaches the network.

import { memoryStore } from '@gab/tools/fetch-fixture';
import type { Session } from '@gab/tools/tool';
import { hashDatabase, json, stubWeb, text } from '@gab/tools/web-stub';
import { expect, test } from 'vitest';

import { flareSites, quartersOf, sweepFirms, type Site } from './firms-sweep.ts';

const KEY = 'firms-secret-key-1';
const AVAILABILITY = [
  'data_id,min_date,max_date',
  'VIIRS_SNPP_SP,2012-01-19,2026-05-31',
  'VIIRS_SNPP_NRT,2026-05-20,2026-10-06',
].join('\n');
const TABLE = 'latitude,longitude,acq_date,acq_time\n51.1,45.2,2026-06-01,0120\n';
const SITE: Site = { name: 'refinery', west: 45, south: 51, east: 45.1, north: 51.1 };

// The session adds the lookup of stored addresses to the hash database of the tool tests.
const setup = () => {
  const inner = hashDatabase();
  const session: Session & { stored: unknown[][] } = {
    stored: inner.stored,
    query: (statement, values) =>
      statement.includes('d.uri LIKE')
        ? Promise.resolve({
            rows: inner.stored
              .map((row) => ({ uri: String(row[2]) }))
              .filter((row) => row.uri.startsWith(String(values[0]).slice(0, -1))),
          })
        : inner.query(statement, values),
  };
  return { session, store: memoryStore() };
};

const readerOf = (
  limit: number | (() => number),
  options: { areaStatus?: number; availability?: string } = {},
) => {
  let used = 0;
  const web = stubWeb(
    (asked) => {
      const path = asked.url.pathname;
      if (path.startsWith('/api/data_availability/'))
        return text(options.availability ?? AVAILABILITY);
      if (path.startsWith('/mapserver/mapkey_status'))
        return json({
          transaction_limit: typeof limit === 'number' ? limit : limit(),
          current_transactions: used,
        });
      used += 1;
      return options.areaStatus === undefined ? text(TABLE) : text('refused', options.areaStatus);
    },
    { firmsKey: KEY },
  );
  return web;
};

const reachOf = (
  web: ReturnType<typeof readerOf>,
  store: ReturnType<typeof memoryStore>,
  sleep: () => Promise<void> = () => Promise.resolve(),
) => ({
  web,
  store,
  now: () => new Date('2026-10-05T10:00:00Z'),
  sleep,
});

test('quarters stop before the day of the run', () => {
  expect(quartersOf('2026-01-15', '2026-10-05')).toEqual([
    ['2026-01-15', '2026-03-31'],
    ['2026-04-01', '2026-06-30'],
    ['2026-07-01', '2026-09-30'],
  ]);
});

test('a run that stops at the rate limit goes on where it stopped, and a daily run adds new days', async () => {
  const { session, store } = setup();
  // The limit leaves room for two quarters, so the third stops the first run.
  const first = await sweepFirms(session, reachOf(readerOf(150), store), [SITE], '2026-01-01');
  expect(first).toMatchObject({ stored: 2, stopped: true, failed: [] });

  const web = readerOf(5000);
  const second = await sweepFirms(session, reachOf(web, store), [SITE], '2026-01-01');
  expect(second).toMatchObject({ stored: 2, skipped: 2, stopped: false });
  // Only the third quarter and the days after it are read: nothing before 1 July is asked.
  const starts = web.asked
    .map((asked) => asked.url.pathname)
    .filter((path) => path.startsWith('/api/area/'))
    .map((path) => path.split('/').at(-1) ?? '');
  expect(starts.every((start) => start >= '2026-07-01')).toBe(true);

  const stored = session.stored.map((row) => String(row[2]));
  expect(stored).toContain(
    'https://firms.modaps.eosdis.nasa.gov/api/area/csv/45,51,45.1,51.1/2026-10-01/2026-10-04',
  );

  // The next day only the new day is read.
  const later = readerOf(5000);
  const tomorrow = { ...reachOf(later, store), now: () => new Date('2026-10-06T10:00:00Z') };
  expect(await sweepFirms(session, tomorrow, [SITE], '2026-01-01')).toMatchObject({
    stored: 1,
    skipped: 3,
  });
  expect(session.stored.at(-1)?.[2]).toBe(
    'https://firms.modaps.eosdis.nasa.gov/api/area/csv/45,51,45.1,51.1/2026-10-05/2026-10-05',
  );
  expect(JSON.stringify(session.stored)).not.toContain(KEY);
});

test('the flare table gives one tile for each cell that holds a flare', async () => {
  const table = 'lat,lon\n51.1,45.2\n51.4,45.4\n60.9,70.1\n,\n';
  const session: Session = { query: () => Promise.resolve({ rows: [{ text: table }] }) };
  const sites = await flareSites(session, {
    document: 'doc',
    set: 'flares',
    latitude: 'lat',
    longitude: 'lon',
  });
  expect(sites.map((site) => [site.west, site.south, site.east, site.north])).toEqual([
    [45, 51, 45.5, 51.5],
    [70, 60.5, 70.5, 61],
  ]);
});

test('a read of a gap crossing a quarter end reads only the days that no answer covers', async () => {
  const { session, store } = setup();
  const early = { ...reachOf(readerOf(5000), store), now: () => new Date('2026-07-11T10:00:00Z') };
  await sweepFirms(session, early, [SITE], '2026-06-25');
  const report = await sweepFirms(session, reachOf(readerOf(5000), store), [SITE], '2026-04-01');
  expect(report).toMatchObject({ failed: [], skipped: 0 });
  const ranges = session.stored.map((row) => String(row[2]).split('/').slice(-2).join(' '));
  expect(ranges).toEqual([
    '2026-06-25 2026-06-30',
    '2026-07-01 2026-07-10',
    '2026-04-01 2026-06-24',
    '2026-07-11 2026-09-30',
    '2026-10-01 2026-10-04',
  ]);
});

test('a day that FIRMS has not published is not marked as read, and is read later', async () => {
  const { session, store } = setup();
  const late = AVAILABILITY.replace('2026-10-06', '2026-10-03');
  const first = await sweepFirms(
    session,
    reachOf(readerOf(5000, { availability: late }), store),
    [SITE],
    '2026-09-01',
  );
  expect(first).toMatchObject({ stored: 2, failed: [] });
  expect(String(session.stored.at(-1)?.[2])).toMatch(/2026-10-01\/2026-10-03$/u);
  // The next run finds the days after the 3rd, and a source that holds none of them is pending.
  const again = await sweepFirms(
    session,
    reachOf(readerOf(5000, { availability: late }), store),
    [SITE],
    '2026-09-01',
  );
  expect(again).toMatchObject({ stored: 0, pending: 1, failed: [] });
  const done = await sweepFirms(session, reachOf(readerOf(5000), store), [SITE], '2026-09-01');
  expect(done).toMatchObject({ stored: 1, pending: 0 });
  expect(String(session.stored.at(-1)?.[2])).toMatch(/2026-10-04\/2026-10-04$/u);
});

test('the sweep waits at the rate limit and goes on', async () => {
  const { session, store } = setup();
  let blocked = true;
  let sleeps = 0;
  const sleep = () => {
    sleeps += 1;
    blocked = false;
    return Promise.resolve();
  };
  const web = readerOf(() => (blocked ? 100 : 5000));
  const report = await sweepFirms(session, reachOf(web, store, sleep), [SITE], '2026-09-01');
  expect(sleeps).toBe(1);
  expect(report).toMatchObject({ stored: 2, stopped: false });
});

test('the sixth refusal at the rate limit stops the run, and a 429 counts as one', async () => {
  const { session, store } = setup();
  let sleeps = 0;
  const sleep = () => {
    sleeps += 1;
    return Promise.resolve();
  };
  const blocked = await sweepFirms(
    session,
    reachOf(readerOf(100), store, sleep),
    [SITE],
    '2026-09-01',
  );
  expect(blocked).toMatchObject({ stored: 0, stopped: true });
  expect(sleeps).toBe(5);
  const tooMany = await sweepFirms(
    session,
    reachOf(readerOf(5000, { areaStatus: 429 }), store, sleep),
    [SITE],
    '2026-09-01',
  );
  expect(tooMany).toMatchObject({ stopped: true });
});

test('another refusal is listed, and the same sentence five times stops the run', async () => {
  const { session, store } = setup();
  const web = () => readerOf(5000, { areaStatus: 403 });
  const one = await sweepFirms(session, reachOf(web(), store), [SITE], '2026-09-01');
  expect(one.failed).toEqual([
    'refinery 2026-09-01 to 2026-09-30: NASA FIRMS answered 403',
    'refinery 2026-10-01 to 2026-10-04: NASA FIRMS answered 403',
  ]);
  expect(one.aborted).toBeUndefined();
  const sites = [1, 2, 3].map((n) => ({ ...SITE, west: SITE.west + n / 100 }));
  const many = await sweepFirms(session, reachOf(web(), store), sites, '2026-01-01');
  expect(many.failed).toHaveLength(5);
  expect(many.aborted).toBe('NASA FIRMS answered 403');
});
