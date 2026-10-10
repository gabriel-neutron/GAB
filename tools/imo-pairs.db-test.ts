// The pairs of vessels of the record with one IMO number, which the operator merges from the
// review page. Each case runs in one transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const PAIRS = 'SELECT * FROM public.imo_duplicate_pairs()';

const pair = z.object({
  imo: z.string(),
  first_id: z.uuid(),
  first_label: z.string(),
  second_id: z.uuid(),
  second_label: z.string(),
});

// A number that no vessel of the fixture holds: each IMO number there starts with a 9.
const freshImo = (): string => `1${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;

const vessel = async (ask: Ask, label: string, imo: unknown): Promise<string> => {
  const [row] = z.array(z.object({ target_id: z.uuid() })).parse(
    await ask(
      `SELECT target_id FROM public.sign_change('a test', 'create_entity', $1::jsonb,
           ARRAY['manual'], NULL, NULL, '{}'::uuid[])`,
      [
        JSON.stringify({
          type: 'vessel',
          label,
          attrs: { imo: { v: imo, src: ['manual'] } },
          sources: ['manual'],
        }),
      ],
    ),
  );
  if (row === undefined) throw new Error('the vessel was not written');
  return row.target_id;
};

const pairsOf = async (ask: Ask, imo: string) =>
  z
    .array(pair)
    .parse(await ask(PAIRS))
    .filter((one) => one.imo === imo);

test('the pairs of the record give each pair of vessels with one IMO number, in each form', async () => {
  const [imo, other] = [freshImo(), freshImo()];
  const seen = await rolledBack('app', async (ask) => {
    const a = await vessel(ask, 'MV Pair One', Number(imo));
    const b = await vessel(ask, 'MV Pair Two', `IMO ${imo}`);
    const c = await vessel(ask, 'MV Pair Three', imo);
    await vessel(ask, 'MV Alone', other);
    return {
      ids: [a, b, c].sort(),
      pairs: await pairsOf(ask, imo),
      alone: await pairsOf(ask, other),
    };
  });
  const label = new Map<string, string>(
    seen.pairs.flatMap((one) => [
      [one.first_id, one.first_label],
      [one.second_id, one.second_label],
    ]),
  );
  expect(seen.pairs.map((one) => [one.first_id, one.second_id])).toStrictEqual([
    [seen.ids[0], seen.ids[1]],
    [seen.ids[0], seen.ids[2]],
    [seen.ids[1], seen.ids[2]],
  ]);
  expect([...label.values()].sort()).toStrictEqual(['MV Pair One', 'MV Pair Three', 'MV Pair Two']);
  expect(seen.alone).toStrictEqual([]);
});

test('a merge that keeps the absorbed name takes the pair off the list', async () => {
  const imo = freshImo();
  const seen = await rolledBack('app', async (ask) => {
    const keep = await vessel(ask, 'MV Survivor', imo);
    const gone = await vessel(ask, 'MV Former', imo);
    const before = await pairsOf(ask, imo);
    await ask(`SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid, true)`, [
      keep,
      gone,
    ]);
    const [names] = z
      .array(z.object({ names: z.unknown() }))
      .parse(
        await ask(`SELECT attrs->'former_names'->'v' AS names FROM public.entities WHERE id = $1`, [
          keep,
        ]),
      );
    return { before, after: await pairsOf(ask, imo), names: names?.names };
  });
  expect(seen.before).toHaveLength(1);
  expect(seen.after).toStrictEqual([]);
  expect(seen.names).toStrictEqual(['MV Former']);
});

test.each(['gabriel_agent', 'gabriel_research', 'gabriel_checker', 'gabriel_read'])(
  'the role %s cannot read the pairs',
  async (role) => {
    const refusal = await rolledBack('superuser', async (ask) => {
      await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
      try {
        await ask(PAIRS);
        return 'read';
      } catch (cause) {
        return z.object({ message: z.string() }).parse(cause).message;
      }
    });
    expect(refusal).toContain('permission denied');
  },
);
