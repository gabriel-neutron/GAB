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

const readerOf = (limit: number) => {
  let used = 0;
  const web = stubWeb(
    (asked) => {
      const path = asked.url.pathname;
      if (path.startsWith('/api/data_availability/')) return text(AVAILABILITY);
      if (path.startsWith('/mapserver/mapkey_status'))
        return json({ transaction_limit: limit, current_transactions: used });
      used += 1;
      return text(TABLE);
    },
    { firmsKey: KEY },
  );
  return web;
};

const reachOf = (web: ReturnType<typeof readerOf>, store: ReturnType<typeof memoryStore>) => ({
  web,
  store,
  now: () => new Date('2026-10-05T10:00:00Z'),
  sleep: () => Promise.resolve(),
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
