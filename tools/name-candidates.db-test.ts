// The merge candidates across a Latin and a Cyrillic spelling: what the command stores, what the
// review page lists, the confirmation, the refusal that never comes back, and the counts of the
// release. Each case runs in one transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const entity = async (ask: Ask, type: string, label: string): Promise<string> => {
  const [row] = z.array(z.object({ target_id: z.uuid() })).parse(
    await ask(
      `SELECT target_id FROM public.sign_change('a test', 'create_entity', $1::jsonb,
           ARRAY['manual'], NULL, NULL, '{}'::uuid[])`,
      [JSON.stringify({ type, label, sources: ['manual'] })],
    ),
  );
  if (row === undefined) throw new Error('the entity was not written');
  return row.target_id;
};

/** A pair as the command stores it: the smaller identifier first, with the name of each. */
const pairOf = (a: string, aName: string, b: string, bName: string, key: string) =>
  a < b
    ? { first_id: a, second_id: b, key, first_name: aName, second_name: bName }
    : { first_id: b, second_id: a, key, first_name: bName, second_name: aName };

const stored = z.array(z.object({ added: z.number(), kept: z.number(), dropped: z.number() }));

const store = async (ask: Ask, pairs: readonly object[]) => {
  const [row] = stored.parse(
    await ask('SELECT * FROM public.store_name_candidates($1::jsonb)', [JSON.stringify(pairs)]),
  );
  return row;
};

const listed = z.array(
  z.object({
    key: z.string(),
    type: z.string(),
    first_id: z.uuid(),
    first_label: z.string(),
    first_name: z.string(),
    second_id: z.uuid(),
    second_label: z.string(),
    second_name: z.string(),
  }),
);

const listOf = async (ask: Ask, ids: readonly string[]) =>
  listed
    .parse(await ask('SELECT * FROM public.name_candidates()'))
    .filter((row) => ids.includes(row.first_id) || ids.includes(row.second_id));

const counts = async (ask: Ask) =>
  z
    .array(z.object({ proposed: z.number(), confirmed: z.number(), refused: z.number() }))
    .parse(await ask('SELECT * FROM public.name_candidate_counts()'))[0];

test('a stored pair is listed with both labels, the key and both identifiers, and a second run keeps it', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const latin = await entity(ask, 'company', 'Sovcomflot test');
    const cyrillic = await entity(ask, 'company', 'Совкомфлот тест');
    const pair = pairOf(latin, 'Sovcomflot test', cyrillic, 'Совкомфлот тест', 'sovkomflot test');
    const before = await counts(ask);
    return {
      pair,
      first: await store(ask, [pair]),
      again: await store(ask, [pair]),
      list: await listOf(ask, [latin, cyrillic]),
      before,
      after: await counts(ask),
    };
  });
  expect(seen.first).toStrictEqual({ added: 1, kept: 0, dropped: 0 });
  expect(seen.again).toMatchObject({ added: 0, kept: 1 });
  const label = (id: string) =>
    id === seen.pair.first_id ? seen.pair.first_name : seen.pair.second_name;
  expect(seen.list).toStrictEqual([
    {
      key: 'sovkomflot test',
      type: 'company',
      first_id: seen.pair.first_id,
      first_label: label(seen.pair.first_id),
      first_name: seen.pair.first_name,
      second_id: seen.pair.second_id,
      second_label: label(seen.pair.second_id),
      second_name: seen.pair.second_name,
    },
  ]);
  expect(seen.after?.proposed).toBe((seen.before?.proposed ?? 0) + 1);
});

test('the store refuses a pair of two types, a pair out of order and an unknown entity', async () => {
  const refusals = await rolledBack('app', async (ask) => {
    const port = await entity(ask, 'port', 'Primorsk test');
    const facility = await entity(ask, 'facility', 'Приморск тест');
    const company = await entity(ask, 'company', 'Приморск тест');
    const [low, high] = [port, company].sort();
    const tries = [
      [pairOf(port, 'Primorsk test', facility, 'Приморск тест', 'primorsk test')],
      [{ ...pairOf(port, 'a', company, 'b', 'k'), first_id: high, second_id: low }],
      [pairOf(port, 'a', '00000000-0000-4000-8000-000000000000', 'b', 'k')],
      { not: 'a list' },
    ];
    const said: string[] = [];
    for (const one of tries) {
      await ask('SAVEPOINT one');
      try {
        await store(ask, one as object[]);
        said.push('stored');
      } catch (cause) {
        said.push(z.object({ constraint: z.string() }).parse(cause).constraint);
      }
      await ask('ROLLBACK TO SAVEPOINT one');
    }
    return said;
  });
  expect(refusals).toStrictEqual([
    'name_candidate_shape',
    'name_candidate_shape',
    'name_candidate_shape',
    'name_candidate_shape',
  ]);
});

test('a refused pair is not listed again, also after the command runs again', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const latin = await entity(ask, 'company', 'Rosneft test');
    const cyrillic = await entity(ask, 'company', 'Роснефть тест');
    const pair = pairOf(latin, 'Rosneft test', cyrillic, 'Роснефть тест', 'rosneft test');
    await store(ask, [pair]);
    const before = await counts(ask);
    const [refused] = z
      .array(z.object({ n: z.number() }))
      .parse(
        await ask(`SELECT public.refuse_name_candidate('a test', $1::uuid, $2::uuid) AS n`, [
          cyrillic,
          latin,
        ]),
      );
    return {
      refused: refused?.n,
      list: await listOf(ask, [latin, cyrillic]),
      again: await store(ask, [pair]),
      listAgain: await listOf(ask, [latin, cyrillic]),
      before,
      after: await counts(ask),
    };
  });
  expect(seen.refused).toBe(1);
  expect(seen.list).toStrictEqual([]);
  expect(seen.again).toMatchObject({ added: 0, kept: 1 });
  expect(seen.listAgain).toStrictEqual([]);
  expect(seen.after).toStrictEqual({
    proposed: (seen.before?.proposed ?? 0) - 1,
    confirmed: seen.before?.confirmed,
    refused: (seen.before?.refused ?? 0) + 1,
  });
});

test('a refusal still holds after a merge absorbs one entity of the pair', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const latin = await entity(ask, 'company', 'Transneft test');
    const cyrillic = await entity(ask, 'company', 'Транснефть тест');
    const other = await entity(ask, 'company', 'Transneft test two');
    await store(ask, [pairOf(latin, 'Transneft test', cyrillic, 'Транснефть тест', 'k')]);
    await ask(`SELECT public.refuse_name_candidate('a test', $1::uuid, $2::uuid)`, [
      latin,
      cyrillic,
    ]);
    await ask(`SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid, true)`, [
      other,
      latin,
    ]);
    return {
      again: await store(ask, [
        pairOf(other, 'Transneft test', cyrillic, 'Транснефть тест', 'transneft test'),
      ]),
      list: await listOf(ask, [other, cyrillic]),
    };
  });
  expect(seen.again).toMatchObject({ added: 0, kept: 1 });
  expect(seen.list).toStrictEqual([]);
});

test('a confirmation merges the pair into the chosen survivor and keeps the other label as a former name', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const latin = await entity(ask, 'company', 'Kinef test');
    const cyrillic = await entity(ask, 'company', 'Кинеф тест');
    await store(ask, [pairOf(latin, 'Kinef test', cyrillic, 'Кинеф тест', 'kinef test')]);
    const before = await counts(ask);
    const [merged] = z
      .array(z.object({ proposal_id: z.uuid(), target_id: z.uuid() }))
      .parse(
        await ask(`SELECT * FROM public.confirm_name_candidate('a test', $1::uuid, $2::uuid)`, [
          latin,
          cyrillic,
        ]),
      );
    const [survivor] = z
      .array(z.object({ names: z.unknown() }))
      .parse(
        await ask(`SELECT attrs->'former_names'->'v' AS names FROM public.entities WHERE id = $1`, [
          latin,
        ]),
      );
    const [alias] = z
      .array(z.object({ survivor_id: z.uuid() }))
      .parse(
        await ask('SELECT survivor_id FROM api.entity_alias WHERE absorbed_id = $1', [cyrillic]),
      );
    let second = 'confirmed again';
    await ask('SAVEPOINT again');
    try {
      await ask(`SELECT * FROM public.confirm_name_candidate('a test', $1::uuid, $2::uuid)`, [
        latin,
        cyrillic,
      ]);
    } catch (cause) {
      second = z.object({ constraint: z.string() }).parse(cause).constraint;
    }
    await ask('ROLLBACK TO SAVEPOINT again');
    return {
      merged,
      latin,
      names: survivor?.names,
      alias: alias?.survivor_id,
      list: await listOf(ask, [latin, cyrillic]),
      second,
      before,
      after: await counts(ask),
    };
  });
  expect(seen.merged?.target_id).toBe(seen.latin);
  expect(seen.names).toStrictEqual(['Кинеф тест']);
  expect(seen.alias).toBe(seen.latin);
  expect(seen.list).toStrictEqual([]);
  expect(seen.second).toBe('name_candidate_waits');
  expect(seen.after).toStrictEqual({
    proposed: (seen.before?.proposed ?? 0) - 1,
    confirmed: (seen.before?.confirmed ?? 0) + 1,
    refused: seen.before?.refused,
  });
});

test('a pair that waits and that the command does not find again leaves the list', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const latin = await entity(ask, 'port', 'Ust-Luga test');
    const cyrillic = await entity(ask, 'port', 'Усть-Луга тест');
    await store(ask, [pairOf(latin, 'Ust-Luga test', cyrillic, 'Усть-Луга тест', 'ust luga')]);
    const listedOnce = await listOf(ask, [latin, cyrillic]);
    const again = await store(ask, []);
    return { listedOnce, again, list: await listOf(ask, [latin, cyrillic]) };
  });
  expect(seen.listedOnce).toHaveLength(1);
  expect(seen.again?.dropped).toBeGreaterThanOrEqual(1);
  expect(seen.list).toStrictEqual([]);
});

test('a refusal of two entities with no pair that waits is refused', async () => {
  const said = await rolledBack('app', async (ask) => {
    const a = await entity(ask, 'company', 'Lukoil test');
    const b = await entity(ask, 'company', 'Лукойл тест');
    try {
      await ask(`SELECT public.refuse_name_candidate('a test', $1::uuid, $2::uuid)`, [a, b]);
      return 'refused the pair';
    } catch (cause) {
      return z.object({ constraint: z.string() }).parse(cause).constraint;
    }
  });
  expect(said).toBe('name_candidate_waits');
});

test.each([
  'SELECT * FROM public.name_candidates()',
  "SELECT * FROM public.store_name_candidates('[]'::jsonb)",
  'SELECT * FROM public.name_candidate_counts()',
  `SELECT public.refuse_name_candidate('x', gen_random_uuid(), gen_random_uuid())`,
  `SELECT * FROM public.confirm_name_candidate('x', gen_random_uuid(), gen_random_uuid())`,
  'SELECT * FROM public.name_candidate',
])('only the operator role runs %s', async (statement) => {
  const refusals: Record<string, string> = {};
  const roles = ['gabriel_agent', 'gabriel_research', 'gabriel_checker', 'gabriel_read'];
  for (const role of roles) {
    refusals[role] = await rolledBack('superuser', async (ask) => {
      await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
      try {
        await ask(statement);
        return 'ran';
      } catch (cause) {
        return z.object({ message: z.string() }).parse(cause).message;
      }
    });
  }
  expect(Object.keys(refusals)).toStrictEqual(roles);
  for (const said of Object.values(refusals)) expect(said).toContain('permission denied');
});
