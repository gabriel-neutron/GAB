// What the fixture loader put in the live database. The corpus is the ground every surface and
// every other database test stands on, and nothing measured it.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../probe.ts';

const counts = z.array(
  z.object({
    entities: z.coerce.number(),
    relations: z.coerce.number(),
    documents: z.coerce.number(),
    pending: z.coerce.number(),
  }),
);

const COUNTS = `
  SELECT (SELECT count(*) FROM public.entities)  AS entities,
         (SELECT count(*) FROM public.relations) AS relations,
         (SELECT count(*) FROM public.documents) AS documents,
         (SELECT count(*) FROM public.proposals WHERE status = 'pending') AS pending`;

test('the loaded corpus holds the counts the fixture states', async () => {
  const held = await probe('superuser', async (ask) => counts.parse(await ask(COUNTS)));
  expect(held).toStrictEqual([{ entities: 27, relations: 17, documents: 5, pending: 3 }]);
});

const authors = z.array(z.object({ status: z.string(), author_role: z.string() }));

const AUTHORS = `
  SELECT DISTINCT status, author_role FROM public.proposals
   WHERE status IN ('pending','accepted') ORDER BY status, author_role`;

test('the pending acts are the machine and the promoted acts are the operator', async () => {
  const held = await probe('superuser', async (ask) => authors.parse(await ask(AUTHORS)));
  expect(held).toStrictEqual([
    { status: 'accepted', author_role: 'gabriel_app' },
    { status: 'pending', author_role: 'gabriel_agent' },
  ]);
});

const shortfalls = z.array(
  z.object({
    entities_with_no_promotion: z.coerce.number(),
    relations_with_no_promotion: z.coerce.number(),
    entities_typed_unknown: z.coerce.number(),
  }),
);

const SHORTFALLS = `
  SELECT (SELECT count(*) FROM public.entities  WHERE promoted_from IS NULL)
           AS entities_with_no_promotion,
         (SELECT count(*) FROM public.relations WHERE promoted_from IS NULL)
           AS relations_with_no_promotion,
         (SELECT count(*) FROM public.entities  WHERE type = 'unknown')
           AS entities_typed_unknown`;

test('every element names the act that promoted it, and no entity is typed unknown', async () => {
  const held = await probe('superuser', async (ask) => shortfalls.parse(await ask(SHORTFALLS)));
  expect(held).toStrictEqual([
    {
      entities_with_no_promotion: 0,
      relations_with_no_promotion: 0,
      entities_typed_unknown: 0,
    },
  ]);
});

const ends = z.array(z.object({ type: z.string(), src_kind: z.string(), dst_kind: z.string() }));

const RELATION_ENDS = `
  SELECT r.type, r.src_kind, r.dst_kind
    FROM public.relations r
   WHERE (r.src_kind = 'relation' AND EXISTS
            (SELECT 1 FROM public.relations x WHERE x.id = r.src_id))
      OR (r.dst_kind = 'relation' AND EXISTS
            (SELECT 1 FROM public.relations x WHERE x.id = r.dst_id))
   ORDER BY r.type, r.src_kind, r.dst_kind`;

test('two relations point at a relation, and both endpoints resolve', async () => {
  const held = await probe('superuser', async (ask) => ends.parse(await ask(RELATION_ENDS)));
  expect(held).toStrictEqual([
    { type: 'contradicts', src_kind: 'entity', dst_kind: 'relation' },
    { type: 'contradicts', src_kind: 'entity', dst_kind: 'relation' },
  ]);
});
