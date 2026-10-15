import { openrouterModel } from '@gab/model';
import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { Queryable } from '../queryable.ts';
import type { RaterConfig } from '../reader-config.ts';
import { completionOf, READER, routerOf } from '../runner-fixture.ts';
import {
  approveReferenceSet,
  buildReferenceSet,
  fillReferenceSites,
  loadReferenceSet,
  readReferenceSet,
} from './reference-set.ts';

// Departure: each test runs in one transaction that rolls back. One connection signs as the
// operator role to store and as the agent role to record the call. The model is a fake answer: no
// test reaches OpenRouter.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({
  connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'),
  max: 2,
});

afterAll(async () => {
  await pool.end();
});

const CONFIG: RaterConfig = { model: READER, tokenCap: 100_000 };

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** Thirty authors, five for each letter. Each author A has a site of its own. */
const authors = (count = 30) =>
  Array.from({ length: count }, (_none, index) => ({
    name: `Author ${String(index)}`,
    letter: LETTERS[index % LETTERS.length],
    reason: `the reason of author ${String(index)}`,
    controller: null,
    party: false,
    sites: index % LETTERS.length === 0 ? [`register${String(index)}.example`] : [],
  }));

type Row = Record<string, unknown>;

const inTransaction = async (
  work: (held: {
    agent: Queryable;
    app: Queryable;
    ask: (text: string) => Promise<Row[]>;
  }) => Promise<void>,
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const as = (role: string): Queryable => ({
      query: async (text, values) => {
        await client.query(`SET LOCAL SESSION AUTHORIZATION ${role}`);
        try {
          return await client.query(text, values);
        } finally {
          await client.query('RESET SESSION AUTHORIZATION');
        }
      },
    });
    await work({
      agent: as('gabriel_agent'),
      app: as('gabriel_app'),
      ask: async (text) => (await client.query<Row>(text)).rows,
    });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const build = (
  held: { agent: Queryable; app: Queryable },
  answer: unknown,
): ReturnType<typeof buildReferenceSet> => {
  const router = routerOf(() => completionOf(JSON.stringify(answer)));
  return buildReferenceSet({
    agent: held.agent,
    app: held.app,
    config: CONFIG,
    language: openrouterModel(READER.model, { OPENROUTER_API_KEY: 'a-stub-key' }, router.send),
    prompt: 'a prompt',
    sleep: () => Promise.resolve(),
    now: () => 0,
  });
};

test('the build stores about thirty authors with a reason each, and none is usable yet', async () => {
  await inTransaction(async (held) => {
    const stored = await build(held, { authors: authors() });

    expect(stored).toHaveLength(30);
    expect(stored.every((one) => !one.approved && one.reason.startsWith('the reason'))).toBe(true);
    expect(stored.map((one) => one.letter)).toContain('A');
    // An unapproved author reads as F, and the worker context holds no reference author.
    const letter = await held.ask(`SELECT public.letter_of('author 0')::text AS letter`);
    expect(letter).toStrictEqual([{ letter: 'F' }]);
    const context = await held.agent.query(`SELECT public.rating_context('someone') AS context`);
    expect(context.rows).toStrictEqual([{ context: { resolved: false, authors: [] } }]);
  });
});

test('the approval makes the set usable, for the rating and for the letter', async () => {
  await inTransaction(async (held) => {
    await build(held, { authors: authors() });
    expect(await approveReferenceSet(held.app)).toBe(30);

    expect((await readReferenceSet(held.app)).every((one) => one.approved)).toBe(true);
    const letter = await held.ask(`SELECT public.letter_of('author 0')::text AS letter`);
    expect(letter).toStrictEqual([{ letter: 'A' }]);
    const context = await held.agent.query(`SELECT public.rating_context('someone') AS context`);
    expect(JSON.stringify(context.rows)).toContain('"author 0"');
  });
});

test('the call of the build is recorded, with no job', async () => {
  await inTransaction(async (held) => {
    await build(held, { authors: authors() });

    const calls = await held.ask(
      `SELECT agent, requested_model, outcome, job_id FROM public.model_call
        WHERE agent = 'reference-set'`,
    );
    expect(calls).toStrictEqual([
      { agent: 'reference-set', requested_model: READER.model, outcome: 'ok', job_id: null },
    ]);
  });
});

test('a second build is refused, and the set stays as it was', async () => {
  await inTransaction(async (held) => {
    await build(held, { authors: authors() });
    await expect(build(held, { authors: authors() })).rejects.toThrow('built once');
    expect(await readReferenceSet(held.app)).toHaveLength(30);
  });
});

test.each([
  ['too few authors', { authors: authors(5) }],
  ['two authors of one name', { authors: [...authors(), { ...authors()[0], letter: 'B' }] }],
  [
    'a party with no controller',
    { authors: authors().map((one, index) => (index === 1 ? { ...one, party: true } : one)) },
  ],
])('an answer with %s stores nothing', async (_name, answer) => {
  await inTransaction(async (held) => {
    await expect(build(held, answer)).rejects.toThrow();
    expect(await readReferenceSet(held.app)).toHaveLength(0);
  });
});

test('a written set loads with no model call, and none is usable yet', async () => {
  await inTransaction(async (held) => {
    const stored = await loadReferenceSet(held.app, JSON.stringify({ authors: authors() }));

    expect(stored).toHaveLength(30);
    expect(stored.every((one) => !one.approved)).toBe(true);
    const kept = await held.ask(`SELECT DISTINCT model FROM public.author WHERE reference_set`);
    expect(kept).toStrictEqual([{ model: 'expert-written set' }]);
    const calls = await held.ask(
      `SELECT count(*)::int AS n FROM public.model_call WHERE agent = 'reference-set'`,
    );
    expect(calls).toStrictEqual([{ n: 0 }]);
    expect(await approveReferenceSet(held.app)).toBe(30);
  });
});

test('a load is refused when the record holds a set, and the set stays as it was', async () => {
  await inTransaction(async (held) => {
    await loadReferenceSet(held.app, JSON.stringify({ authors: authors() }));
    await expect(
      loadReferenceSet(held.app, JSON.stringify({ authors: authors() })),
    ).rejects.toThrow('already');
    expect(await readReferenceSet(held.app)).toHaveLength(30);
  });
});

test('a written set that breaks a rule stores nothing', async () => {
  await inTransaction(async (held) => {
    const party = authors().map((one, index) =>
      index === 0 ? { ...one, letter: 'B', party: true } : one,
    );
    await expect(loadReferenceSet(held.app, JSON.stringify({ authors: party }))).rejects.toThrow(
      'a party to the conflict has a controller',
    );
    const rated = authors().map((one, index) =>
      index === 0 ? { ...one, letter: 'A', party: true, controller: 'A government' } : one,
    );
    await expect(loadReferenceSet(held.app, JSON.stringify({ authors: rated }))).rejects.toThrow(
      'a party to the conflict is B at most',
    );
    const twice = [...authors(), { ...authors()[0], letter: 'B' }];
    await expect(loadReferenceSet(held.app, JSON.stringify({ authors: twice }))).rejects.toThrow(
      'two authors share one name',
    );
    await expect(loadReferenceSet(held.app, 'not json')).rejects.toThrow();
    expect(await readReferenceSet(held.app)).toHaveLength(0);
  });
});

test('the set keeps the sites of each author, and the operator reads them', async () => {
  await inTransaction(async (held) => {
    const stored = await loadReferenceSet(held.app, JSON.stringify({ authors: authors() }));

    expect(stored.find((one) => one.name_key === 'author 0')?.sites).toStrictEqual([
      'register0.example',
    ]);
    expect(stored.find((one) => one.name_key === 'author 1')?.sites).toStrictEqual([]);
  });
});

test.each([
  ['an author A with no site', { letter: 'A', sites: [] }, 'an author A has at least one site'],
  ['a site with a scheme', { sites: ['https://register.example'] }, 'a site is a host name'],
  ['a site with a path', { sites: ['register.example/list'] }, 'a site is a host name'],
  ['a site in capitals', { sites: ['Register.Example'] }, 'a site is a host name'],
  ['a site with www', { sites: ['www.register.example'] }, 'a site does not start with www.'],
  ['a site that is too broad', { sites: ['gov.uk'] }, 'a site is too broad'],
  ['an author with no list of sites', { sites: undefined }, 'sites'],
])('a set with %s stores nothing', async (_name, change, said) => {
  await inTransaction(async (held) => {
    const set = authors().map((one, index) => (index === 0 ? { ...one, ...change } : one));
    await expect(loadReferenceSet(held.app, JSON.stringify({ authors: set }))).rejects.toThrow(
      said,
    );
    expect(await readReferenceSet(held.app)).toHaveLength(0);
  });
});

test('the sites of the file go once to each author of a stored set that has none', async () => {
  await inTransaction(async (held) => {
    // A set stored before the sites existed: no author has a site.
    for (const one of authors())
      await held.app.query(
        `SELECT public.store_reference_author($1, $2, 'an older build', $3, '{}'::text[])`,
        [one.name, one.letter, one.reason],
      );
    await approveReferenceSet(held.app);
    const file = {
      authors: [
        ...authors(29),
        { ...authors()[29], name: 'A stranger', letter: 'A', sites: ['stranger.example'] },
      ],
    };

    const first = await fillReferenceSites(held.app, JSON.stringify(file));
    const again = await fillReferenceSites(held.app, JSON.stringify(file));

    expect(first.sites).toContainEqual({ name: 'Author 0', said: 'filled' });
    expect(first.sites).toContainEqual({ name: 'A stranger', said: 'not_in_set' });
    expect(again.sites).toContainEqual({ name: 'Author 0', said: 'same' });
    expect(first.set.find((one) => one.name_key === 'author 6')?.sites).toStrictEqual([
      'register6.example',
    ]);
    expect(first.set.every((one) => one.approved)).toBe(true);
  });
});
