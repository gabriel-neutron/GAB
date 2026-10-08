// The digit of a fact is computed on read. It never reads a letter: it comes from the citations,
// the independence of their authors, controllers, sites and passages, the conflicts between
// values, and the check by a second model family. Each case runs inside a transaction that
// rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import {
  as,
  cited,
  label,
  rate,
  reference,
  refusal,
  type Cited,
  type Source,
} from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const CHECK = 'SELECT public.record_act_check($1::uuid, $2, $3, $4, $5)';

const check = (
  ask: Ask,
  one: Cited,
  verdict: 'supported' | 'not_supported' | 'unclear' = 'supported',
  checkerFamily = 'openai',
) =>
  as(ask, 'gabriel_agent', () =>
    ask(CHECK, [one.act, 'a-checker', checkerFamily, 'anthropic', verdict]),
  );

const digitOf = async (ask: Ask, key: string): Promise<number | null | undefined> =>
  z
    .array(z.object({ digit: z.number().nullable() }))
    .parse(
      await as(ask, 'gabriel_app', () => ask('SELECT public.fact_digit($1)::int AS digit', [key])),
    )[0]?.digit;

// Two sources that differ in every way that the proof of independence reads.
const ONE: Partial<Source> = {
  uri: 'https://one.example/a',
  text: 'The fifty seventh brigade now holds the eastern bank of the river.',
};
const TWO: Partial<Source> = {
  uri: 'https://two.example/b',
  text: 'Satellite images show the unit near the town since early spring.',
};

// The digit of a fact that the given sources cite, each one checked.
const digitFor = (
  prepare: (ask: Ask) => Promise<void>,
  sources: readonly Partial<Source>[],
  checks: 'all' | 'none' = 'all',
) =>
  rolledBack('superuser', async (ask) => {
    await prepare(ask);
    const fact = label();
    let key = '';
    for (const source of sources) {
      const one = await cited(ask, { author: 'Author One', label: fact, ...source });
      key = one.claimKey;
      if (checks === 'all') await check(ask, one);
    }
    return digitOf(ask, key);
  });

const twoAuthors = async (ask: Ask) => {
  await rate(ask, 'Author One', 'D');
  await rate(ask, 'Author Two', 'D');
};

test('a fact with no passed check of a second model family has no digit', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    const fact = label();
    const first = await cited(ask, { author: 'Author One', label: fact, ...ONE });
    const second = await cited(ask, { author: 'Author Two', label: fact, ...TWO });
    const without = await digitOf(ask, first.claimKey);
    await check(ask, first, 'supported', 'Anthropic');
    const sameFamily = await digitOf(ask, first.claimKey);
    await check(ask, second, 'unclear');
    const unclear = await digitOf(ask, first.claimKey);
    return { without, sameFamily, unclear };
  });
  expect(read).toStrictEqual({ without: null, sameFamily: null, unclear: null });
});

test('the check is written once for an act, and only for an act of a machine', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    const first = await cited(ask, { author: 'Author One', label: label(), ...ONE });
    await check(ask, first);
    return {
      twice: await refusal(ask, () => check(ask, first)),
      unknown: await refusal(ask, () =>
        as(ask, 'gabriel_agent', () =>
          ask(CHECK, [
            '00000000-0000-4000-8000-000000000000',
            'm',
            'openai',
            'anthropic',
            'supported',
          ]),
        ),
      ),
      read: await refusal(ask, () =>
        as(ask, 'gabriel_read', () => ask('SELECT * FROM public.act_check')),
      ),
    };
  });
  expect(said.twice).toMatch(/duplicate key|act_check_pkey/u);
  expect(said.unknown).toMatch(/act of a machine/u);
  expect(said.read).toMatch(/permission denied/u);
});

test('digit 1: two or more independent citations and no conflict', async () => {
  const read = await digitFor(twoAuthors, [ONE, { author: 'Author Two', ...TWO }]);
  expect(read).toBe(1);
});

test('digit 2: two or more known authors whose citations are not proved independent', async () => {
  const copied = await digitFor(twoAuthors, [
    ONE,
    { author: 'Author Two', ...TWO, uri: 'https://one.example/other' },
  ]);
  expect(copied).toBe(2);
});

test('digit 3: two citations of one author, or one known author beside an unknown one', async () => {
  const sameAuthor = await digitFor(twoAuthors, [ONE, { author: 'Author One', ...TWO }]);
  const unresolved = await digitFor(twoAuthors, [ONE, { author: 'Nobody Resolved', ...TWO }]);
  expect([sameAuthor, unresolved]).toStrictEqual([3, 3]);
});

test('digit 3: two citations inside one act by one author', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    const one = await cited(ask, { author: 'Author One', label: label(), ...ONE });
    await ask(
      `INSERT INTO public.citation (claim_id, doc_id, text_extractor, page, start, "end", modality)
       SELECT claim_id, doc_id, text_extractor, page, start, "end", modality
         FROM public.citation WHERE id = $1::uuid`,
      [one.citation],
    );
    await check(ask, one);
    return digitOf(ask, one.claimKey);
  });
  expect(read).toBe(3);
});

test('digit 3: one author', async () => {
  const read = await digitFor(twoAuthors, [ONE]);
  expect(read).toBe(3);
});

test('digit 6: no citation has a known author', async () => {
  const read = await digitFor(twoAuthors, [
    { author: 'Nobody Resolved', ...ONE },
    { author: 'Nobody Either', ...TWO },
  ]);
  expect(read).toBe(6);
});

test('a citation that only reports what another party says is no source', async () => {
  const read = await digitFor(twoAuthors, [
    ONE,
    { author: 'Author Two', modality: 'attributes', ...TWO },
  ]);
  expect(read).toBe(3);
});

const conflict = (
  extra: (ask: Ask, fact: string) => Promise<void>,
): Promise<{ digit: number | null | undefined }> =>
  rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    const fact = label();
    const first = await cited(ask, { author: 'Author One', label: fact, value: '100', ...ONE });
    await check(ask, first);
    const second = await cited(ask, { author: 'Author Two', label: fact, value: '100', ...TWO });
    await check(ask, second);
    await extra(ask, fact);
    return { digit: await digitOf(ask, first.claimKey) };
  });

test('digit 4: another pending value disagrees, even when the citations are independent', async () => {
  const agreed = await conflict(() => Promise.resolve());
  const disagreed = await conflict(async (ask, fact) => {
    await rate(ask, 'Author Three', 'C');
    await cited(ask, {
      author: 'Author Three',
      label: fact,
      value: '250',
      uri: 'https://three.example/c',
      text: 'A third report speaks of a very different figure for the group.',
    });
  });
  expect(agreed.digit).toBe(1);
  expect(disagreed.digit).toBe(4);
});

test('digit 5: the checker disputes the fact, and it comes before a conflict', async () => {
  const read = await conflict(async (ask, fact) => {
    await rate(ask, 'Author Three', 'C');
    const third = await cited(ask, {
      author: 'Author Three',
      label: fact,
      value: '250',
      uri: 'https://three.example/c',
      text: 'A third report speaks of a very different figure for the group.',
    });
    await check(ask, third, 'not_supported');
  });
  expect(read.digit).toBe(5);
});

test('an unclear verdict is no dispute, and a supported check beside it keeps the digit', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    const fact = label();
    const first = await cited(ask, { author: 'Author One', label: fact, ...ONE });
    await check(ask, first);
    const second = await cited(ask, { author: 'Author Two', label: fact, ...TWO });
    await check(ask, second, 'unclear');
    return digitOf(ask, first.claimKey);
  });
  expect(read).toBe(1);
});

test('digit 5: a party to the conflict denies the fact', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    await rate(ask, 'Defence Ministry', 'C', { party: true, controller: 'The State' });
    const fact = label();
    const first = await cited(ask, { author: 'Author One', label: fact, ...ONE });
    await check(ask, first);
    const second = await cited(ask, { author: 'Author Two', label: fact, ...TWO });
    await check(ask, second);
    const before = await digitOf(ask, first.claimKey);
    const denial = await cited(ask, {
      author: 'Defence Ministry',
      label: fact,
      modality: 'denies',
      uri: 'https://three.example/c',
      text: 'The ministry says that no such brigade serves on that river.',
    });
    await check(ask, denial);
    return { before, after: await digitOf(ask, first.claimKey) };
  });
  expect(read).toStrictEqual({ before: 1, after: 5 });
});

test('a rejected act is no source', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    const fact = label();
    const first = await cited(ask, { author: 'Author One', label: fact, ...ONE });
    await check(ask, first);
    const second = await cited(ask, { author: 'Author Two', label: fact, ...TWO });
    await check(ask, second);
    const before = await digitOf(ask, first.claimKey);
    await ask('SET LOCAL ROLE gabriel_owner');
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask(
      `UPDATE public.proposals SET status = 'rejected', decided_at = now(), decided_by = 'a test'
        WHERE id = $1`,
      [second.act],
    );
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    await ask('RESET ROLE');
    return { before, after: await digitOf(ask, first.claimKey) };
  });
  expect(read).toStrictEqual({ before: 1, after: 3 });
});

test('the digit never reads a letter', async () => {
  const letters = async (first: string, second: string) =>
    rolledBack('superuser', async (ask) => {
      for (const [name, letter] of [
        ['Author One', first],
        ['Author Two', second],
      ] as const) {
        if (letter === 'A' || letter === 'B') await reference(ask, name, letter);
        else await rate(ask, name, letter);
      }
      const fact = label();
      const one = await cited(ask, { author: 'Author One', label: fact, ...ONE });
      await check(ask, one);
      const two = await cited(ask, { author: 'Author Two', label: fact, ...TWO });
      await check(ask, two);
      const single = await cited(ask, { author: 'Author One', label: label(), ...ONE });
      await check(ask, single);
      return [await digitOf(ask, one.claimKey), await digitOf(ask, single.claimKey)];
    });
  const best = await letters('A', 'B');
  const worst = await letters('F', 'E');
  const mixed = await letters('A', 'F');
  expect([best, worst, mixed]).toStrictEqual([
    [1, 3],
    [1, 3],
    [1, 3],
  ]);
});

test('the digit is computed on read and stored nowhere', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await twoAuthors(ask);
    const fact = label();
    const first = await cited(ask, { author: 'Author One', label: fact, ...ONE });
    await check(ask, first);
    const alone = await digitOf(ask, first.claimKey);
    const second = await cited(ask, { author: 'Author Two', label: fact, ...TWO });
    await check(ask, second);
    const columns = z.array(z.object({ table_name: z.string(), column_name: z.string() })).parse(
      await ask(
        `SELECT table_name, column_name FROM information_schema.columns
            WHERE table_schema IN ('public', 'api') AND column_name ~* 'digit'`,
      ),
    );
    return { alone, together: await digitOf(ask, first.claimKey), columns };
  });
  expect(read).toStrictEqual({ alone: 3, together: 1, columns: [] });
});

test('the digit door is closed to the worker and the public read', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    const found: (string | null)[] = [];
    for (const role of ['gabriel_agent', 'gabriel_read'])
      found.push(
        await refusal(ask, () => as(ask, role, () => ask('SELECT public.fact_digit($$x$$)'))),
      );
    return found;
  });
  for (const one of said) expect(one).toMatch(/permission denied/u);
});
