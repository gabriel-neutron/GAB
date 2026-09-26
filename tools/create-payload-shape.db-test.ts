// Departure: an agent calls propose_change directly and no schema of the writer runs. So the
// database refuses a create payload that no promotion can apply, or the act waits in the queue.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

// External constraint: the proposals ledger is append-only and a trigger refuses a delete.
const proposed = (op: string, payload: unknown): Promise<unknown> =>
  probe('app', async (ask: Ask) => {
    await ask('BEGIN');
    try {
      return made.parse(
        await ask(`SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[]) AS id`, [
          op,
          JSON.stringify(payload),
        ]),
      );
    } finally {
      await ask('ROLLBACK');
    }
  });

const ENTITY_REFUSED = { code: '23514', constraint: 'proposals_create_entity_shape' };
const RELATION_REFUSED = { code: '23514', constraint: 'proposals_create_relation_shape' };

const ATTRS = { note: { v: 'a note', src: ['manual'] } };
const POINT = { type: 'Point', coordinates: [4.4, 51.2] };
const SRC = '00000000-0000-4000-8000-000000000001';
const DST = '00000000-0000-4000-8000-000000000002';

// Departure: no rule of the insert reads the ends, and no act here is promoted.
const RELATION = { type: 'owns', src_kind: 'entity', src_id: SRC, dst_kind: 'entity', dst_id: DST };

test.each([
  ['no label', { type: 'vessel', attrs: {} }],
  ['a blank label', { type: 'vessel', label: ' \t', attrs: {} }],
  ['a label that is not a string', { type: 'vessel', label: 7, attrs: {} }],
  ['a label that is a JSON null', { type: 'vessel', label: null, attrs: {} }],
  ['no type', { label: 'A vessel', attrs: {} }],
  ['a blank type', { type: ' ', label: 'A vessel', attrs: {} }],
  ['a geometry key', { type: 'vessel', label: 'A vessel', geometry: POINT, attrs: {} }],
  ['a date', { type: 'vessel', label: 'A vessel', valid_from: '2024-01-01' }],
])('a create_entity with %s is refused', async (_case, payload) => {
  await expect(proposed('create_entity', payload)).rejects.toMatchObject(ENTITY_REFUSED);
});

test.each([
  ['src_id x', { ...RELATION, src_id: 'x' }],
  ['no dst_id', { ...RELATION, dst_id: undefined }],
  ['valid_from 2024-13-01', { ...RELATION, valid_from: '2024-13-01' }],
  ['valid_to 1 March 2024', { ...RELATION, valid_to: '1 March 2024' }],
  ['a valid_from that is a JSON null', { ...RELATION, valid_from: null }],
  ['no type', { ...RELATION, type: undefined }],
  ['a blank type', { ...RELATION, type: ' ' }],
  ['a src_kind outside the two kinds', { ...RELATION, src_kind: 'document' }],
  ['an unknown key', { ...RELATION, label: 'A relation' }],
])('a create_relation with %s is refused', async (_case, payload) => {
  await expect(proposed('create_relation', payload)).rejects.toMatchObject(RELATION_REFUSED);
});

// Departure: these copy the payloads of proposalAct and the fixture loader, and move with them.
test.each([
  ['the writer entity', { type: 'vessel', label: 'A vessel', geom: POINT, attrs: ATTRS }],
  ['the writer entity with no position', { type: 'vessel', label: 'A vessel', attrs: {} }],
  ['the fixture candidate entity', { type: 'vessel', label: 'A vessel', attrs: {} }],
])('%s is still accepted', async (_case, payload) => {
  await expect(proposed('create_entity', payload)).resolves.toHaveLength(1);
});

test.each([
  [
    'the writer relation with an interval',
    { ...RELATION, valid_from: '2020-01-01', valid_to: '2024-02-29', attrs: ATTRS },
  ],
  ['the writer relation with no interval', { ...RELATION, attrs: {} }],
  ['the fixture candidate relation', RELATION],
  ['a relation that names a relation', { ...RELATION, dst_kind: 'relation' }],
])('%s is still accepted', async (_case, payload) => {
  await expect(proposed('create_relation', payload)).resolves.toHaveLength(1);
});
