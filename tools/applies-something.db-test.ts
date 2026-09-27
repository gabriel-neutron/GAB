// A promotion must not commit while it applies nothing. An update that names no attribute was
// written, was promoted, and left the target byte for byte the same while its `updated_at` moved.
// `attrs_valid('{}')` is TRUE, so `proposals_payload_attrs` never reached it, and migration 0007
// refuses it at the door of the queue.
//
// The rule binds the two update ops ONLY. A creation may still carry an empty attrs: six
// relations of the committed fixture hold one, and their whole claim sits in the type and the
// two ends. The last test is what keeps that legal.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from './probe.ts';

const DOCUMENT = 'manual';
const TYPE = 'vessel';
const CITED = `ARRAY['${DOCUMENT}']::text[]`;

const REFUSED = { code: '23514', constraint: 'proposals_update_names_attrs' };

const made = z.array(z.object({ id: z.uuid() }));

const proposed = (op: string, payload: string, target: string): Promise<unknown> =>
  rolledBack('app', async (ask) =>
    made.parse(
      await ask(
        `SELECT public.propose_change('${op}', '${payload}'::jsonb, ${CITED}, ${target}) AS id`,
      ),
    ),
  );

// The target need not exist: the CHECK sits on the row, and `target_id` carries no foreign key
// because the target is polymorphic (M4).
const ENTITY_TARGET = `'entity', '00000000-0000-4000-8000-000000000001'::uuid`;
const RELATION_TARGET = `'relation', '00000000-0000-4000-8000-000000000002'::uuid`;

test('an update of an entity that carries no payload is refused', async () => {
  await expect(proposed('update_attrs', '{}', ENTITY_TARGET)).rejects.toMatchObject(REFUSED);
});

test('an update of an entity that names no attribute is refused', async () => {
  await expect(proposed('update_attrs', '{"attrs":{}}', ENTITY_TARGET)).rejects.toMatchObject(
    REFUSED,
  );
});

test('an update of a relation that names no attribute is refused', async () => {
  await expect(proposed('update_relation', '{"attrs":{}}', RELATION_TARGET)).rejects.toMatchObject(
    REFUSED,
  );
});

const CREATION = `{"type":"${TYPE}","label":"A creation with no attribute","attrs":{}}`;

test('a creation that names no attribute is still accepted', async () => {
  const written = await rolledBack('app', async (ask) =>
    made.parse(
      await ask(`SELECT public.propose_change('create_entity', '${CREATION}'::jsonb, ${CITED})
        AS id`),
    ),
  );
  expect(written).toHaveLength(1);
});
