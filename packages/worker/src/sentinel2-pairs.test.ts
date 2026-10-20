// The strike run, offline: a session that answers the query of strikes from rows, a web that
// answers from recorded answers, and a store in memory. No test reaches the network.

import { memoryStore } from '@gab/tools/fetch-fixture';
import type { Session } from '@gab/tools/tool';
import { bytes, hashDatabase, stubWeb, text } from '@gab/tools/web-stub';
import { expect, test } from 'vitest';

import { pairStrikes, strikesOf } from './sentinel2-pairs.ts';

const sessionOf = (rows: readonly unknown[]): Session => {
  const inner = hashDatabase();
  return {
    query: (statement, values) =>
      statement.includes('occurred_at')
        ? Promise.resolve({ rows })
        : inner.query(statement, values),
  };
};

const point = { latitude: 44.86, longitude: 38.65 };

test('a strike has a full day and a point; a month, no day and a bad order are skipped', async () => {
  const { strikes, skipped } = await strikesOf(
    sessionOf([
      { id: 'a', days: '2026-05-15', ...point },
      { id: 'b', days: ['2026-05-14', '2026-05-15'], ...point },
      { id: 'c', days: '2026-05', ...point },
      { id: 'd', days: null, ...point },
      { id: 'e', days: ['2026-05-15', '2026-05-14'], ...point },
    ]),
  );
  expect(strikes).toEqual([
    { ref: 'a', day: '2026-05-15', until: '2026-05-15', ...point },
    { ref: 'b', day: '2026-05-14', until: '2026-05-15', ...point },
  ]);
  expect(skipped).toBe(3);
});

test('the run counts the strikes with a pair, one image and none, and lists the strikes without a pair', async () => {
  const web = stubWeb(
    () => text('', 404),
    { cdseClientId: 'id', cdseClientSecret: 'secret' },
    (asked) => {
      const path = asked.url.pathname;
      if (path.endsWith('/token'))
        return bytes(JSON.stringify({ access_token: 't', expires_in: 600 }));
      if (path.endsWith('/search'))
        return bytes(
          JSON.stringify({
            features: [
              { id: 'S2_before', properties: { datetime: '2026-05-13T08:50:00Z' } },
              { id: 'S2_after', properties: { datetime: '2026-05-18T08:50:00Z' } },
            ],
          }),
        );
      if (path.endsWith('/statistics'))
        return bytes(
          JSON.stringify({
            data: ['2026-05-13', '2026-05-18'].map((date) => ({
              interval: { from: `${date}T00:00:00Z` },
              outputs: {
                cloud: { bands: { B0: { stats: { mean: date === '2026-05-18' ? 0.9 : 0 } } } },
              },
            })),
          }),
        );
      return bytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    },
  );
  const report = await pairStrikes(
    sessionOf([]),
    { web, store: memoryStore(), now: () => new Date('2026-10-27T10:00:00Z') },
    [{ ref: 'one', day: '2026-05-15', until: '2026-05-15', ...point }],
  );
  expect(report).toMatchObject({ pair: 0, one: 1, none: 0, error: 0 });
  expect(report.lines).toEqual([
    'one: no clear image after (window 2026-05-16 to 2026-05-30): tried 2026-05-18 (90 percent cloud)',
  ]);
});

test('a refused client stops the run with a sentence that holds no secret', async () => {
  const web = stubWeb(
    () => text('', 404),
    { cdseClientId: 'id', cdseClientSecret: 'the-secret' },
    () => bytes('{}', 401),
  );
  const report = await pairStrikes(
    sessionOf([]),
    { web, store: memoryStore(), now: () => new Date('2026-10-27T10:00:00Z') },
    [{ ref: 'one', day: '2026-05-15', until: '2026-05-15', ...point }],
  );
  expect(report.stopped).toContain('401');
  expect(report.stopped).not.toContain('the-secret');
  expect(report.pair + report.one + report.none + report.error).toBe(0);
});
