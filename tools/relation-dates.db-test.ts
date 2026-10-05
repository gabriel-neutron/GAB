// Departure: the writer checks an interval before it proposes, so no writer test reaches the
// trigger and the CHECK on the interval of a relation. These tests insert the row directly.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

// Departure: the act is never promoted, so the ends it names need not exist.
const END = '00000000-0000-4000-8000-00000000e0d0';

const PROPOSE_ENTITY = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"An interval test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const PROPOSE_RELATION = `SELECT public.propose_change('create_relation',
  '{"type":"berthed_at","src_id":"${END}","dst_id":"${END}"}'::jsonb,
  ARRAY['manual']::text[]) AS id`;

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, sources, promoted_from)
  VALUES ('vessel', 'An interval test', ARRAY['manual']::doc_id[], $1) RETURNING id`;

const INSERT_RELATION = `INSERT INTO public.relations
  (type, src_id, dst_id, valid_from, valid_to, sources, promoted_from)
  VALUES ($1, $2, $2, $3::date, $4::date, ARRAY['manual']::doc_id[], $5) RETURNING id`;

// External constraint: the trigger that stamps the author refuses each role but the two writers.
const actOf = async (ask: Ask, text: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const id = await idOf(ask, text, []);
  await ask('RESET SESSION AUTHORIZATION');
  return id;
};

// External constraint: the proposals ledger is append-only, so the rollback is the only way back.
const inserted = (type: string, from: string | null, to: string | null): Promise<unknown> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      const end = await idOf(ask, INSERT_ENTITY, [await actOf(ask, PROPOSE_ENTITY)]);
      const act = await actOf(ask, PROPOSE_RELATION);
      return await ask(INSERT_RELATION, [type, end, from, to, act]);
    } finally {
      await ask('ROLLBACK');
    }
  });

test('a berthed_at relation with a valid_from is refused', async () => {
  await expect(inserted('berthed_at', '2024-01-01', null)).rejects.toMatchObject({
    code: '23514',
    constraint: 'rel_dates_scope',
  });
});

test('an owns relation whose valid_from is after its valid_to is refused', async () => {
  await expect(inserted('owns', '2024-06-01', '2024-01-01')).rejects.toMatchObject({
    code: '23514',
    constraint: 'rel_dates_order',
  });
});

test('an owns relation with an ordered interval is written', async () => {
  await expect(inserted('owns', '2024-01-01', '2024-06-01')).resolves.toHaveLength(1);
});
