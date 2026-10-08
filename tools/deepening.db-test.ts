// The deepening search: a unit with weak sources starts one lead job inside a budget that the
// operator sets, and a unit whose only sources are D or E is rejected after that search. Each case
// runs inside a transaction that rolls back, and reads only the rows that it wrote.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, cited, label, rate, type Cited } from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const BUDGET = 40_000;

const author = (): string => `Author ${randomUUID()}`;

// The operator sets the budget: a new version of the rule and its setting, in one statement.
const budgeted = (ask: Ask, tokens: number): Promise<unknown> =>
  ask(
    `UPDATE public.rule_config
        SET version = version + 1, settings = jsonb_build_object('deepening_tokens', $1::int)
      WHERE rule = 'weak_sources'`,
    [tokens],
  );

const check = (ask: Ask, one: Cited): Promise<unknown> =>
  as(ask, 'gabriel_agent', () =>
    ask('SELECT public.record_act_check($1::uuid, $2, $3, $4, $5)', [
      one.act,
      'a-checker',
      'openai',
      'anthropic',
      'supported',
    ]),
  );

// A weak unit: one fact from an author of this letter, with a passed check.
const weak = async (ask: Ask, letter: string, fact = label()): Promise<Cited> => {
  const who = author();
  await rate(ask, who, letter);
  const one = await cited(ask, { author: who, label: fact });
  await check(ask, one);
  return one;
};

const jobs = z.array(
  z.object({
    id: z.uuid(),
    status: z.string(),
    lead: z.string(),
    lead_by: z.string(),
    token_budget: z.number().nullable(),
  }),
);

const deepeningOf = async (ask: Ask, act: string) =>
  jobs.parse(
    await ask(
      `SELECT j.id, j.status, j.lead, j.lead_by, j.token_budget
         FROM public.deepening d
         JOIN public.jobs j ON j.id = d.job_id
         JOIN public.proposals p ON p.unit_id = d.unit_id
        WHERE p.id = $1`,
      [act],
    ),
  );

const statusOf = async (ask: Ask, act: string) => {
  const [row] = z
    .array(
      z.object({
        status: z.string(),
        decided_by: z.string().nullable(),
        decided_as: z.string().nullable(),
        decision_origin: z.string().nullable(),
      }),
    )
    .parse(
      await ask(
        'SELECT status, decided_by, decided_as, decision_origin FROM public.proposals WHERE id = $1',
        [act],
      ),
    );
  if (row === undefined) throw new Error('the record holds no such act');
  return row;
};

// The worker runs the lead and ends it. The test sets the state of the row, as a claim would.
const run = (ask: Ask, job: string): Promise<unknown> =>
  ask("UPDATE public.jobs SET status = 'running', claimed_at = now() WHERE id = $1", [job]);

const ends = (ask: Ask, job: string, how: 'done' | 'failed'): Promise<unknown> =>
  as(ask, 'gabriel_agent', () =>
    how === 'done'
      ? ask('SELECT public.complete_job($1::uuid)', [job])
      : ask("SELECT public.fail_job($1::uuid, 'the token budget of this lead is spent')", [job]),
  );

test('the budget starts at zero, so no deepening search runs', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const one = await weak(ask, 'D');
    const [row] = z
      .array(z.object({ settings: z.record(z.string(), z.unknown()) }))
      .parse(await ask("SELECT settings FROM public.rule_config WHERE rule = 'weak_sources'"));
    return { settings: row?.settings, started: await deepeningOf(ask, one.act) };
  });
  expect(read.settings).toEqual({ deepening_tokens: 0 });
  expect(read.started).toHaveLength(0);
});

test('with a budget, a weak unit starts one deepening search that carries the budget', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const one = await weak(ask, 'D');
    const started = await deepeningOf(ask, one.act);
    // A later pass of the rules over the same unit starts no second search.
    const again = await weak(ask, 'D');
    await ask(
      'SELECT public.run_rules(ARRAY(SELECT unit_id FROM public.proposals WHERE id = $1))',
      [one.act],
    );
    return {
      started,
      again: await deepeningOf(ask, again.act),
      after: await deepeningOf(ask, one.act),
    };
  });
  expect(read.started).toHaveLength(1);
  expect(read.started[0]).toMatchObject({
    status: 'queued',
    lead_by: 'rule weak_sources',
    token_budget: BUDGET,
  });
  expect(read.started[0]?.lead.length).toBeGreaterThan(0);
  expect(read.again).toHaveLength(1);
  expect(read.after).toHaveLength(1);
  expect(read.again[0]?.id).not.toBe(read.started[0]?.id);
});

test('a unit whose check has not ended starts no search', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const who = author();
    await rate(ask, who, 'D');
    const one = await cited(ask, { author: who, label: label() });
    return deepeningOf(ask, one.act);
  });
  expect(read).toHaveLength(0);
});

test.each([
  ['D', 'rejected'],
  ['E', 'rejected'],
  ['C', 'pending'],
  ['F', 'pending'],
])('after the search ends, a unit with only a source %s is %s', async (letter, expected) => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const one = await weak(ask, letter);
    const [search] = await deepeningOf(ask, one.act);
    const before = (await statusOf(ask, one.act)).status;
    if (search === undefined) throw new Error('the search did not start');
    await run(ask, search.id);
    const running = (await statusOf(ask, one.act)).status;
    await ends(ask, search.id, 'done');
    return { before, running, after: await statusOf(ask, one.act) };
  });
  expect(read.before).toBe('pending');
  expect(read.running).toBe('pending');
  expect(read.after.status).toBe(expected);
  if (expected === 'rejected') {
    expect(read.after.decided_as).toBe('rule');
    expect(read.after.decided_by).toMatch(/^rule weak_sources v\d+$/u);
    expect(read.after.decision_origin).toMatch(/^rule weak_sources v\d+ \(fact digits: /u);
  }
});

test('a search that failed or stopped at its budget rejects nothing', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const one = await weak(ask, 'D');
    const [search] = await deepeningOf(ask, one.act);
    if (search === undefined) throw new Error('the search did not start');
    await run(ask, search.id);
    await ends(ask, search.id, 'failed');
    return { state: await statusOf(ask, one.act), again: await deepeningOf(ask, one.act) };
  });
  expect(read.state.status).toBe('pending');
  expect(read.again).toHaveLength(1);
});

test('a source whose check did not pass does not keep the unit', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const fact = label();
    const first = await weak(ask, 'D', fact);
    const [search] = await deepeningOf(ask, first.act);
    if (search === undefined) throw new Error('the search did not start');
    await run(ask, search.id);
    // A better author gives the fact, and the check finds the passage unclear: no source.
    const better = author();
    await rate(ask, better, 'C');
    const second = await cited(ask, { author: better, label: fact });
    // The act waits no more, so that it is no duplicate of the first one.
    await ask(
      `UPDATE public.proposals SET status = 'accepted', decided_at = now(), decided_by = 'a test',
         decided_as = 'unit' WHERE id = $1`,
      [second.act],
    );
    await as(ask, 'gabriel_agent', () =>
      ask(
        "SELECT public.record_act_check($1::uuid, 'a-checker', 'openai', 'anthropic', 'unclear')",
        [second.act],
      ),
    );
    await ends(ask, search.id, 'done');
    return statusOf(ask, first.act);
  });
  expect(read.status).toBe('rejected');
});

test('a budget that rises from zero starts the search of the units that wait', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const one = await weak(ask, 'D');
    const before = await deepeningOf(ask, one.act);
    await budgeted(ask, BUDGET);
    const after = await deepeningOf(ask, one.act);
    await budgeted(ask, BUDGET * 2);
    return { before, after, later: await deepeningOf(ask, one.act) };
  });
  expect(read.before).toHaveLength(0);
  expect(read.after).toHaveLength(1);
  expect(read.after[0]).toMatchObject({ token_budget: BUDGET });
  expect(read.later).toHaveLength(1);
});

test('the unit waits while an extraction of a page of the search is open', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const one = await weak(ask, 'D');
    const [search] = await deepeningOf(ask, one.act);
    if (search === undefined) throw new Error('the search did not start');
    const page = { id: `doc_${randomUUID().slice(0, 8)}` };
    await ask(
      `SELECT public.put_document($1, 'file', $2, $3, NULL, NULL, NULL, 'text/plain',
         '2026-10-07'::date)`,
      [page.id, `Source ${page.id}`, `raw/${page.id}.txt`],
    );
    await run(ask, search.id);
    await ask('INSERT INTO public.lead_document (job_id, document_id) VALUES ($1, $2)', [
      search.id,
      page.id,
    ]);
    await ask(
      "INSERT INTO public.jobs (kind, document_id, status, claimed_at, claimed_by) VALUES ('extract_text', $1, 'running', now(), 'gabriel_agent')",
      [page.id],
    );
    await ends(ask, search.id, 'done');
    const open = (await statusOf(ask, one.act)).status;
    const [extract] = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        await ask(
          "SELECT id FROM public.jobs WHERE kind = 'extract_text' AND document_id = $1 AND status = 'running'",
          [page.id],
        ),
      );
    if (extract === undefined) throw new Error('the extraction row is absent');
    await ends(ask, extract.id, 'done');
    return { open, closed: (await statusOf(ask, one.act)).status };
  });
  expect(read.open).toBe('pending');
  expect(read.closed).toBe('rejected');
});

test('a unit with a fact that no check passed is kept, even when the other fact is weak', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const first = await weak(ask, 'D');
    const [search] = await deepeningOf(ask, first.act);
    if (search === undefined) throw new Error('the search did not start');
    await run(ask, search.id);
    // A second fact joins the unit. Nothing checked it, so nothing judged it.
    const who = author();
    await rate(ask, who, 'D');
    const second = await cited(ask, { author: who, label: label() });
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask(
      'UPDATE public.proposals SET unit_id = (SELECT unit_id FROM public.proposals WHERE id = $1) WHERE id = $2',
      [first.act, second.act],
    );
    await ask('ALTER TABLE public.proposals ENABLE TRIGGER proposals_append_only');
    await ends(ask, search.id, 'done');
    return statusOf(ask, first.act);
  });
  expect(read.status).toBe('pending');
});

test('a search that finds a source C keeps the unit', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await budgeted(ask, BUDGET);
    const fact = label();
    const first = await weak(ask, 'D', fact);
    const [search] = await deepeningOf(ask, first.act);
    if (search === undefined) throw new Error('the search did not start');
    await run(ask, search.id);
    // The search stores a page, and its extraction gives a better source for the same fact.
    const better = author();
    await rate(ask, better, 'C');
    const second = await cited(ask, { author: better, label: fact });
    await check(ask, second);
    await ends(ask, search.id, 'done');
    return statusOf(ask, first.act);
  });
  expect(read.status).not.toBe('rejected');
});
