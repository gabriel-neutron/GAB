// The promotion picks its table from the target kind and not from the name of the act. An act
// named for a relation that targets an entity is refused when it is written, or its promotion
// deletes or changes the entity while the operator reads that it touches a relation.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const CITED = `ARRAY['manual']::text[]`;

const REFUSED = { code: '23514', constraint: 'proposals_op_target_kind' };

const ATTRIBUTE = '{"attrs":{"note":{"v":"a note","src":["manual"]}}}';

const made = z.array(z.object({ id: z.uuid() }));

// Every gesture rolls back: the proposals ledger is append-only and a trigger refuses a delete.
const proposed = (op: string, payload: string, target: string): Promise<unknown> =>
  probe('app', async (ask: Ask) => {
    await ask('BEGIN');
    try {
      return made.parse(
        await ask(
          `SELECT public.propose_change('${op}', '${payload}'::jsonb, ${CITED}, ${target}) AS id`,
        ),
      );
    } finally {
      await ask('ROLLBACK');
    }
  });

// The target need not exist: the CHECK sits on the row, and `target_id` carries no foreign key
// because the target is polymorphic.
const ENTITY_TARGET = `'entity', '00000000-0000-4000-8000-000000000001'::uuid`;
const RELATION_TARGET = `'relation', '00000000-0000-4000-8000-000000000002'::uuid`;

test('a deletion of a relation that targets an entity is refused', async () => {
  await expect(proposed('delete_relation', '{}', ENTITY_TARGET)).rejects.toMatchObject(REFUSED);
});

test('a deletion of an entity that targets a relation is refused', async () => {
  await expect(proposed('delete_entity', '{}', RELATION_TARGET)).rejects.toMatchObject(REFUSED);
});

test('an update of a relation that targets an entity is refused', async () => {
  await expect(proposed('update_relation', ATTRIBUTE, ENTITY_TARGET)).rejects.toMatchObject(
    REFUSED,
  );
});

test.each([
  ['delete_entity', 'an entity', '{}', ENTITY_TARGET],
  ['delete_relation', 'a relation', '{}', RELATION_TARGET],
  ['update_relation', 'a relation', ATTRIBUTE, RELATION_TARGET],
  ['update_attrs', 'an entity', ATTRIBUTE, ENTITY_TARGET],
  ['update_attrs', 'a relation', ATTRIBUTE, RELATION_TARGET],
])('the writer pair %s on %s is still accepted', async (op, _kind, payload, target) => {
  await expect(proposed(op, payload, target)).resolves.toHaveLength(1);
});
