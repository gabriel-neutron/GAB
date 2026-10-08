// External constraint: an act is not decided by the transaction that proposed it, so each
// statement commits alone. The proposals stay, because the ledger is append-only.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));
const decided = z.array(z.object({ status: z.string() }));
const held = z.array(z.object({ row: z.record(z.string(), z.unknown()) }));

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

const promoted = (ask: Ask, id: string): Promise<string> =>
  idOf(ask, 'SELECT public.promote_unit($1::uuid, $2::text) AS id', [id, 'a test']);

const CREATE = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A merge test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const MERGE = `SELECT public.propose_change('merge_entities', '{}'::jsonb,
  ARRAY['manual']::text[], 'entity', $1::uuid, ARRAY[$2::uuid]) AS id`;

const DELETE = `SELECT public.propose_change('delete_entity', '{}'::jsonb,
  ARRAY['manual']::text[], 'entity', $1::uuid) AS id`;

const rowsOf = async (ask: Ask, ids: readonly string[]): Promise<readonly unknown[]> =>
  held
    .parse(
      await ask(
        `SELECT to_jsonb(e) AS row FROM public.entities e
          WHERE e.id = ANY($1::uuid[]) ORDER BY e.id`,
        [ids],
      ),
    )
    .map(({ row }) => row);

const statusOf = async (ask: Ask, act: string): Promise<string | undefined> => {
  const [row] = decided.parse(
    await ask('SELECT status FROM public.proposals WHERE id = $1::uuid', [act]),
  );
  return row?.status;
};

interface Outcome {
  readonly refusal: unknown;
  readonly status: string | undefined;
  readonly before: readonly unknown[];
  readonly after: readonly unknown[];
}

// Departure: the test rejects the merge act after it reads the status, so no open act stays.
const mergeOutcome = (): Promise<Outcome> =>
  probe('app', async (ask) => {
    let kept: string | undefined;
    let absorbed: string | undefined;
    try {
      kept = await promoted(ask, await idOf(ask, CREATE, []));
      absorbed = await promoted(ask, await idOf(ask, CREATE, []));
      const before = await rowsOf(ask, [kept, absorbed]);
      const act = await idOf(ask, MERGE, [kept, absorbed]);
      const refusal = await promoted(ask, act).then(
        () => null,
        (cause: unknown) => cause,
      );
      const status = await statusOf(ask, act);
      if (status === 'pending')
        await ask("SELECT public.reject_unit($1::uuid, 'out_of_scope', NULL, $2::text)", [
          act,
          'a test',
        ]);
      return { refusal, status, before, after: await rowsOf(ask, [kept, absorbed]) };
    } finally {
      // Departure: only a row this run actually created gets a delete, so a creation that
      // failed midway leaves nothing behind for the next run to clean up.
      if (kept !== undefined) await promoted(ask, await idOf(ask, DELETE, [kept]));
      if (absorbed !== undefined) await promoted(ask, await idOf(ask, DELETE, [absorbed]));
    }
  });

test('a merge act is refused at promotion, stays pending, and changes no entity', async () => {
  const outcome = await mergeOutcome();
  expect(outcome.refusal).toMatchObject({
    code: 'P0001',
    constraint: 'op_has_path',
  });
  expect(outcome.status).toBe('pending');
  expect(outcome.before).toHaveLength(2);
  expect(outcome.after).toStrictEqual(outcome.before);
});
