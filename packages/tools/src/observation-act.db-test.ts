// A figure that one page states is an act of its own (ADR 0031). Its promotion writes one figure,
// and its rejection writes none. Each test runs inside a transaction that rolls back.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as } from '../../../tools/author-fixture.ts';
import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { proposeOf } from './propose.ts';
import { callTool, type Session } from './tool.ts';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
// The door of a fetched document accepts only today or yesterday.
const TODAY = new Date().toISOString().slice(0, 10);
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';
const SHA = '9a'.repeat(32);
const DOC = `doc_${SHA.slice(0, 12)}`;
const EXTRACTOR = 'observation-act-test-1';

const TEXT =
  'Минфин России сообщает. Средняя цена нефти марки Urals в марте 2024 года составила ' +
  '71,03 долл. США за баррель.';
const EXCERPT = 'Средняя цена нефти марки Urals в марте 2024 года составила 71,03 долл. США';

const page = async (ask: Ask, text = TEXT): Promise<void> =>
  as(ask, 'gabriel_research', async () => {
    await ask(STORE, [
      'url',
      'The Urals price of March 2024',
      `raw/${SHA}`,
      'https://minfin.example/urals-2024-03',
      SHA,
      'text/html',
      TODAY,
      null,
    ]);
    await ask(WRITE_TEXT, [DOC, JSON.stringify([text]), EXTRACTOR]);
  });

const figure = (value: number, more: Readonly<Record<string, unknown>> = {}) => ({
  op: 'create_observation',
  measure: 'urals_price',
  value,
  unit: 'USD per barrel',
  period: '2024-03',
  reporter: 'RU',
  method: 'average of the month',
  publisher: 'Ministry of Finance of Russia',
  ...more,
});

const itemOf = (act: Readonly<Record<string, unknown>>, excerpt = EXCERPT) => ({
  ref: 'urals',
  act,
  originator: `Ministry of Finance of Russia ${randomUUID()}`,
  modality: 'asserts',
  evidence: [{ document: DOC, page: 1, excerpt }],
});

const proposed = async (ask: Ask, items: readonly unknown[]) =>
  as(ask, 'gabriel_research', () => callTool(proposeOf(null), sessionOf(ask), { items }));

const outcomeOf = z.object({
  proposals: z.array(z.object({ proposalId: z.uuid(), disputed: z.boolean() })).length(1),
});

const proposalOf = async (ask: Ask, act: Readonly<Record<string, unknown>>) => {
  const outcome = await proposed(ask, [itemOf(act)]);
  if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
  const [one] = outcomeOf.parse(outcome.output).proposals;
  if (one === undefined) throw new Error('no proposal came back');
  return one;
};

// An act is never decided by the transaction that proposed it, so the test dates it back.
const datedBack = async (ask: Ask, id: string): Promise<void> => {
  await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id = $1", [id]);
  await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
};

const FIGURES = `SELECT measure, value::float8 AS value, unit, period, reporter_system, reporter,
    publisher, licence, document_id::text AS document_id, text_extractor, page, span_start,
    span_end, job_id::text AS job_id, mapping_id::text AS mapping_id
  FROM public.observation WHERE mapping_id = $1`;

const figures = z.array(
  z.object({
    measure: z.string(),
    value: z.number(),
    unit: z.string(),
    period: z.string(),
    reporter_system: z.string(),
    reporter: z.string(),
    publisher: z.string(),
    licence: z.string(),
    document_id: z.string(),
    text_extractor: z.string(),
    page: z.number(),
    span_start: z.number(),
    span_end: z.number(),
    job_id: z.string().nullable(),
    mapping_id: z.string(),
  }),
);

test('a promoted figure act writes one figure, with the span of its excerpt and no load job', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await page(ask);
    const act = await proposalOf(ask, figure(71.03));
    await datedBack(ask, act.proposalId);
    await ask("SELECT public.promote_unit($1::uuid, 'a test')", [act.proposalId]);
    return { act, rows: figures.parse(await ask(FIGURES, [act.proposalId])) };
  });
  expect(seen.act.disputed).toBe(false);
  const start = TEXT.indexOf(EXCERPT);
  expect(seen.rows).toStrictEqual([
    {
      measure: 'urals_price',
      value: 71.03,
      unit: 'USD per barrel',
      period: '2024-03',
      reporter_system: 'iso3166',
      reporter: 'RU',
      publisher: 'Ministry of Finance of Russia',
      licence: 'restricted',
      document_id: DOC,
      text_extractor: EXTRACTOR,
      page: 1,
      span_start: start,
      span_end: start + EXCERPT.length,
      job_id: null,
      mapping_id: seen.act.proposalId,
    },
  ]);
});

test('a rejected figure act writes no figure', async () => {
  const rows = await rolledBack('superuser', async (ask) => {
    await page(ask);
    const act = await proposalOf(ask, figure(71.03));
    await ask("SELECT public.reject_unit($1::uuid, 'wrong_value', NULL, 'a test')", [
      act.proposalId,
    ]);
    return figures.parse(await ask(FIGURES, [act.proposalId]));
  });
  expect(rows).toStrictEqual([]);
});

test('a value that the excerpt does not hold makes the figure act disputed', async () => {
  const act = await rolledBack('superuser', async (ask) => {
    await page(ask);
    return proposalOf(ask, figure(71.3));
  });
  expect(act.disputed).toBe(true);
});

test('the door refuses a reporter outside the area list, and words read from an image', async () => {
  const refusals = await rolledBack('superuser', async (ask) => {
    await page(ask);
    // A refusal of the door aborts the transaction, and the rollback to the savepoint also undoes
    // the role.
    const refusal = async (item: unknown) => {
      await ask('SAVEPOINT refused');
      await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
      const outcome = await callTool(proposeOf(null), sessionOf(ask), { items: [item] });
      await ask('ROLLBACK TO SAVEPOINT refused');
      return outcome.ok ? 'written' : outcome.refusal;
    };
    const fromImage = {
      ...itemOf(figure(71.03)),
      evidence: [{ document: DOC, page: 1, excerpt: EXCERPT, fromImage: true }],
    };
    return {
      reporter: await refusal(itemOf(figure(71.03, { reporter: 'XX' }))),
      period: await refusal(itemOf(figure(71.03, { period: '2024-13' }))),
      image: await refusal(fromImage),
    };
  });
  expect(refusals.reporter).toMatch(/item urals: act\.reporter: .*not a code of the area list/u);
  expect(refusals.period).toMatch(/item urals: act\.measure: a figure cites one document/u);
  expect(refusals.image).toMatch(/item urals: a figure cites the stored text/u);
});

const BATCH = 'SELECT proposal_id::text AS id FROM public.propose_batch($1::jsonb)';

// The door of the batch reads no value, so a caller that does not use the tool writes the act. A
// span counts code points, and a string index counts UTF-16 units.
const directAct = (value: number, text = TEXT, excerpt = EXCERPT) => {
  const start = Array.from(text.slice(0, text.indexOf(excerpt))).length;
  const end = start + Array.from(excerpt).length;
  return {
    id: randomUUID(),
    op: 'create_observation',
    target_kind: null,
    target_id: null,
    payload: {
      measure: 'urals_price',
      value,
      unit: 'USD per barrel',
      period: '2024-03',
      reporter: 'RU',
      method: 'average of the month',
      publisher: 'Ministry of Finance of Russia',
    },
    src: [DOC],
    names: [],
    model_call_id: null,
    originator: 'Ministry of Finance of Russia',
    modality: 'asserts',
    citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, start, end }],
  };
};

// The promotion of a direct act: `promoted`, or the rule that refused it.
const promotion = async (value: number, text = TEXT, excerpt = EXCERPT): Promise<string> =>
  rolledBack('superuser', async (ask) => {
    await page(ask, text);
    const [act] = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        await as(ask, 'gabriel_research', () =>
          ask(BATCH, [JSON.stringify([directAct(value, text, excerpt)])]),
        ),
      );
    if (act === undefined) throw new Error('the door wrote no act');
    await datedBack(ask, act.id);
    await ask('SAVEPOINT promote');
    try {
      await ask("SELECT public.promote_unit($1::uuid, 'a test')", [act.id]);
      return 'promoted';
    } catch (cause) {
      return z.object({ constraint: z.string() }).parse(cause).constraint;
    } finally {
      await ask('ROLLBACK TO SAVEPOINT promote');
    }
  });

test('a promotion refuses a figure act whose excerpt does not hold its value', async () => {
  expect(await promotion(71.3)).toBe('observation_value_stated');
});

// The page writes a sign outside the Basic Multilingual Plane before the excerpt, so a span in
// UTF-16 units would miss the number.
test.each([
  [53.5, 'Доля 53,50 %'],
  [64.21, 'Импорт 2023 64,21 долл.'],
  [1234.5, 'Доход 1 234,5 млрд'],
  [1234.5, 'Revenue 1,234 or 1234,5'],
])('a promotion accepts the value %d in %j', async (value, excerpt) => {
  expect(await promotion(value, `📈 ${excerpt}.`, excerpt)).toBe('promoted');
});

test.each([
  [53, 'Доля 53,5 %'],
  [1234, 'Код 12 34'],
  [234.5, 'Revenue 1.234,5'],
])('a promotion refuses the value %d in %j', async (value, excerpt) => {
  expect(await promotion(value, `📈 ${excerpt}.`, excerpt)).toBe('observation_value_stated');
});
