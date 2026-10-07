// A proposed type that is not a live word lands as `unknown` and keeps the word in
// `proposed_type`. A seeded word must land as itself, so this test promotes one and reads the row.
// Each statement runs in its own transaction, and the entity is deleted at the end, because other
// live tests count the live entities.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));
const typed = z.array(z.object({ type: z.string(), proposed_type: z.string().nullable() }));

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the door returned no row');
  return row.id;
};

const promoted = (ask: Ask, id: string): Promise<string> =>
  idOf(ask, 'SELECT public.promote_unit($1::uuid, $2::text) AS id', [id, 'a test']);

const CREATE = `SELECT public.propose_change('create_entity',
  jsonb_build_object('type', 'legal_act', 'label', 'A seeded type test'),
  ARRAY['manual']::text[]) AS id`;

const DELETE = `SELECT public.propose_change('delete_entity', '{}'::jsonb, ARRAY['manual']::text[],
  'entity', $1::uuid) AS id`;

test('a legal_act proposal promotes and lands as legal_act, not as unknown', async () => {
  const rows = await probe('app', async (ask) => {
    const target = await promoted(ask, await idOf(ask, CREATE, []));
    try {
      return typed.parse(
        await ask('SELECT type, proposed_type FROM public.entities WHERE id = $1::uuid', [target]),
      );
    } finally {
      await promoted(ask, await idOf(ask, DELETE, [target]));
    }
  });
  expect(rows).toStrictEqual([{ type: 'legal_act', proposed_type: null }]);
});
