// The propose tool stores a claimed event like any other fact. Each test runs inside a transaction
// that rolls back, so the corpus stays as it was.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, OWN_SITE, rate, reference } from '../../../tools/author-fixture.ts';
import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { proposeOf } from './propose.ts';
import { callTool, type Session } from './tool.ts';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
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
      '2026-10-01',
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
      await as(ask, 'gabriel_app', () =>
        ask(
          `SELECT status, public.unit_rule(unit_id) AS rule, dissent
             FROM public.proposals WHERE id = $1`,
          [act],
        ),
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
