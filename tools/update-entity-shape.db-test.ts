// Departure: an agent calls propose_change directly and no schema of the writer runs. So the
// database refuses an update_entity that no promotion can apply, or the act waits in the queue.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

// Departure: the CHECK sits on the row, and target_id carries no foreign key, so no target exists.
const ENTITY = '00000000-0000-4000-8000-000000000001';

const proposed = (payload: unknown, targetKind = 'entity'): Promise<unknown> =>
  rolledBack('app', async (ask) =>
    made.parse(
      await ask(
        `SELECT public.propose_change('update_entity', $1::jsonb, ARRAY['manual']::text[],
          $2::text, $3::uuid) AS id`,
        [JSON.stringify(payload), targetKind, ENTITY],
      ),
    ),
  );

const REFUSED = { code: '23514', constraint: 'proposals_update_entity_shape' };

test.each([
  ['a third key', { label: 'A vessel', note: 'a note' }],
  ['neither label nor type', {}],
  ['a blank label', { label: ' ' }],
  ['a label of one tab', { label: '\t' }],
  ['a label that is a JSON null', { label: null }],
  ['a label that is not a string', { label: 7 }],
  ['a blank type', { type: ' ' }],
  ['a type of one tab', { type: '\t' }],
  ['a type of a line feed and a space', { type: '\n ' }],
  ['a type that is a JSON null', { type: null }],
  ['a type that is not a string', { type: 7 }],
])('an update_entity with %s is refused', async (_case, payload) => {
  await expect(proposed(payload)).rejects.toMatchObject(REFUSED);
});

test('an update_entity whose target is a relation is refused', async () => {
  await expect(proposed({ label: 'A vessel' }, 'relation')).rejects.toMatchObject(REFUSED);
});

test.each([
  ['a label', { label: 'A vessel' }],
  ['a type', { type: 'vessel' }],
  ['a label and a type', { label: 'A vessel', type: 'vessel' }],
])('an update_entity with %s is still accepted', async (_case, payload) => {
  await expect(proposed(payload)).resolves.toHaveLength(1);
});
