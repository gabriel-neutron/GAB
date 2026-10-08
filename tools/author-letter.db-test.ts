// The letter of an author. The worker stores a letter through one door, and the digit of a fact
// never reads it (tools/fact-digit.db-test.ts). Each case runs inside a transaction that rolls
// back, so the census tests count the same rows before and after.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, MODEL, rate, refusal, reference, type Options } from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const JOIN = 'SELECT public.join_author_name($1, $2)';
const REFERENCE = `SELECT public.store_reference_author($1, $2, $3, $4, $5::text[], $6, $7) AS id`;

const letterOf = async (ask: Ask, name: string): Promise<string | undefined> =>
  z
    .array(z.object({ letter: z.string() }))
    .parse(
      await as(ask, 'gabriel_app', () =>
        ask('SELECT public.letter_of($1)::text AS letter', [name]),
      ),
    )[0]?.letter;

test('an author with no letter reads as F, and a name with no author is no author', async () => {
  const read = await rolledBack('superuser', async (ask) => ({
    letter: await letterOf(ask, 'Nobody Known'),
    authors: await ask('SELECT count(*)::int AS n FROM public.author_name WHERE name_key = $1', [
      'nobody known',
    ]),
  }));
  expect(read.letter).toBe('F');
  expect(read.authors).toStrictEqual([{ n: 0 }]);
});

test('the agent role stores a letter C to F with its model, reason, references and date', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await rate(ask, '  Trade   Journal ', 'D', {
      references: ['Reuters', 'ISW'],
      controller: 'A Holding',
    });
    return {
      letter: await letterOf(ask, 'trade journal'),
      stored: z
        .array(
          z.object({
            letter: z.string(),
            model: z.string(),
            reason: z.string(),
            reference_authors: z.array(z.string()),
            controller: z.string().nullable(),
            rated_at: z.date(),
          }),
        )
        .parse(
          await ask(
            `SELECT letter::text, model, reason, reference_authors, controller, rated_at
               FROM public.author`,
          ),
        ),
    };
  });
  expect(read.letter).toBe('D');
  expect(read.stored).toHaveLength(1);
  expect(read.stored[0]).toMatchObject({
    letter: 'D',
    model: MODEL,
    reason: 'a reason',
    reference_authors: ['Reuters', 'ISW'],
    controller: 'A Holding',
  });
});

test('the agent role stores each letter from C to F', async () => {
  const letters = await rolledBack('superuser', async (ask) => {
    const read: (string | undefined)[] = [];
    for (const letter of ['C', 'D', 'E', 'F']) {
      await rate(ask, `Author ${letter}`, letter);
      read.push(await letterOf(ask, `Author ${letter}`));
    }
    return read;
  });
  expect(letters).toStrictEqual(['C', 'D', 'E', 'F']);
});

const REFUSED: readonly (readonly [string, string, Options, RegExp])[] = [
  ['the letter A', 'A', {}, /C to F/u],
  ['the letter B', 'B', {}, /C to F/u],
  ['a letter that is not a letter', 'G', {}, /C to F/u],
  ['no reference author', 'C', { references: [] }, /reference author/u],
  ['a blank reference author', 'C', { references: [' '] }, /reference author/u],
  ['a party with no controller', 'C', { party: true }, /controller/u],
  ['a party with a blank controller', 'C', { party: true, controller: ' ' }, /controller/u],
];

test.each(REFUSED)('the agent role cannot store %s', async (_name, letter, options, said) => {
  const said_ = await rolledBack('superuser', (ask) =>
    refusal(ask, () => rate(ask, 'Some Author', letter, options)),
  );
  expect(said_).toMatch(said);
});

test('a party with a controller is stored, and it reads as C at most', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await reference(ask, 'Army Press Office', 'A', { party: true, controller: 'The State' });
    await reference(ask, 'Agency', 'A');
    return [await letterOf(ask, 'Army Press Office'), await letterOf(ask, 'Agency')];
  });
  expect(read).toStrictEqual(['C', 'A']);
});

test('a name that has an author cannot be rated twice', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'Same Name', 'D');
    return refusal(ask, () => rate(ask, ' same  name', 'C'));
  });
  expect(said).toMatch(/already/u);
});

test('the agent role joins a new name to a known author', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'Regional Daily', 'D');
    await as(ask, 'gabriel_agent', () =>
      ask(JOIN, ['The Regional Daily Online', 'regional daily']),
    );
    return letterOf(ask, 'the regional daily online');
  });
  expect(read).toBe('D');
});

test('a join into an unknown author, or of a known name, is refused', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'Known One', 'D');
    await rate(ask, 'Known Two', 'D');
    return [
      await refusal(ask, () =>
        as(ask, 'gabriel_agent', () => ask(JOIN, ['New Name', 'No Such Author'])),
      ),
      await refusal(ask, () =>
        as(ask, 'gabriel_agent', () => ask(JOIN, ['Known One', 'Known Two'])),
      ),
    ];
  });
  expect(said[0]).toMatch(/no known author/u);
  expect(said[1]).toMatch(/already/u);
});

const doubts = async (ask: Ask): Promise<readonly string[]> =>
  z
    .array(z.object({ name_key: z.string() }))
    .parse(await ask('SELECT name_key FROM public.author_name WHERE doubt ORDER BY name_key'))
    .map((row) => row.name_key);

test('a join into an author A or B makes a doubt, and a join into C to F makes none', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await reference(ask, 'Official Register', 'A');
    await reference(ask, 'Good Agency', 'B');
    await rate(ask, 'Local Blog', 'E');
    for (const [name, known] of [
      ['The Register', 'official register'],
      ['Agency Wire', 'good agency'],
      ['The Blog', 'local blog'],
    ] as const)
      await as(ask, 'gabriel_agent', () => ask(JOIN, [name, known]));
    return doubts(ask);
  });
  expect(read).toStrictEqual(['agency wire', 'the register']);
});

test('only the reference set holds A and B', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const direct = await refusal(ask, () =>
      ask(
        `INSERT INTO public.author (name_key, letter, model, reason, reference_authors)
         VALUES ('rogue', 'A', 'm', 'r', ARRAY['x'])`,
      ),
    );
    return direct;
  });
  expect(read).toMatch(/author_reference_set/u);
});

test('the reference door is closed to the agent and the read role', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    const found: (string | null)[] = [];
    for (const role of ['gabriel_agent', 'gabriel_read'])
      found.push(
        await refusal(ask, () =>
          as(ask, role, () => ask(REFERENCE, ['X', 'A', MODEL, 'r', [], null, false])),
        ),
      );
    return found;
  });
  for (const one of said) expect(one).toMatch(/permission denied/u);
});

test('the agent role holds a door for a letter and none for a decision', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    const found: (string | null)[] = [];
    for (const statement of [
      'SELECT public.promote_unit(gen_random_uuid(), $$agent$$)',
      'SELECT * FROM public.author',
      'INSERT INTO public.author (name_key, letter, model, reason) VALUES ($$x$$, $$C$$, $$m$$, $$r$$)',
      'SELECT public.letter_of($$x$$)',
      'SELECT public.fact_digit($$x$$)',
    ])
      found.push(await refusal(ask, () => as(ask, 'gabriel_agent', () => ask(statement))));
    return found;
  });
  for (const one of said) expect(one).toMatch(/permission denied/u);
});

test('the public read shows no letter and no digit', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const columns = z.array(z.object({ column_name: z.string() })).parse(
      await ask(
        `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'api'
              AND (column_name ~* '(letter|digit|reliab|credib|controller)')`,
      ),
    );
    const views = z.array(z.object({ name: z.string() })).parse(
      await ask(
        `SELECT DISTINCT c.relname AS name
             FROM pg_catalog.pg_depend d
             JOIN pg_catalog.pg_rewrite r ON r.oid = d.objid
             JOIN pg_catalog.pg_class c ON c.oid = r.ev_class
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'api'
              AND d.refobjid IN ('public.author'::regclass, 'public.author_name'::regclass,
                                 'public.act_check'::regclass)`,
      ),
    );
    const denied: (string | null)[] = [];
    for (const statement of [
      'SELECT * FROM public.author',
      'SELECT public.letter_of($$x$$)',
      'SELECT public.fact_digit($$x$$)',
    ])
      denied.push(await refusal(ask, () => as(ask, 'gabriel_read', () => ask(statement))));
    return { columns, views, denied };
  });
  expect(read.columns).toStrictEqual([]);
  expect(read.views).toStrictEqual([]);
  for (const one of read.denied) expect(one).toMatch(/permission denied/u);
});

test('a letter is written once, and never changed or deleted', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    await rate(ask, 'Once Only', 'D');
    const found: (string | null)[] = [];
    for (const statement of [
      'UPDATE public.author SET letter = $$C$$',
      'DELETE FROM public.author',
      'UPDATE public.author_name SET doubt = true',
      'DELETE FROM public.author_name',
    ]) {
      found.push(await refusal(ask, () => ask(statement)));
    }
    return found;
  });
  for (const one of said) expect(one).toMatch(/never/u);
});
