// The NATO pair of a claim: the digit of its fact, and the best letter among the authors of the
// acts that the rules count as support for the fact. The pair is computed on read. Each case runs
// inside a transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, cited, label, rate, reference, refusal, type Cited } from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const CHECK = 'SELECT public.record_research_check($1::uuid, $2, $3, $4, $5)';

const check = (ask: Ask, one: Cited, verdict: 'supported' | 'not_supported' = 'supported') =>
  as(ask, 'gabriel_checker', () =>
    ask(CHECK, [one.act, 'a-checker', 'openai', 'anthropic', verdict]),
  );

const pairShape = z.array(z.object({ letter: z.string(), digit: z.number() }));

/** The pair of the claim of an act, as a tool role reads it, or null when there is none. */
const pairOf = async (ask: Ask, act: string, role = 'gabriel_app'): Promise<string | null> => {
  const rows = pairShape.parse(
    await as(ask, role, () =>
      ask('SELECT letter, digit::int AS digit FROM public.nato_pair($1::uuid)', [act]),
    ),
  );
  expect(rows.length).toBeLessThanOrEqual(1);
  const [row] = rows;
  return row === undefined ? null : `${row.letter}${String(row.digit)}`;
};

// Two sources that differ in every way that the proof of independence reads.
const ONE = {
  uri: 'https://one.example/a',
  text: 'The fifty seventh brigade now holds the eastern bank of the river.',
};
const TWO = {
  uri: 'https://two.example/b',
  text: 'Satellite images show the unit near the town since early spring.',
};

test('a checked fact with a rated author has a pair: the best letter of its support and its digit', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await reference(ask, 'Author One', 'B');
    await rate(ask, 'Author Two', 'D');
    const fact = label();
    const first = await cited(ask, { author: 'Author Two', label: fact, ...ONE });
    await check(ask, first);
    const alone = await pairOf(ask, first.act);
    const second = await cited(ask, { author: 'Author One', label: fact, ...TWO });
    await check(ask, second);
    // Each act of the fact gives the pair of the fact.
    return { alone, first: await pairOf(ask, first.act), second: await pairOf(ask, second.act) };
  });
  expect(read).toStrictEqual({ alone: 'D3', first: 'B1', second: 'B1' });
});

test('a fact with no passed check has no pair', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'Author One', 'C');
    const one = await cited(ask, { author: 'Author One', label: label(), ...ONE });
    const unchecked = await pairOf(ask, one.act);
    await check(ask, one, 'not_supported');
    return { unchecked, disputed: await pairOf(ask, one.act) };
  });
  expect(read).toStrictEqual({ unchecked: null, disputed: null });
});

test('a fact with no author letter has no pair, even with a digit', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const one = await cited(ask, { author: 'Nobody Resolved', label: label(), ...ONE });
    await check(ask, one);
    const digit = z
      .array(z.object({ digit: z.number().nullable() }))
      .parse(
        await as(ask, 'gabriel_app', () =>
          ask('SELECT public.fact_digit($1)::int AS digit', [one.claimKey]),
        ),
      )[0]?.digit;
    return { digit, pair: await pairOf(ask, one.act) };
  });
  expect(read).toStrictEqual({ digit: 6, pair: null });
});

test('the letter comes only from the acts that the rules count as support', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await reference(ask, 'Registry', 'A');
    await reference(ask, 'Wire Agency', 'B');
    await rate(ask, 'Local Blog', 'E');
    const fact = label();
    const blog = await cited(ask, { author: 'Local Blog', label: fact, ...ONE });
    await check(ask, blog);
    // A source A that only reports what another party says, and a source B that no check passed,
    // are no support.
    const reported = await cited(ask, {
      author: 'Registry',
      label: fact,
      modality: 'attributes',
      uri: 'https://three.example/c',
      text: 'The registry quotes a local report about the brigade on the river.',
    });
    await check(ask, reported);
    await cited(ask, { author: 'Wire Agency', label: fact, ...TWO });
    return pairOf(ask, blog.act);
  });
  expect(read?.charAt(0)).toBe('E');
});

test('a party to the conflict gives C at most', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await reference(ask, 'Defence Ministry', 'B', { party: true, controller: 'The State' });
    const one = await cited(ask, { author: 'Defence Ministry', label: label(), ...ONE });
    await check(ask, one);
    return pairOf(ask, one.act);
  });
  expect(read).toBe('C3');
});

test('an act that is not in the record gives no pair', async () => {
  const read = await rolledBack('superuser', (ask) =>
    pairOf(ask, '00000000-0000-4000-8000-000000000000'),
  );
  expect(read).toBeNull();
});

test('the tool roles can read a pair, and the public read role cannot', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'Author One', 'C');
    const one = await cited(ask, { author: 'Author One', label: label(), ...ONE });
    await check(ask, one);
    const tools: (string | null)[] = [];
    for (const role of ['gabriel_app', 'gabriel_agent', 'gabriel_research'])
      tools.push(await pairOf(ask, one.act, role));
    const read = await refusal(ask, () =>
      as(ask, 'gabriel_read', () => ask('SELECT * FROM public.nato_pair($1::uuid)', [one.act])),
    );
    return { tools, read };
  });
  expect(said.tools).toStrictEqual(['C3', 'C3', 'C3']);
  expect(said.read).toMatch(/permission denied/u);
});
