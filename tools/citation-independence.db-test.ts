// Code proves the independence of two citations of one fact: different authors, different
// controllers, different sites, and passages that share no long run of the same words. When code
// is not sure, the two count as one author. Each case runs inside a transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, cited, join, label, rate, reference, type Source } from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const PASSAGE_ONE = 'The fifty seventh brigade now holds the eastern bank of the river.';
const PASSAGE_TWO = 'Satellite images show the unit near the town since early spring.';

const independent = async (ask: Ask, a: string, b: string): Promise<boolean> => {
  const [one] = z
    .array(z.object({ yes: z.boolean() }))
    .parse(
      await as(ask, 'gabriel_app', () =>
        ask('SELECT public.citations_independent($1::uuid, $2::uuid) AS yes', [a, b]),
      ),
    );
  if (one === undefined) throw new Error('no answer');
  return one.yes;
};

interface Pair {
  readonly one: Partial<Source>;
  readonly two: Partial<Source>;
}

// Two authors, each rated with the options of its side, cite one fact.
const judge = (
  pair: Pair,
  prepare: (ask: Ask) => Promise<void> = () => Promise.resolve(),
  after: (ask: Ask) => Promise<void> = () => Promise.resolve(),
) =>
  rolledBack('superuser', async (ask) => {
    await rate(ask, 'Author One', 'D');
    await rate(ask, 'Author Two', 'D');
    await prepare(ask);
    const fact = label();
    const first = await cited(ask, {
      author: 'Author One',
      uri: 'https://one.example/a',
      text: PASSAGE_ONE,
      label: fact,
      ...pair.one,
    });
    const second = await cited(ask, {
      author: 'Author Two',
      uri: 'https://two.example/b',
      text: PASSAGE_TWO,
      label: fact,
      ...pair.two,
    });
    await after(ask);
    return {
      forward: await independent(ask, first.citation, second.citation),
      backward: await independent(ask, second.citation, first.citation),
    };
  });

test('two citations of different authors, controllers, sites and passages are independent', async () => {
  expect(await judge({ one: {}, two: {} })).toStrictEqual({ forward: true, backward: true });
});

test('two names of one author are one author', async () => {
  const read = await judge(
    { one: {}, two: { author: 'The Second Name' } },
    (ask) => join(ask, 'The Second Name', 'Author One'),
  );
  expect(read.forward).toBe(false);
});

test('two authors of one controller are not independent', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'State Channel', 'C', { controller: 'The  State' });
    await rate(ask, 'State Agency', 'C', { controller: 'the state' });
    const fact = label();
    const one = await cited(ask, {
      author: 'State Channel',
      uri: 'https://one.example/a',
      text: PASSAGE_ONE,
      label: fact,
    });
    const two = await cited(ask, {
      author: 'State Agency',
      uri: 'https://two.example/b',
      text: PASSAGE_TWO,
      label: fact,
    });
    return independent(ask, one.citation, two.citation);
  });
  expect(read).toBe(false);
});

test('an author that is the controller of another is not independent of it', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'Holding', 'C');
    await rate(ask, 'Daily Paper', 'D', { controller: 'holding' });
    const fact = label();
    const one = await cited(ask, {
      author: 'Holding',
      uri: 'https://one.example/a',
      text: PASSAGE_ONE,
      label: fact,
    });
    const two = await cited(ask, {
      author: 'Daily Paper',
      uri: 'https://two.example/b',
      text: PASSAGE_TWO,
      label: fact,
    });
    return independent(ask, one.citation, two.citation);
  });
  expect(read).toBe(false);
});

test('two citations from one site are not independent, whatever the case and the www', async () => {
  const read = await judge({
    one: { uri: 'https://News.Example/story-1' },
    two: { uri: 'http://www.news.example/story-2?x=1' },
  });
  expect(read.forward).toBe(false);
});

test('two channels of one network site are two sites', async () => {
  const read = await judge({
    one: { uri: 'https://t.me/channel_one/12' },
    two: { uri: 'https://t.me/channel_two/7' },
  });
  expect(read.forward).toBe(true);
  const same = await judge({
    one: { uri: 'https://t.me/channel_one/12' },
    two: { uri: 'https://t.me/Channel_One/99' },
  });
  expect(same.forward).toBe(false);
});

test('a citation of a document with no address is not proved independent', async () => {
  const read = await judge({ one: { uri: null }, two: {} });
  expect(read.forward).toBe(false);
});

const LONG = 'one two three four five six seven eight nine ten';

test('passages that share a long run of words are copies, and the length is a parameter', async () => {
  const sharing = (words: number): Pair => ({
    one: { text: `alpha beta ${LONG.split(' ').slice(0, words).join(' ')} gamma delta` },
    two: { text: `epsilon zeta ${LONG.split(' ').slice(0, words).join(' ')} eta theta` },
  });
  const seven = await judge(sharing(7));
  const eight = await judge(sharing(8));
  const lowered = await judge(sharing(7), undefined, async (ask) => {
    await ask(
      `UPDATE public.parameter SET value = 4 WHERE key = 'independence_shared_run_words'`,
    );
  });
  expect(seven.forward).toBe(true);
  expect(eight.forward).toBe(false);
  expect(lowered.forward).toBe(false);
});

test('a short passage that is the same words is a copy', async () => {
  const read = await judge({ one: { text: 'Brigade moved north.' }, two: { text: 'brigade MOVED, north' } });
  expect(read.forward).toBe(false);
});

test('only an act that states or enacts the fact counts', async () => {
  const counted = await Promise.all(
    (['enacts', 'asserts'] as const).map((modality) => judge({ one: { modality }, two: {} })),
  );
  const uncounted = await Promise.all(
    (['attributes', 'alleges', 'denies'] as const).map((modality) =>
      judge({ one: {}, two: { modality } }),
    ),
  );
  expect(counted.map((one) => one.forward)).toStrictEqual([true, true]);
  expect(uncounted.map((one) => one.forward)).toStrictEqual([false, false, false]);
});

test('a name that no worker answer has resolved is no author, so the pair is not independent', async () => {
  const read = await judge({ one: {}, two: { author: 'Nobody Resolved' } });
  expect(read.forward).toBe(false);
});

test('a reference author is an author like another one', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await reference(ask, 'Official Register', 'A');
    await rate(ask, 'Wire Agency', 'C');
    const fact = label();
    const one = await cited(ask, {
      author: 'Official Register',
      uri: 'https://one.example/a',
      text: PASSAGE_ONE,
      label: fact,
    });
    const two = await cited(ask, {
      author: 'Wire Agency',
      uri: 'https://two.example/b',
      text: PASSAGE_TWO,
      label: fact,
    });
    return independent(ask, one.citation, two.citation);
  });
  expect(read).toBe(true);
});
