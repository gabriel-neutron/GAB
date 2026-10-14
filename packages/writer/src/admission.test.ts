import { OPERATOR_KEY_HEADER } from '@gab/proposal/request';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { operatorKeyOf } from './admission.ts';
import { unreachablePool } from './faulty-pool.ts';
import { OPERATOR, TEST_OPERATOR_KEY } from './operator-fixture.ts';
import { writeRoutes } from './routes.ts';

const NO_STORE = { put: () => Promise.reject(new Error('no door under test reaches the store')) };
const NO_READ = { read: () => Promise.reject(new Error('no door under test reads the store')) };
const app = writeRoutes(unreachablePool(), NO_STORE, NO_READ, TEST_OPERATOR_KEY);

const NOT_OPERATOR =
  'the request does not carry the key of the operator; start pnpm dev, which opens the page with the key';
const OTHER_SITE = 'the request does not come from this site';
const WRONG_MEDIA = 'the body must be sent as application/json';

const FORBIDDEN = 403;

// Every door comes from the routes of the app, so a future door is covered with no edit here.
const doors = [
  ...new Set(
    app.routes
      .filter(
        ({ method, path }) =>
          method === 'POST' && (path.startsWith('/write/') || path.startsWith('/private/')),
      )
      .map(({ path }) => path),
  ),
];

const BASE = { host: '127.0.0.1:5177', 'content-type': 'application/json' };

const refusalShape = z.object({ refusal: z.string().optional() });

const knock = async (door: string, headers: Record<string, string>): Promise<[number, string]> => {
  const answer = await app.request(door, { method: 'POST', headers, body: '{}' });
  return [answer.status, refusalShape.parse(await answer.json()).refusal ?? ''];
};

test('the app holds the doors of every kind', () => {
  expect(doors.length).toBeGreaterThan(20);
  expect(doors).toContain('/write/create-entity');
  expect(doors).toContain('/private/review-units');
});

test('a request with no key reaches no door', async () => {
  for (const door of doors)
    expect([door, ...(await knock(door, BASE))]).toEqual([door, FORBIDDEN, NOT_OPERATOR]);
});

test.each([TEST_OPERATOR_KEY + 'x', 'short', ''])(
  'a wrong key reaches no door, also when its length differs',
  async (key) => {
    for (const door of doors)
      expect([door, ...(await knock(door, { ...BASE, [OPERATOR_KEY_HEADER]: key }))]).toEqual([
        door,
        FORBIDDEN,
        NOT_OPERATOR,
      ]);
  },
);

test('the key of the operator reaches every door past the guard', async () => {
  for (const door of doors) {
    const [status, refusal] = await knock(door, { ...BASE, ...OPERATOR });
    expect([door, [NOT_OPERATOR, OTHER_SITE, WRONG_MEDIA].includes(refusal)]).toEqual([
      door,
      false,
    ]);
    expect(status).not.toBe(FORBIDDEN);
  }
});

test('the key from another site still gets the refusal of the site', async () => {
  for (const door of doors)
    expect([
      door,
      ...(await knock(door, { ...BASE, ...OPERATOR, 'sec-fetch-site': 'cross-site' })),
    ]).toEqual([door, FORBIDDEN, OTHER_SITE]);
});

test('the key of the environment is checked, and its error never holds the value', () => {
  const bad = ['', 'a'.repeat(31), `${'a'.repeat(31)}=`, `${'a'.repeat(40)} `, undefined];
  for (const value of bad) {
    const env = { GABRIEL_OPERATOR_KEY: value };
    expect(() => operatorKeyOf(env)).toThrow(/GABRIEL_OPERATOR_KEY.*infra\/\.env/su);
  }
  const secret = `${'b'.repeat(31)}=`;
  let message = '';
  try {
    operatorKeyOf({ GABRIEL_OPERATOR_KEY: secret });
  } catch (error) {
    message = String(error);
  }
  expect(message).toContain('GABRIEL_OPERATOR_KEY');
  expect(message).not.toContain(secret);
  const key = 'k'.repeat(43);
  expect(operatorKeyOf({ GABRIEL_OPERATOR_KEY: key })).toBe(key);
});
