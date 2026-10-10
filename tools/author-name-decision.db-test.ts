// The operator confirms or refuses a name that joined an author A or B (ADR 0012, #434). Each case
// runs inside a transaction that rolls back, and it reads only the rows that it wrote.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import {
  as,
  cited,
  join,
  label,
  rate as worker,
  reference,
  refusal,
  type Cited,
} from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const name = () => `Author ${randomUUID()}`;
const key = (one: string) => one.toLowerCase();

const ONE = {
  uri: 'https://one.example/a',
  text: 'The fifty seventh brigade now holds the eastern bank of the river.',
};

const check = (ask: Ask, one: Cited): Promise<unknown> =>
  as(ask, 'gabriel_checker', () =>
    ask('SELECT public.record_research_check($1::uuid, $2, $3, $4, $5)', [
      one.act,
      'a-checker',
      'openai',
      'anthropic',
      'supported',
    ]),
  );

const letter = async (ask: Ask, one: string): Promise<string> =>
  z
    .array(z.object({ letter: z.string() }))
    .parse(await as(ask, 'gabriel_app', () => ask('SELECT public.letter_of($1) AS letter', [one])))
    .at(0)?.letter ?? '';

const ruleOf = async (ask: Ask, act: string): Promise<string | null> =>
  z
    .array(z.object({ rule: z.string().nullable() }))
    .parse(
      await as(ask, 'gabriel_app', () =>
        ask('SELECT public.unit_rule(unit_id) AS rule FROM public.proposals WHERE id = $1', [act]),
      ),
    )
    .at(0)?.rule ?? null;

const statusOf = async (ask: Ask, act: string): Promise<string> =>
  z
    .array(z.object({ status: z.string() }))
    .parse(await ask('SELECT status FROM public.proposals WHERE id = $1', [act]))
    .at(0)?.status ?? '';

const decide = (ask: Ask, one: string, confirm: boolean) =>
  as(ask, 'gabriel_app', () =>
    ask('SELECT public.decide_author_name($1, $2) AS units', [one, confirm]),
  );

const waiting = z.array(
  z.object({
    name_key: z.string(),
    author: z.string(),
    letter: z.string(),
    units: z.number(),
  }),
);

const dryRun = z.array(
  z.object({
    name_key: z.string(),
    units: z.number(),
    change_if_confirmed: z.number(),
    change_if_refused: z.number(),
  }),
);

/** An author A, a name of it that a fact cites with a passed check, and the join of that name. */
const joined = async (ask: Ask) => {
  const [known, alias] = [name(), name()];
  await reference(ask, known, 'A');
  const one = await cited(ask, { author: alias, label: label(), ...ONE });
  await check(ask, one);
  await join(ask, alias, known);
  return { known, alias, one };
};

test('a name that joined an author A reads as F, and its unit is a doubt, until the operator decides', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { known, alias, one } = await joined(ask);
    return {
      alias: await letter(ask, alias),
      known: await letter(ask, known),
      rule: await ruleOf(ask, one.act),
      waiting: waiting.parse(
        await as(ask, 'gabriel_app', () =>
          ask('SELECT * FROM public.author_names_waiting() WHERE name_key = $1', [key(alias)]),
        ),
      ),
    };
  });
  expect(read.alias).toBe('F');
  expect(read.known).toBe('A');
  expect(read.rule).toBe('doubt');
  expect(read.waiting).toHaveLength(1);
  expect(read.waiting[0]).toMatchObject({ letter: 'A', units: 1 });
});

test('the dry-run gives the changes of each decision and writes nothing', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { alias, one } = await joined(ask);
    const rows = dryRun.parse(
      await as(ask, 'gabriel_app', () =>
        ask('SELECT * FROM public.author_names_dry_run() WHERE name_key = $1', [key(alias)]),
      ),
    );
    return {
      key: key(alias),
      rows,
      decisions: await ask(
        'SELECT count(*)::int AS n FROM public.author_name_decision WHERE name_key = $1',
        [key(alias)],
      ),
      rule: await ruleOf(ask, one.act),
      status: await statusOf(ask, one.act),
      letter: await letter(ask, alias),
    };
  });
  expect(read.rows).toStrictEqual([
    { name_key: read.key, units: 1, change_if_confirmed: 1, change_if_refused: 1 },
  ]);
  expect(read.decisions).toStrictEqual([{ n: 0 }]);
  expect(read.rule).toBe('doubt');
  expect(read.status).toBe('pending');
  expect(read.letter).toBe('F');
});

test('a confirmation gives the letter of the author, and the rules decide the unit again', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { alias, one } = await joined(ask);
    const done = await decide(ask, alias, true);
    return {
      done,
      letter: await letter(ask, alias),
      status: await statusOf(ask, one.act),
      again: await refusal(ask, () => decide(ask, alias, false)),
      waiting: await as(ask, 'gabriel_app', () =>
        ask('SELECT * FROM public.author_names_waiting() WHERE name_key = $1', [key(alias)]),
      ),
    };
  });
  expect(read.done).toStrictEqual([{ units: 1 }]);
  expect(read.letter).toBe('A');
  expect(read.status).toBe('accepted');
  expect(read.again).toContain('waits for no decision');
  expect(read.waiting).toStrictEqual([]);
});

test('a refusal makes the name F, queues its rating again, and the name can get a new author', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { known, alias, one } = await joined(ask);
    // The act of the name queued its rating, and the rater ended it with the join.
    await ask(
      `UPDATE public.jobs SET status = 'done', claimed_by = 'gabriel_agent',
              claimed_at = now(), finished_at = now()
        WHERE kind = 'rate_author' AND author = $1`,
      [key(alias)],
    );
    await decide(ask, alias, false);
    const after = {
      letter: await letter(ask, alias),
      rule: await ruleOf(ask, one.act),
      job: await ask(
        `SELECT status, claimed_by FROM public.jobs WHERE kind = 'rate_author' AND author = $1`,
        [key(alias)],
      ),
      context: await as(ask, 'gabriel_agent', () =>
        ask(`SELECT public.rating_context($1)->'resolved' AS resolved`, [alias]),
      ),
      rejoin: await refusal(ask, () => join(ask, alias, known)),
    };
    await worker(ask, alias, 'D');
    return { ...after, rated: await letter(ask, alias) };
  });
  expect(read.letter).toBe('F');
  expect(read.rule).toBe('weak_sources');
  expect(read.job).toStrictEqual([{ status: 'queued', claimed_by: null }]);
  expect(read.context).toStrictEqual([{ resolved: false }]);
  expect(read.rejoin).toContain('the operator refused');
  expect(read.rated).toBe('D');
});

test('a decision is never changed or deleted', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { alias } = await joined(ask);
    await decide(ask, alias, true);
    return {
      update: await refusal(ask, () =>
        ask('UPDATE public.author_name_decision SET confirmed = false'),
      ),
      remove: await refusal(ask, () => ask('DELETE FROM public.author_name_decision')),
    };
  });
  expect(read.update).toContain('is never updated');
  expect(read.remove).toContain('is never deleted');
});

test('a name that waits for no decision is refused', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const plain = name();
    await worker(ask, plain, 'D');
    return refusal(ask, () => decide(ask, plain, true));
  });
  expect(read).toContain('waits for no decision');
});

test.each(['gabriel_agent', 'gabriel_research', 'gabriel_checker'])(
  'the role %s cannot decide a name or read the names that wait',
  async (role) => {
    const read = await rolledBack('superuser', async (ask) => {
      const { alias } = await joined(ask);
      return {
        decide: await refusal(ask, () =>
          as(ask, role, () => ask('SELECT public.decide_author_name($1, true)', [alias])),
        ),
        list: await refusal(ask, () =>
          as(ask, role, () => ask('SELECT * FROM public.author_names_waiting()')),
        ),
      };
    });
    expect(read.decide).toContain('permission denied');
    expect(read.list).toContain('permission denied');
  },
);

test('the dry-run counts equal the changes that each real decision makes', async () => {
  const states = (ask: Ask, act: string) =>
    as(ask, 'gabriel_app', () =>
      ask(
        `SELECT coalesce(public.unit_rule(unit_id), 'decided') AS state
           FROM public.proposals WHERE id = $1`,
        [act],
      ),
    );
  for (const confirm of [true, false]) {
    const read = await rolledBack('superuser', async (ask) => {
      const { alias, one } = await joined(ask);
      const before = await states(ask, one.act);
      const [row] = dryRun.parse(
        await as(ask, 'gabriel_app', () =>
          ask('SELECT * FROM public.author_names_dry_run() WHERE name_key = $1', [key(alias)]),
        ),
      );
      await decide(ask, alias, confirm);
      const after = await states(ask, one.act);
      return {
        counted: confirm ? row?.change_if_confirmed : row?.change_if_refused,
        changed: JSON.stringify(before) === JSON.stringify(after) ? 0 : 1,
      };
    });
    expect(read.counted).toBe(read.changed);
  }
});

test('a refusal queues the rating again also when the name holds a job that failed by a fault', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { alias } = await joined(ask);
    // A fault of the service ended the first job, and a later act queued a second one, which the
    // rater ended with the join.
    await ask(
      `UPDATE public.jobs SET status = 'failed', failure_reason = 'the service failed',
              claimed_by = 'gabriel_agent', claimed_at = now(), finished_at = now()
        WHERE kind = 'rate_author' AND author = $1`,
      [key(alias)],
    );
    await ask(
      `INSERT INTO public.jobs (kind, author, status, claimed_by, claimed_at, finished_at)
       VALUES ('rate_author', $1, 'done', 'gabriel_agent', now(), now())`,
      [key(alias)],
    );
    await decide(ask, alias, false);
    return ask(
      `SELECT status FROM public.jobs WHERE kind = 'rate_author' AND author = $1 ORDER BY status`,
      [key(alias)],
    );
  });
  expect(read).toStrictEqual([{ status: 'failed' }, { status: 'queued' }]);
});

test('a decision waits while the rating job of the name runs', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { alias } = await joined(ask);
    await ask(
      `UPDATE public.jobs SET status = 'running', claimed_by = 'gabriel_agent', claimed_at = now()
        WHERE kind = 'rate_author' AND author = $1`,
      [key(alias)],
    );
    return refusal(ask, () => decide(ask, alias, false));
  });
  expect(read).toContain('runs now');
});
