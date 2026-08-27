import { WRITE_OPS } from '@gab/proposal/request';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';
import { openVocabulary } from './vocabulary.ts';

const pool = openPool();
let app: ReturnType<typeof writeRoutes>;

beforeAll(async () => {
  app = writeRoutes(pool, await openVocabulary(pool));
});

afterAll(async () => {
  await pool.end();
});

const replyShape = z.object({ refusal: z.string().optional() });

const OTHER_SITE = 'the request does not come from this site';
const WRONG_MEDIA = 'the body must be sent as application/json';

const FORBIDDEN = 403;
const UNSUPPORTED_MEDIA_TYPE = 415;
const REFUSED_BODY = 422;

// Every door is knocked on with an empty body. The guard runs first, so the cell is proven by
// the answer, and a body that no door can read reaches no database and writes no row.
const EMPTY_BODY = '{}';

const doors = WRITE_OPS.map((op) => op.replaceAll('_', '-'));

const knock = async (door: string, headers: Record<string, string>): Promise<[number, string]> => {
  const answer = await app.request(`/write/${door}`, {
    method: 'POST',
    headers,
    body: EMPTY_BODY,
  });
  const held = replyShape.parse(await answer.json());
  return [answer.status, held.refusal ?? ''];
};

const JSON_HEADER = { 'content-type': 'application/json' };

const OTHER_SITES = ['same-site', 'none', 'cross-site'] as const;

// A door that the guard admits reads the body and refuses it, so the cell states the door, the
// status and the guard sentence that must be absent.
const admitted = (door: string, status: number, refusal: string): Record<string, unknown> => ({
  door,
  status,
  turnedAway: refusal === OTHER_SITE || refusal === WRONG_MEDIA,
});

const readsTheBody = (door: string): Record<string, unknown> => ({
  door,
  status: REFUSED_BODY,
  turnedAway: false,
});

test('a browser on this site reaches every door', async () => {
  for (const door of doors) {
    const site = { ...JSON_HEADER, 'sec-fetch-site': 'same-origin' };
    const [status, refusal] = await knock(door, site);
    expect(admitted(door, status, refusal)).toEqual(readsTheBody(door));
  }
});

test('a caller that is not a browser sends no site header, and it reaches every door', async () => {
  for (const door of doors) {
    const [status, refusal] = await knock(door, JSON_HEADER);
    expect(admitted(door, status, refusal)).toEqual(readsTheBody(door));
  }
});

test('a browser on another site reaches no door, whatever the distance', async () => {
  for (const door of doors)
    for (const site of OTHER_SITES) {
      const [status, refusal] = await knock(door, { ...JSON_HEADER, 'sec-fetch-site': site });
      expect({ door, site, status, refusal }).toEqual({
        door,
        site,
        status: FORBIDDEN,
        refusal: OTHER_SITE,
      });
    }
});

test('a body that is not declared as JSON reaches no door', async () => {
  for (const door of doors) {
    const [status, refusal] = await knock(door, { 'content-type': 'text/plain' });
    expect({ door, status, refusal }).toEqual({
      door,
      status: UNSUPPORTED_MEDIA_TYPE,
      refusal: WRONG_MEDIA,
    });
  }
});
