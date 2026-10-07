// A relation type is a row of a closed list, and the row decides whether the relation takes an
// interval. A word that fits no live row never refuses the promotion: the relation lands on the
// fallback row, and the word stays beside it.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

const landed = z.array(
  z.object({
    type: z.string(),
    proposed_type: z.string().nullable(),
    valid_from: z.string().nullable(),
  }),
);

const worded = z.array(
  z.object({
    key: z.string(),
    label: z.string(),
    inverse_label: z.string(),
    takes_interval: z.boolean(),
  }),
);

const idOf = async (ask: Ask, text: string, values: readonly unknown[] = []): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

const PROPOSE_ENTITY = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A relation type test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const PROPOSE_RELATION = `SELECT public.propose_change('create_relation',
  jsonb_strip_nulls(jsonb_build_object('type', $1::text, 'src_kind', 'entity',
    'src_id', $2::uuid, 'dst_kind', 'entity', 'dst_id', $3::uuid, 'valid_from', $4::text)),
  ARRAY['manual']::text[], NULL, NULL, ARRAY[$2::uuid, $3::uuid]) AS id`;

const DELETE = `SELECT public.propose_change($1::text, '{}'::jsonb, ARRAY['manual']::text[],
  $2::text, $3::uuid) AS id`;

const LANDED = `SELECT type, proposed_type, valid_from::text AS valid_from
  FROM public.relations WHERE id = $1::uuid`;

// Each statement runs in its own transaction: an act is not decided by the transaction that
// proposed it. The proposals stay, because the ledger is append-only, and the rows go.
const promoted = (ask: Ask, id: string): Promise<string> =>
  idOf(ask, 'SELECT public.promote_unit($1::uuid, $2::text) AS id', [id, 'a test']);

const deleted = async (ask: Ask, kind: 'entity' | 'relation', target: string): Promise<void> => {
  await promoted(ask, await idOf(ask, DELETE, [`delete_${kind}`, kind, target]));
};

/** One relation promoted between two new entities, read back, and removed again. */
const promotedRelation = (
  type: string,
  validFrom: string | null = null,
): Promise<z.infer<typeof landed>> =>
  probe('app', async (ask) => {
    const src = await promoted(ask, await idOf(ask, PROPOSE_ENTITY));
    const dst = await promoted(ask, await idOf(ask, PROPOSE_ENTITY));
    try {
      const act = await idOf(ask, PROPOSE_RELATION, [type, src, dst, validFrom]);
      const relation = await promoted(ask, act);
      try {
        return landed.parse(await ask(LANDED, [relation]));
      } finally {
        await deleted(ask, 'relation', relation);
      }
    } finally {
      await deleted(ask, 'entity', src);
      await deleted(ask, 'entity', dst);
    }
  });

test('a designated_by relation with a valid_from promotes', async () => {
  await expect(promotedRelation('designated_by', '2022-06-03')).resolves.toStrictEqual([
    { type: 'designated_by', proposed_type: null, valid_from: '2022-06-03' },
  ]);
});

test('an owned_by relation lands on the fallback row, and the word stays beside it', async () => {
  await expect(promotedRelation('owned_by')).resolves.toStrictEqual([
    { type: 'unknown', proposed_type: 'owned_by', valid_from: null },
  ]);
});

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, sources, promoted_from)
  VALUES ('vessel', 'A relation type test', ARRAY['manual']::doc_id[], $1) RETURNING id`;

const INSERT_DATED = `INSERT INTO public.relations
  (type, src_id, dst_id, valid_from, sources, promoted_from)
  VALUES ('owns', $1, $1, '2024-01-01', ARRAY['manual']::doc_id[], $2) RETURNING id`;

const actOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const id = await idOf(ask, text, values);
  await ask('RESET SESSION AUTHORIZATION');
  return id;
};

test('a type that a dated relation holds cannot stop taking an interval', async () => {
  const flipped = rolledBack('superuser', async (ask) => {
    const end = await idOf(ask, INSERT_ENTITY, [await actOf(ask, PROPOSE_ENTITY, [])]);
    const act = await actOf(ask, PROPOSE_RELATION, ['owns', end, end, null]);
    await idOf(ask, INSERT_DATED, [end, act]);
    return ask(`UPDATE public.relation_type SET takes_interval = false WHERE key = 'owns'`);
  });
  await expect(flipped).rejects.toMatchObject({ code: '23514', constraint: 'rel_dates_scope' });
});

test('the read role reads both directions of a relation type, and the word a relation kept', async () => {
  const read = await probe('read', async (ask) => ({
    types: worded.parse(
      await ask(`SELECT key, label, inverse_label, takes_interval FROM api.relation_type
                  WHERE key IN ('owns', 'unknown') ORDER BY key`),
    ),
    kept: await ask(`SELECT proposed_type FROM api.relation LIMIT 0`),
  }));
  expect(read.types).toStrictEqual([
    { key: 'owns', label: 'owns', inverse_label: 'is owned by', takes_interval: true },
    { key: 'unknown', label: 'is linked to', inverse_label: 'is linked to', takes_interval: false },
  ]);
  expect(read.kept).toStrictEqual([]);
});
