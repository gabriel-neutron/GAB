import { DECISION_OPS, WRITE_OPS } from '@gab/proposal/request';
import { afterAll, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';
import { LARGEST_BODY_BYTES, writeRoutes } from './routes.ts';

const pool = openPool();
// An act door never reaches the raw store, so this one refuses every object.
const NO_STORE = { put: () => Promise.reject(new Error('no act door reaches the raw store')) };
const app = writeRoutes(pool, NO_STORE);

afterAll(async () => {
  await pool.end();
});

const replyShape = z.object({ refusal: z.string().optional() });

const OTHER_SITE = 'the request does not come from this site';
const WRONG_MEDIA = 'the body must be sent as application/json';

const FORBIDDEN = 403;
const UNSUPPORTED_MEDIA_TYPE = 415;
const PAYLOAD_TOO_LARGE = 413;
const REFUSED_BODY = 422;

// Departure: each door gets an empty body. The guard runs first, so the answer proves the cell,
// and a body that no door can read reaches no database and writes no row.
const EMPTY_BODY = '{}';

const doors = [...WRITE_OPS, ...DECISION_OPS].map((op) => op.replaceAll('_', '-'));

const knock = async (
  door: string,
  headers: Record<string, string>,
  body: string | Uint8Array = EMPTY_BODY,
): Promise<[number, string]> => {
  const answer = await app.request(`/write/${door}`, { method: 'POST', headers, body });
  const held = replyShape.parse(await answer.json());
  return [answer.status, held.refusal ?? ''];
};

const OWN_HOST = '127.0.0.1:5177';
const PROXY_HOST = 'localhost:5173';
const REBOUND_HOST = 'attacker.example:5177';

const JSON_HEADER = { host: OWN_HOST, 'content-type': 'application/json' };

const OTHER_SITES = ['same-site', 'none', 'cross-site'] as const;

// Departure: a door that the guard admits reads the body and refuses it, so the cell states the
// door, the status and the guard sentence that must be absent.
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

test('the page of the proxy and a caller on the loopback address reach every door', async () => {
  for (const door of doors)
    for (const host of [OWN_HOST, PROXY_HOST]) {
      const origin = { host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' };
      const [status, refusal] = await knock(door, { ...JSON_HEADER, ...origin });
      expect({ host, ...admitted(door, status, refusal) }).toEqual({ host, ...readsTheBody(door) });
    }
});

// External constraint: the browser sees a page whose name points at the loopback address as
// same-origin, and it sends `same-origin`. Only the Host and the Origin show the true site.
test('a page whose name was pointed at the loopback address reaches no door', async () => {
  const rebound = {
    host: REBOUND_HOST,
    origin: `http://${REBOUND_HOST}`,
    'sec-fetch-site': 'same-origin',
  };
  const cells = {
    'a foreign host': { ...rebound },
    'a foreign origin': { ...rebound, host: OWN_HOST },
    'no host': { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
  };
  for (const door of doors)
    for (const [cell, headers] of Object.entries(cells)) {
      const [status, refusal] = await knock(door, {
        'content-type': 'application/json',
        ...headers,
      });
      expect({ door, cell, status, refusal }).toEqual({
        door,
        cell,
        status: FORBIDDEN,
        refusal: OTHER_SITE,
      });
    }
});

// External constraint: a request with a string body gets a text media type, and bytes get none.
test('a body that is not declared as JSON reaches no door', async () => {
  for (const door of doors) {
    const typed = await knock(door, { ...JSON_HEADER, 'content-type': 'text/plain' });
    const bare = await knock(door, { host: OWN_HOST }, new TextEncoder().encode(EMPTY_BODY));
    for (const [cell, [status, refusal]] of Object.entries({ typed, bare }))
      expect({ door, cell, status, refusal }).toEqual({
        door,
        cell,
        status: UNSUPPORTED_MEDIA_TYPE,
        refusal: WRONG_MEDIA,
      });
  }
});

test('a JSON media type with a parameter or in capitals reaches every door', async () => {
  for (const door of doors)
    for (const media of ['application/json; charset=utf-8', 'Application/JSON']) {
      const [status, refusal] = await knock(door, { ...JSON_HEADER, 'content-type': media });
      expect({ media, ...admitted(door, status, refusal) }).toEqual({
        media,
        ...readsTheBody(door),
      });
    }
});

const paddedTo = (bytes: number): string => {
  const shell = '{"pad":""}';
  return `{"pad":"${'x'.repeat(bytes - shell.length)}"}`;
};

test('a body larger than the limit is refused before the writer reaches the database', async () => {
  const connect = vi.spyOn(pool, 'connect');
  const send = async (body: string): Promise<number> => {
    const answer = await app.request('/write/create-entity', {
      method: 'POST',
      headers: JSON_HEADER,
      body,
    });
    return answer.status;
  };

  expect(await send(paddedTo(LARGEST_BODY_BYTES + 1))).toBe(PAYLOAD_TOO_LARGE);
  expect(connect).not.toHaveBeenCalled();
  expect(await send(paddedTo(LARGEST_BODY_BYTES))).toBe(REFUSED_BODY);
  connect.mockRestore();
});
