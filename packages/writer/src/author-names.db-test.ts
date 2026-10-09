import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool, roleAddress } from './pool.ts';
import { writeRoutes } from './routes.ts';

const pool = openPool();
// No door under test reaches the raw store, so these two doors refuse every object.
const NO_STORE = { put: () => Promise.reject(new Error('no door under test reaches the store')) };
const NO_READ = { read: () => Promise.reject(new Error('no door under test reads the store')) };
const app = writeRoutes(pool, NO_STORE, NO_READ);

z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const owner = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD') });
const agent = new Pool({
  connectionString: roleAddress('gabriel_agent', 'GABRIEL_AGENT_PASSWORD'),
});

afterAll(async () => {
  await Promise.all([owner.end(), agent.end(), pool.end()]);
});

const OWN = { host: '127.0.0.1:5177', 'content-type': 'application/json' };

const send = async (door: string, body: unknown): Promise<[number, unknown]> => {
  const answer = await app.request(door, {
    method: 'POST',
    headers: OWN,
    body: JSON.stringify(body),
  });
  return [answer.status, await answer.json()];
};

// Departure: an approved reference author A is written straight, as the shared fixture of the
// schema tests writes one. The approval door of the operator approves the whole reference set.
const SEED_AUTHOR = `
  WITH made AS (
    INSERT INTO public.author (name_key, letter, model, reason, reference_set)
    VALUES (public.name_key($1), 'A', 'a-seed-model', 'a seed reason', true)
    RETURNING id, name_key
  ), named AS (
    INSERT INTO public.author_name (name_key, author_id) SELECT name_key, id FROM made
  )
  INSERT INTO public.reference_approval (author_id) SELECT id FROM made`;

/** A new name that the worker joined to an author A, so it waits for the operator. */
const joinedName = async (): Promise<{ name: string; author: string }> => {
  const [author, name] = [`Author ${randomUUID()}`, `Name ${randomUUID()}`];
  await owner.query(SEED_AUTHOR, [author]);
  await agent.query('SELECT public.join_author_name($1, $2)', [name, author]);
  return { name: name.toLowerCase(), author: author.toLowerCase() };
};

const waiting = z.object({
  names: z.array(
    z.object({ name: z.string(), author: z.string(), letter: z.string(), units: z.number() }),
  ),
});

const namesOf = async () => {
  const [status, reply] = await send('/private/author-names', {});
  expect(status).toBe(200);
  return waiting.parse(reply).names;
};

test('the private read gives a joined name with its author, the letter and its units', async () => {
  const { name, author } = await joinedName();
  expect((await namesOf()).find((one) => one.name === name)).toStrictEqual({
    name,
    author,
    letter: 'A',
    units: 0,
  });
});

test.each([true, false])(
  'a decision (confirm %s) gives the units, and the name waits no more',
  async (confirm) => {
    const { name } = await joinedName();
    expect(await send('/write/decide-author-name', { name, confirm })).toStrictEqual([
      200,
      { units: 0 },
    ]);
    expect((await namesOf()).some((one) => one.name === name)).toBe(false);

    // A second decision on the same name is refused, and it writes nothing.
    const [status, reply] = await send('/write/decide-author-name', { name, confirm });
    expect(status).toBe(422);
    expect(z.strictObject({ refusal: z.string() }).safeParse(reply).success).toBe(true);
  },
);

test('a body with no name or no choice is refused', async () => {
  for (const body of [{ name: 'a name' }, { confirm: true }, { name: 'a name', confirm: 'yes' }])
    expect(await send('/write/decide-author-name', body)).toStrictEqual([
      422,
      { refusal: 'the body names a name and a choice: confirm or refuse' },
    ]);
});

test('a request from another site reads no name and decides no name', async () => {
  for (const door of ['/private/author-names', '/write/decide-author-name']) {
    const answer = await app.request(door, {
      method: 'POST',
      headers: { ...OWN, origin: 'http://attacker.example' },
      body: JSON.stringify({ name: 'a name', confirm: true }),
    });
    expect(answer.status).toBe(403);
  }
});
