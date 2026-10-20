// The propose tool stores a claimed event like any other fact. Each test runs inside a transaction
// that rolls back, so the corpus stays as it was.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, OWN_SITE, rate, reference } from '../../../tools/author-fixture.ts';
import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { proposeOf } from './propose.ts';
import { callTool, type ItemToCheck, type Reach, type Session } from './tool.ts';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
// The door of a fetched document accepts only today or yesterday.
const TODAY = new Date().toISOString().slice(0, 10);
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

// The research role stores a post and its text. The number makes the hash, and so the identifier.
const post = async (ask: Ask, number: number, uri: string, text: string): Promise<string> => {
  const sha = number.toString(16).repeat(64);
  const id = `doc_${sha.slice(0, 12)}`;
  await as(ask, 'gabriel_research', async () => {
    await ask(STORE, [
      'url',
      `A post ${String(number)}`,
      `raw/${sha}`,
      uri,
      sha,
      'text/html',
      TODAY,
      null,
    ]);
    await ask(WRITE_TEXT, [id, JSON.stringify([text]), 'event-test-1']);
  });
  return id;
};

const NIGHT = 'у ніч на 15 травня 2026';
const SITE = 'Afipsky refinery';
const NAME = `claimed attack — ${SITE} — 2026-05-15`;

const eventAct = (label: string, extra: Readonly<Record<string, unknown>> = {}) => ({
  op: 'create_entity',
  type: 'event',
  label,
  attrs: {
    event_kind: { v: 'claimed attack' },
    occurred_on: { v: ['2026-05-14', '2026-05-15'] },
    occurred_on_precision: { v: 'night' },
  },
  ...extra,
});

const item = (
  ref: string,
  act: Readonly<Record<string, unknown>>,
  document: string,
  excerpt: string,
  author: string,
  modality = 'asserts',
) => ({
  ref,
  act,
  originator: author,
  modality,
  evidence: [{ document, page: 1, excerpt }],
});

const proposed = async (ask: Ask, items: readonly unknown[]) =>
  as(ask, 'gabriel_research', () => callTool(proposeOf(null), sessionOf(ask), { items }));

const ids = z.object({ proposals: z.array(z.object({ ref: z.string(), proposalId: z.uuid() })) });

const idOf = async (ask: Ask, items: readonly unknown[], ref = 'ev'): Promise<string> => {
  const outcome = await proposed(ask, items);
  if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
  const found = ids.parse(outcome.output).proposals.find((one) => one.ref === ref);
  if (found === undefined) throw new Error(`no proposal for ${ref}`);
  return found.proposalId;
};

const check = (ask: Ask, act: string): Promise<unknown> =>
  as(ask, 'gabriel_checker', () =>
    ask('SELECT public.record_research_check($1::uuid, $2, $3, $4, $5)', [
      act,
      'a-checker',
      'openai',
      'anthropic',
      'supported',
    ]),
  );

const stateOf = async (ask: Ask, act: string) => {
  const [row] = z
    .array(z.object({ status: z.string(), rule: z.string().nullable(), dissent: z.boolean() }))
    .parse(
      await ask(
        `SELECT status, public.unit_rule(unit_id) AS rule, dissent
           FROM public.proposals WHERE id = $1`,
        [act],
      ),
    );
  if (row === undefined) throw new Error('the record holds no such act');
  return row;
};

const name = () => `Author ${randomUUID()}`;

const OWN_URI = 'https://records.register.example/event/1';
const FIRST_TEXT = `Генштаб повідомив: ${NIGHT} року уражено ${SITE} у Краснодарському краї.`;
const SECOND_TEXT = `Local residents heard explosions near the plant, and on ${NIGHT} (15 May 2026) a fire was reported at ${SITE}.`;
const DENIAL_TEXT = `Міноборони заперечує: ${NIGHT} року жодного удару по ${SITE} не було.`;

test('an event of a source A on its own site is accepted when the check passes', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await reference(ask, author, 'A', OWN_SITE);
    const doc = await post(ask, 1, OWN_URI, FIRST_TEXT);
    const act = await idOf(ask, [
      item('ev', eventAct(NAME), doc, `${NIGHT} року уражено ${SITE}`, author),
    ]);
    const before = (await stateOf(ask, act)).status;
    await check(ask, act);
    return { before, after: await stateOf(ask, act) };
  });
  expect(read.before).toBe('pending');
  expect(read.after).toMatchObject({ status: 'accepted', dissent: false });
});

test.each([
  ['a name with no kind', `${SITE} — 2026-05-15`],
  ['a name with a kind that is not on the list', `explosion — ${SITE} — 2026-05-15`],
  ['a name with another kind than the attribute', `fire — ${SITE} — 2026-05-15`],
  ['a name with another day than the attribute', `claimed attack — ${SITE} — 2026-05-14`],
  ['a free name', `Strike on ${SITE}`],
  ['a name with hyphens and not dashes', `claimed attack - ${SITE} - 2026-05-15`],
])('propose refuses %s', async (_case, label) => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const author = name();
    const doc = await post(ask, 2, OWN_URI, FIRST_TEXT);
    return proposed(ask, [
      item('ev', eventAct(label), doc, `${NIGHT} року уражено ${SITE}`, author),
    ]);
  });
  expect(outcome.ok).toBe(false);
  if (!outcome.ok) expect(outcome.refusal).toMatch(/^item ev: /u);
});

test('the day and the precision of an event must agree', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 2, OWN_URI, FIRST_TEXT);
    const act = eventAct(NAME, {
      attrs: {
        event_kind: { v: 'claimed attack' },
        occurred_on: { v: ['2026-05-15'] },
        occurred_on_precision: { v: 'night' },
      },
    });
    return proposed(ask, [item('ev', act, doc, `${NIGHT} року уражено ${SITE}`, name())]);
  });
  expect(outcome.ok).toBe(false);
});

test('the name and the kind of an event are no value that the excerpt must state', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 3, OWN_URI, FIRST_TEXT);
    const outcome = await proposed(ask, [
      item('ev', eventAct(NAME), doc, `${NIGHT} року уражено ${SITE}`, name()),
    ]);
    if (!outcome.ok) throw new Error(outcome.refusal);
    return outcome.output;
  });
  expect(read).toMatchObject({ proposals: [{ disputed: false, unstated: [] }] });
});

test('an event whose excerpt does not state its day is disputed', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 3, OWN_URI, FIRST_TEXT);
    const outcome = await proposed(ask, [
      item(
        'ev',
        eventAct(`claimed attack — ${SITE} — 2026-05-16`, {
          attrs: {
            event_kind: { v: 'claimed attack' },
            occurred_on: { v: ['2026-05-15', '2026-05-16'] },
            occurred_on_precision: { v: 'night' },
          },
        }),
        doc,
        `${NIGHT} року уражено ${SITE}`,
        name(),
      ),
    ]);
    if (!outcome.ok) throw new Error(outcome.refusal);
    return outcome.output;
  });
  expect(read).toMatchObject({ proposals: [{ disputed: true, unstated: ['attrs.occurred_on'] }] });
});

const YEARLESS = 'у ніч на 15 травня';
const YEARLESS_EXCERPT = `${YEARLESS} уражено ${SITE}`;

const yearlessItem = (
  doc: string,
  author: string,
  extra: Readonly<Record<string, unknown>> = {},
) => ({
  ...item('ev', eventAct(NAME), doc, YEARLESS_EXCERPT, author),
  ...extra,
});

const faultWords = async (ask: Ask, act: string): Promise<string[]> =>
  z
    .array(z.object({ faults: z.array(z.object({ said: z.string() })) }))
    .parse(await ask('SELECT faults FROM public.unit_faults(ARRAY[$1::uuid])', [act]))
    .flatMap((row) => row.faults.map((fault) => fault.said));

test('a night with no year takes the year of published_on, and the card says so', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await reference(ask, author, 'A', OWN_SITE);
    const doc = await post(ask, 11, OWN_URI, `Генштаб повідомив: ${YEARLESS_EXCERPT}.`);
    const outcome = await proposed(ask, [
      yearlessItem(doc, author, { published_on: '2026-05-15' }),
    ]);
    if (!outcome.ok) throw new Error(outcome.refusal);
    const act = ids.parse(outcome.output).proposals[0]?.proposalId ?? '';
    await check(ask, act);
    const [stored] = z
      .array(z.object({ days: z.unknown() }))
      .parse(
        await ask(
          "SELECT payload->'attrs'->'occurred_on'->'v' AS days FROM public.proposals WHERE id = $1",
          [act],
        ),
      );
    return {
      output: outcome.output,
      days: stored?.days,
      state: await stateOf(ask, act),
      said: await faultWords(ask, act),
    };
  });
  expect(read.output).toMatchObject({ proposals: [{ disputed: true, unstated: [] }] });
  expect(read.days).toStrictEqual(['2026-05-14', '2026-05-15']);
  expect(read.state).toMatchObject({ status: 'pending', dissent: true });
  expect(read.said).toContain('Disputed: year deduced from the publication of 2026-05-15');
});

test('published_on for the whole call serves each item', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 12, OWN_URI, `Генштаб повідомив: ${YEARLESS_EXCERPT}.`);
    return as(ask, 'gabriel_research', () =>
      callTool(proposeOf(null), sessionOf(ask), {
        items: [yearlessItem(doc, name())],
        published_on: '2026-05-15',
      }),
    );
  });
  expect(read).toMatchObject({
    ok: true,
    output: { proposals: [{ disputed: true, unstated: [] }] },
  });
});

test('a year in the excerpt wins over published_on and the item is not marked as deduced', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const author = name();
    await reference(ask, author, 'A', OWN_SITE);
    const doc = await post(ask, 13, OWN_URI, `Генштаб повідомив: ${NIGHT} року уражено ${SITE}.`);
    const act = await idOf(ask, [
      {
        ...item('ev', eventAct(NAME), doc, `${NIGHT} року уражено ${SITE}`, author),
        published_on: '2024-01-01',
      },
    ]);
    await check(ask, act);
    return { state: await stateOf(ask, act), said: await faultWords(ask, act) };
  });
  expect(read.state).toMatchObject({ status: 'accepted', dissent: false });
  expect(read.said.join(' ')).not.toContain('deduced');
});

test('the published_on of an item beats the one of the call', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 5, OWN_URI, `Генштаб повідомив: ${YEARLESS_EXCERPT}.`);
    return as(ask, 'gabriel_research', () =>
      callTool(proposeOf(null), sessionOf(ask), {
        items: [yearlessItem(doc, name(), { published_on: '2025-05-15' })],
        published_on: '2026-05-15',
      }),
    );
  });
  expect(read).toMatchObject({
    ok: true,
    output: { proposals: [{ unstated: ['attrs.occurred_on'] }] },
  });
});

const daysFromToday = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test('published_on may be one day after today in UTC, and no later', async () => {
  const outcomeOf = (day: string) =>
    rolledBack('superuser', async (ask) => {
      const doc = await post(ask, 6, OWN_URI, `Генштаб повідомив: ${YEARLESS_EXCERPT}.`);
      return proposed(ask, [yearlessItem(doc, name(), { published_on: day })]);
    });
  expect(await outcomeOf(daysFromToday(1))).toMatchObject({ ok: true });
  expect(await outcomeOf(daysFromToday(2))).toMatchObject({ ok: false });
});

test('a night with no year and no published_on stays contested', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 14, OWN_URI, `Генштаб повідомив: ${YEARLESS_EXCERPT}.`);
    const outcome = await proposed(ask, [yearlessItem(doc, name())]);
    if (!outcome.ok) throw new Error(outcome.refusal);
    return outcome.output;
  });
  expect(read).toMatchObject({
    proposals: [{ disputed: true, unstated: ['attrs.occurred_on'] }],
  });
});

test.each([
  ['a day in the future', '2999-01-01', 'in the future'],
  ['no day of the calendar', '2026-02-30', 'is a day of the calendar'],
])('published_on that is %s is refused', async (_why, day, words) => {
  const read = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 15, OWN_URI, `Генштаб повідомив: ${YEARLESS_EXCERPT}.`);
    return proposed(ask, [yearlessItem(doc, name(), { published_on: day })]);
  });
  expect(read).toMatchObject({ ok: false });
  expect(JSON.stringify(read)).toContain(words);
});

test('two posts about one strike corroborate each other', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [one, two] = [name(), name()];
    await reference(ask, one, 'B');
    await rate(ask, two, 'C');
    const first = await post(ask, 4, 'https://one.example/a', FIRST_TEXT);
    const second = await post(ask, 5, 'https://two.example/b', SECOND_TEXT);
    const early = await idOf(ask, [
      item('ev', eventAct(NAME), first, `${NIGHT} року уражено ${SITE}`, one),
    ]);
    const late = await idOf(ask, [
      item(
        'ev',
        eventAct(NAME),
        second,
        `on ${NIGHT} (15 May 2026) a fire was reported at ${SITE}`,
        two,
      ),
    ]);
    await check(ask, early);
    const alone = (await stateOf(ask, early)).status;
    await check(ask, late);
    return { alone, after: [await stateOf(ask, early), await stateOf(ask, late)] };
  });
  expect(read.alone).toBe('pending');
  // Both acts state one claim. The first unit that the rules decide writes the event.
  expect(read.after.filter((one) => one.status === 'accepted')).toHaveLength(1);
});

test('a denial by a party to the conflict puts the event in doubt', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [claimant, party] = [name(), name()];
    await reference(ask, claimant, 'B');
    await reference(ask, party, 'A', { ...OWN_SITE, party: true, controller: 'A State' });
    const first = await post(ask, 6, 'https://one.example/a', FIRST_TEXT);
    const denial = await post(ask, 7, 'https://records.register.example/denial', DENIAL_TEXT);
    const claim = await idOf(ask, [
      item('ev', eventAct(NAME), first, `${NIGHT} року уражено ${SITE}`, claimant),
    ]);
    await check(ask, claim);
    const before = await stateOf(ask, claim);
    await idOf(ask, [
      item('ev', eventAct(NAME), denial, `${NIGHT} року жодного удару по ${SITE}`, party, 'denies'),
    ]);
    return { before, after: await stateOf(ask, claim) };
  });
  expect(read.before.rule).toBe('weak_sources');
  expect(read.after).toMatchObject({ status: 'pending', rule: 'doubt' });
});

test('a lone claim of a party to the conflict waits', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const party = name();
    await reference(ask, party, 'A', { ...OWN_SITE, party: true, controller: 'A State' });
    const doc = await post(ask, 8, OWN_URI, FIRST_TEXT);
    const act = await idOf(ask, [
      item('ev', eventAct(NAME), doc, `${NIGHT} року уражено ${SITE}`, party),
    ]);
    await check(ask, act);
    return stateOf(ask, act);
  });
  expect(read).toMatchObject({ status: 'pending', rule: 'weak_sources' });
});

const site = (type: string, label: string) => ({ op: 'create_entity', type, label });

test('an event with a place and no site name is kept with no occurred_at relation', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 9, OWN_URI, `${NIGHT} року уражено Tuapse`);
    return proposed(ask, [
      item(
        'ev',
        eventAct('claimed attack — Tuapse — 2026-05-15'),
        doc,
        `${NIGHT} року уражено Tuapse`,
        name(),
      ),
    ]);
  });
  expect(outcome.ok).toBe(true);
});

test.each([
  ['an installation', 'facility', true],
  ['a port', 'port', true],
  ['a vessel', 'vessel', true],
  ['a company', 'company', false],
  ['a person', 'person', false],
])('occurred_at to %s', async (_case, type, accepted) => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 9, OWN_URI, FIRST_TEXT);
    const excerpt = `${NIGHT} року уражено ${SITE}`;
    const author = name();
    return proposed(ask, [
      item('ev', eventAct(NAME), doc, excerpt, author),
      item('target', site(type, SITE), doc, excerpt, author),
      item(
        'link',
        { op: 'create_relation', type: 'occurred_at', srcId: 'ev', dstId: 'target' },
        doc,
        excerpt,
        author,
      ),
    ]);
  });
  expect(outcome.ok).toBe(accepted);
  if (!outcome.ok) expect(outcome.refusal).toMatch(/^item link: /u);
});

test.each([
  ['a military unit', 'military_unit', true],
  ['a state body', 'state_body', true],
  ['a company', 'company', false],
])('carried_out_by to %s', async (_case, type, accepted) => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, 9, OWN_URI, FIRST_TEXT);
    const excerpt = `${NIGHT} року уражено ${SITE}`;
    const author = name();
    return proposed(ask, [
      item('ev', eventAct(NAME), doc, excerpt, author),
      item('actor', site(type, 'Actor'), doc, excerpt, author),
      item(
        'link',
        { op: 'create_relation', type: 'carried_out_by', srcId: 'ev', dstId: 'actor' },
        doc,
        excerpt,
        author,
      ),
    ]);
  });
  expect(outcome.ok).toBe(accepted);
});

// The checker reads a passage that gives a weekday only with two dates: the day of publication
// and the weekday of the claimed day.
const WEEKDAY_TEXT = `A fire began on Tuesday at ${SITE}, the residents said.`;
const TUESDAY = 'claimed attack — Afipsky refinery — 2026-05-12';

const dayEvent = eventAct(TUESDAY, {
  attrs: {
    event_kind: { v: 'claimed attack' },
    occurred_on: { v: ['2026-05-12'] },
    occurred_on_precision: { v: 'day' },
  },
});

const readByChecker = async (
  uri: string,
  number: number,
  given: { readonly published_on?: string } = {},
) => {
  const items: ItemToCheck[] = [];
  const reach: Reach = {
    now: () => new Date(),
    check: async (asked) => {
      items.push(...asked);
      return Promise.resolve(
        new Map(asked.map((one) => [one.ref, { verdict: 'supported' as const }])),
      );
    },
  };
  await rolledBack('superuser', async (ask) => {
    const doc = await post(ask, number, uri, WEEKDAY_TEXT);
    await as(ask, 'gabriel_research', () =>
      callTool(
        proposeOf(null),
        sessionOf(ask),
        { items: [item('ev', dayEvent, doc, 'on Tuesday', name())], ...given },
        reach,
      ),
    );
  });
  return items;
};

test('the checker receives the weekday of the claimed day and the date in the address', async () => {
  const [asked] = await readByChecker('https://news.example/2026/05/13/fire-at-the-plant', 4);
  expect(asked?.claim.occurredOnWeekdays).toStrictEqual([
    { day: '2026-05-12', weekday: 'Tuesday' },
  ]);
  expect(asked?.passages.map((one) => one.publishedOn)).toStrictEqual(['2026-05-13']);
});

test('the checker receives the day that the caller gave before the date in the address', async () => {
  const [asked] = await readByChecker('https://news.example/2026/05/20/fire-at-the-plant', 5, {
    published_on: '2026-05-13',
  });
  expect(asked?.passages.map((one) => one.publishedOn)).toStrictEqual(['2026-05-13']);
});

test('the checker receives no day when neither the caller nor the address gives one', async () => {
  const [asked] = await readByChecker('https://news.example/world/fire-at-the-plant', 6);
  expect(asked?.passages.map((one) => one.publishedOn)).toStrictEqual([null]);
});
