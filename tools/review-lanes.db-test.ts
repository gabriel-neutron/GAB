// The review read sorts the units that wait in two lanes: the doubts, each with its reason, and the
// units that wait, each with the source that it needs. Each case runs inside a transaction that
// rolls back. The test database is shared, so every case reads one unit that it wrote, and the
// counts are read as a change.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, cited, label, rate, reference } from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const unitOf = async (ask: Ask, act: string): Promise<string> => {
  const [row] = z
    .array(z.object({ unit_id: z.uuid() }))
    .parse(await ask('SELECT unit_id FROM public.proposals WHERE id = $1', [act]));
  if (row === undefined) throw new Error('the record holds no such act');
  return row.unit_id;
};

const page = z.object({
  counts: z.object({ decided: z.number(), doubt: z.number(), waiting: z.number() }),
  matched: z.number(),
  units: z.array(
    z.object({ unit: z.uuid(), lane: z.enum(['doubt', 'waiting']), said: z.string().nullable() }),
  ),
});

// The page of the queue, read as the operator, for one unit or for all, in one lane or in both.
const read = async (ask: Ask, unit: string | null, lane: string | null) => {
  const [row] = z
    .array(z.object({ page }))
    .parse(
      await as(ask, 'gabriel_app', () =>
        ask(
          `SELECT public.review_units(NULL, 50, NULL, NULL, NULL, NULL, NULL, $1::uuid, $2) AS page`,
          [unit, lane],
        ),
      ),
    );
  if (row === undefined) throw new Error('the read gave no page');
  return row.page;
};

const check = (ask: Ask, act: string): Promise<unknown> =>
  as(ask, 'gabriel_agent', () =>
    ask('SELECT public.record_act_check($1::uuid, $2, $3, $4, $5)', [
      act,
      'a-checker',
      'openai',
      'anthropic',
      'supported',
    ]),
  );

const name = () => `Author ${randomUUID()}`;

test('a disputed unit is in the lane of the doubts with its reason, and not in the other lane', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const author = name();
    await rate(ask, author, 'C');
    const one = await cited(ask, { author, label: label(), dissentReason: 'two readings differ' });
    const unit = await unitOf(ask, one.act);
    return {
      doubt: await read(ask, unit, 'doubt'),
      waiting: await read(ask, unit, 'waiting'),
      both: await read(ask, unit, null),
    };
  });
  expect(seen.doubt.units).toHaveLength(1);
  expect(seen.doubt.units[0]?.lane).toBe('doubt');
  expect(seen.doubt.units[0]?.said).toContain('Disputed');
  expect(seen.waiting.units).toHaveLength(0);
  expect(seen.waiting.matched).toBe(0);
  expect(seen.both.units).toHaveLength(1);
});

test.each([
  ['no check', 'C', false, 'A passed check by a second model family for each fact'],
  ['a source C and a passed check', 'C', true, 'One source A on its own record, or two'],
  ['a source B and a passed check', 'B', true, 'A second independent author, C or better'],
])(
  'a unit with %s waits and says the source that it needs',
  async (_case, letter, checked, said) => {
    const seen = await rolledBack('superuser', async (ask) => {
      const author = name();
      if (letter === 'B') await reference(ask, author, letter);
      else await rate(ask, author, letter);
      const one = await cited(ask, { author, label: label() });
      if (checked) await check(ask, one.act);
      const unit = await unitOf(ask, one.act);
      return { waiting: await read(ask, unit, 'waiting'), doubt: await read(ask, unit, 'doubt') };
    });
    expect(seen.doubt.units).toHaveLength(0);
    expect(seen.waiting.units).toHaveLength(1);
    expect(seen.waiting.units[0]?.lane).toBe('waiting');
    expect(seen.waiting.units[0]?.said).toContain(said);
  },
);

test('the counts say how many units the rules decided and how many wait in each lane', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const before = (await read(ask, null, null)).counts;
    const strong = name();
    await reference(ask, strong, 'A');
    const weak = name();
    await rate(ask, weak, 'C');
    await cited(ask, { author: weak, label: label(), dissentReason: 'differ' });
    await cited(ask, { author: weak, label: label() });
    const accepted = await cited(ask, { author: strong, label: label() });
    const middle = (await read(ask, null, null)).counts;
    await check(ask, accepted.act);
    const after = (await read(ask, null, null)).counts;
    return { before, middle, after };
  });
  expect(seen.middle.doubt - seen.before.doubt).toBe(1);
  expect(seen.middle.waiting - seen.before.waiting).toBe(2);
  expect(seen.after.decided - seen.middle.decided).toBe(1);
  expect(seen.after.waiting - seen.middle.waiting).toBe(-1);
});

test('the history of the decisions gives the origin of a decision of a rule', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const author = name();
    await reference(ask, author, 'A');
    const one = await cited(ask, { author, label: label() });
    await check(ask, one.act);
    const [row] = z
      .array(z.object({ history: z.object({ acts: z.array(z.unknown()) }) }))
      .parse(
        await as(ask, 'gabriel_app', () =>
          ask('SELECT public.review_decided(NULL, NULL, 500) AS history'),
        ),
      );
    const acts = (row?.history.acts ?? []).flatMap((held) => {
      const parsed = z
        .object({ id: z.string(), decisionOrigin: z.string().nullable() })
        .safeParse(held);
      return parsed.success ? [parsed.data] : [];
    });
    return acts.find((held) => held.id === one.act);
  });
  expect(seen?.decisionOrigin).toMatch(/^rule strong_sources v1/u);
});
