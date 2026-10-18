// The operator moves a name from an author that the worker rated to an approved reference author
// or to another rated author, or gives the name back to the rater (ADR 0012). Each case runs inside
// a transaction that rolls back, and it reads only the rows that it wrote.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import {
  as,
  cited,
  join,
  label,
  OWN_RECORD,
  OWN_SITE,
  rate,
  reference,
  refusal,
  storeUnapproved,
} from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const name = () => `Author ${randomUUID()}`;
const key = (one: string) => one.toLowerCase();

const TEXT = 'The register lists the vessel under its new owner.';

const letter = async (ask: Ask, one: string): Promise<string> =>
  z
    .array(z.object({ letter: z.string() }))
    .parse(await ask('SELECT public.letter_of($1) AS letter', [one]))
    .at(0)?.letter ?? '';

const statusOf = async (ask: Ask, act: string): Promise<string> =>
  z
    .array(z.object({ status: z.string() }))
    .parse(await ask('SELECT status FROM public.proposals WHERE id = $1', [act]))
    .at(0)?.status ?? '';

const move = (ask: Ask, one: string, author: string) =>
  as(ask, 'gabriel_app', () =>
    ask('SELECT public.move_author_name($1, $2) AS units', [one, author]),
  );

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

/** A reference author A, and a name that the worker rated as a new author F, with one fact of
 * that name on the site of the reference author. */
const wronglyRated = async (ask: Ask) => {
  const [target, wrong] = [name(), `${name()}, Office of One Body`];
  await reference(ask, target, 'A', OWN_SITE);
  const one = await cited(ask, { author: wrong, label: label(), text: TEXT, uri: OWN_RECORD });
  await check(ask, one.act);
  await rate(ask, wrong, 'F', { references: [target] });
  return { target, wrong, one };
};

test('a moved name gets the letter of the reference author, and the rules decide its unit again', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { target, wrong, one } = await wronglyRated(ask);
    const before = { letter: await letter(ask, wrong), status: await statusOf(ask, one.act) };
    const units = await move(ask, wrong, target);
    return {
      before,
      units,
      letter: await letter(ask, wrong),
      status: await statusOf(ask, one.act),
      rows: await ask(
        `SELECT a.reference_set, n.doubt, d.confirmed, d.decided_by = 'gabriel_app' AS by_operator
           FROM public.author_name n JOIN public.author a ON a.id = n.author_id
           JOIN public.author_name_decision d
             ON (d.name_key, d.author_id) = (n.name_key, n.author_id)
          WHERE n.name_key = $1 ORDER BY a.reference_set`,
        [key(wrong)],
      ),
      waiting: await as(ask, 'gabriel_app', () =>
        ask('SELECT * FROM public.author_names_waiting() WHERE name_key = $1', [key(wrong)]),
      ),
    };
  });
  expect(read.before).toStrictEqual({ letter: 'F', status: 'pending' });
  expect(read.units).toStrictEqual([{ units: 1 }]);
  expect(read.letter).toBe('A');
  expect(read.status).toBe('accepted');
  // The old row stays, retired by a refusal. The new row is confirmed. Both record the operator.
  expect(read.rows).toStrictEqual([
    { reference_set: false, doubt: false, confirmed: false, by_operator: true },
    { reference_set: true, doubt: true, confirmed: true, by_operator: true },
  ]);
  expect(read.waiting).toStrictEqual([]);
});

test('the rater no longer sees the author whose name moved, and the name is resolved', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { target, wrong } = await wronglyRated(ask);
    await move(ask, wrong, target);
    const context = z
      .array(z.object({ context: z.object({ authors: z.array(z.object({ name: z.string() })) }) }))
      .parse(
        await as(ask, 'gabriel_agent', () =>
          ask('SELECT public.rating_context($1) AS context', [name()]),
        ),
      )
      .at(0)?.context;
    return {
      known: context?.authors.map((one) => one.name),
      key: key(wrong),
      resolved: await as(ask, 'gabriel_agent', () =>
        ask(`SELECT public.rating_context($1)->'resolved' AS resolved`, [wrong]),
      ),
      again: await refusal(ask, () => move(ask, wrong, target)),
    };
  });
  // The name reads as a name of the reference author, and its old author is gone.
  expect(read.known).not.toContain(read.key);
  expect(read.resolved).toStrictEqual([{ resolved: true }]);
  expect(read.again).toContain('is a name of the reference author');
});

test.each([
  ['an author of the set with no approval', 'no author that a name can move into'],
  ['an unknown author', 'no author that a name can move into'],
  ['its own author', 'already'],
])('a move into %s is refused', async (into, said) => {
  const read = await rolledBack('superuser', async (ask) => {
    const { wrong } = await wronglyRated(ask);
    if (into === 'its own author')
      return {
        said: await refusal(ask, () => move(ask, wrong, wrong)),
        letter: await letter(ask, wrong),
      };
    const other = name();
    if (into === 'an author of the set with no approval') await storeUnapproved(ask, other, 'A');
    return {
      said: await refusal(ask, () => move(ask, wrong, other)),
      letter: await letter(ask, wrong),
    };
  });
  expect(read.said).toContain(said);
  expect(read.letter).toBe('F');
});

test('a name of a reference author, and a name with no author, do not move', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [first, second, alias] = [name(), name(), name()];
    await reference(ask, first, 'A', OWN_SITE);
    await reference(ask, second, 'A', OWN_SITE);
    await join(ask, alias, first);
    return {
      own: await refusal(ask, () => move(ask, first, second)),
      joined: await refusal(ask, () => move(ask, alias, second)),
      none: await refusal(ask, () => move(ask, name(), second)),
      blank: await refusal(ask, () => move(ask, ' ', second)),
    };
  });
  expect(read.own).toContain('is a name of the reference author');
  expect(read.joined).toContain('is a name of the reference author');
  expect(read.none).toContain('has no author');
  expect(read.blank).toContain('a move names the name');
});

test('a move waits while the rating job of the name runs', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { target, wrong } = await wronglyRated(ask);
    await ask(
      `UPDATE public.jobs SET status = 'running', claimed_by = 'gabriel_agent', claimed_at = now()
        WHERE kind = 'rate_author' AND author = $1`,
      [key(wrong)],
    );
    return refusal(ask, () => move(ask, wrong, target));
  });
  expect(read).toContain('runs now');
});

test('a machine role cannot move a name', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { target, wrong } = await wronglyRated(ask);
    const said: (string | null)[] = [];
    for (const role of ['gabriel_agent', 'gabriel_research'])
      said.push(
        await refusal(ask, () =>
          as(ask, role, () => ask('SELECT public.move_author_name($1, $2)', [wrong, target])),
        ),
      );
    return said;
  });
  expect(read.every((said) => said?.includes('permission denied') === true)).toBe(true);
});

test('a comma joins an author A or B as a doubt, and joins no other author', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [high, low] = [name(), name()];
    await reference(ask, high, 'A', OWN_SITE);
    await rate(ask, low, 'C', { references: [high] });
    const doubt = `${name()}, Office of One Body`;
    return {
      high: await refusal(ask, () => join(ask, doubt, high)),
      waits: await as(ask, 'gabriel_app', () =>
        ask('SELECT name_key FROM public.author_names_waiting() WHERE name_key = $1', [key(doubt)]),
      ),
      low: await refusal(ask, () => join(ask, `${name()}, Other Body`, low)),
      semicolon: await refusal(ask, () => join(ask, `${name()}; Other Body`, high)),
    };
  });
  expect(read.high).toBeNull();
  expect(read.waits).toHaveLength(1);
  expect(read.low).toContain('holds two authors');
  expect(read.semicolon).toContain('holds two authors');
});

test('an alias of a rated author moves into a target named by its alias, and the other names stay', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const [target, targetAlias, rated, ratedAlias] = [name(), name(), name(), name()];
    await reference(ask, target, 'A', OWN_SITE);
    await join(ask, targetAlias, target);
    await as(ask, 'gabriel_app', () =>
      ask('SELECT public.decide_author_name($1, true)', [targetAlias]),
    );
    await rate(ask, rated, 'C', { references: [target] });
    await join(ask, ratedAlias, rated);
    await move(ask, ratedAlias, targetAlias);
    return {
      alias: await letter(ask, ratedAlias),
      rated: await letter(ask, rated),
    };
  });
  expect(read).toStrictEqual({ alias: 'A', rated: 'C' });
});

const rerate = (ask: Ask, one: string) =>
  as(ask, 'gabriel_app', () => ask('SELECT public.rerate_author_name($1) AS units', [one]));

/** A name that the rater joined to a wrong author D, with one fact of that name, and a second
 * author C that the worker rated. */
const wronglyJoined = async (ask: Ask) => {
  const [wrongAuthor, right, alias] = [name(), name(), name()];
  await rate(ask, wrongAuthor, 'D');
  await rate(ask, right, 'C');
  await join(ask, alias, wrongAuthor);
  const one = await cited(ask, { author: alias, label: label(), text: TEXT });
  return { wrongAuthor, right, alias, one };
};

const rowsOf = (ask: Ask, one: string) =>
  ask(
    `SELECT a.letter, n.doubt, d.confirmed, d.decided_by = 'gabriel_app' AS by_operator
       FROM public.author_name n JOIN public.author a ON a.id = n.author_id
       LEFT JOIN public.author_name_decision d
         ON (d.name_key, d.author_id) = (n.name_key, n.author_id)
      WHERE n.name_key = $1 ORDER BY a.letter DESC`,
    [key(one)],
  );

test('a name moves between two authors that the worker rated, and its rows stay', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { right, alias } = await wronglyJoined(ask);
    const before = await letter(ask, alias);
    const units = await move(ask, alias, right);
    return { before, units, after: await letter(ask, alias), rows: await rowsOf(ask, alias) };
  });
  expect(read.before).toBe('D');
  expect(read.units).toStrictEqual([{ units: 1 }]);
  expect(read.after).toBe('C');
  // The old row stays, retired by a refusal. The new row needs no decision of A or B, and its
  // confirmation records the operator.
  expect(read.rows).toStrictEqual([
    { letter: 'D', doubt: false, confirmed: false, by_operator: true },
    { letter: 'C', doubt: false, confirmed: true, by_operator: true },
  ]);
});

test('a name goes back to the rater, reads as F, and cannot join its wrong author again', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { wrongAuthor, right, alias } = await wronglyJoined(ask);
    const units = await rerate(ask, alias);
    const after = await letter(ask, alias);
    const resolved = await as(ask, 'gabriel_agent', () =>
      ask(`SELECT public.rating_context($1)->'resolved' AS resolved`, [alias]),
    );
    const jobs = await ask(
      "SELECT status FROM public.jobs WHERE kind = 'rate_author' AND author = $1",
      [key(alias)],
    );
    const again = await refusal(ask, () => join(ask, alias, wrongAuthor));
    await join(ask, alias, right);
    return {
      units,
      after,
      resolved,
      jobs,
      again,
      joined: await letter(ask, alias),
      rows: await rowsOf(ask, alias),
    };
  });
  expect(read.units).toStrictEqual([{ units: 1 }]);
  expect(read.after).toBe('F');
  expect(read.resolved).toStrictEqual([{ resolved: false }]);
  expect(read.jobs).toStrictEqual([{ status: 'queued' }]);
  expect(read.again).toContain('the operator refused the name');
  expect(read.joined).toBe('C');
  expect(read.rows).toStrictEqual([
    { letter: 'D', doubt: false, confirmed: false, by_operator: true },
    { letter: 'C', doubt: false, confirmed: null, by_operator: null },
  ]);
});

test('the rater gets no own name of an author, no name of a reference author, and no unknown name', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { wrongAuthor } = await wronglyJoined(ask);
    const { target, wrong } = await wronglyRated(ask);
    await move(ask, wrong, target);
    return {
      own: await refusal(ask, () => rerate(ask, wrongAuthor)),
      moved: await refusal(ask, () => rerate(ask, wrong)),
      reference: await refusal(ask, () => rerate(ask, target)),
      none: await refusal(ask, () => rerate(ask, name())),
      blank: await refusal(ask, () => rerate(ask, ' ')),
    };
  });
  expect(read.own).toContain('is the own name of an author');
  expect(read.moved).toContain('is a name of the reference author');
  expect(read.reference).toContain('is a name of the reference author');
  expect(read.none).toContain('has no author');
  expect(read.blank).toContain('names the name');
});

test('a return to the rater waits while the rating job of the name runs, and no machine role can do it', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { alias } = await wronglyJoined(ask);
    const said: (string | null)[] = [];
    for (const role of ['gabriel_agent', 'gabriel_research'])
      said.push(
        await refusal(ask, () =>
          as(ask, role, () => ask('SELECT public.rerate_author_name($1)', [alias])),
        ),
      );
    await ask("INSERT INTO public.jobs (kind, author) VALUES ('rate_author', $1)", [key(alias)]);
    await ask(
      `UPDATE public.jobs SET status = 'running', claimed_by = 'gabriel_agent', claimed_at = now()
        WHERE kind = 'rate_author' AND author = $1`,
      [key(alias)],
    );
    return { roles: said, running: await refusal(ask, () => rerate(ask, alias)) };
  });
  expect(read.roles.every((said) => said?.includes('permission denied') === true)).toBe(true);
  expect(read.running).toContain('runs now');
});

test('a move is final: a moved name takes no second move and no return to the rater', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { right, alias } = await wronglyJoined(ask);
    const other = name();
    await rate(ask, other, 'E');
    await move(ask, alias, right);
    return {
      moved: await refusal(ask, () => move(ask, alias, other)),
      rerated: await refusal(ask, () => rerate(ask, alias)),
      letter: await letter(ask, alias),
    };
  });
  expect(read.moved).toContain('a decision is written once');
  expect(read.rerated).toContain('a decision is written once');
  expect(read.letter).toBe('C');
});
