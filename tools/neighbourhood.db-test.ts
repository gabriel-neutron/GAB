// The proposals ledger is append-only and a trigger refuses a delete, so each gesture builds its
// graph inside a transaction that rolls back. The walk runs as the read role, which calls it.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));
const walked = z.array(z.object({ entity_id: z.uuid(), hop: z.number() }));

const PROPOSE = `SELECT public.propose_change($1, '{}'::jsonb, ARRAY['manual']::text[]) AS id`;

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, sources, promoted_from)
  VALUES ('vessel', $1, ARRAY['manual']::doc_id[], $2) RETURNING id`;

const INSERT_RELATION = `INSERT INTO public.relations
  (type, src_kind, src_id, dst_kind, dst_id, sources, promoted_from)
  VALUES ('berthed_at', $1, $2, $3, $4, ARRAY['manual']::doc_id[], $5) RETURNING id`;

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

const proposal = async (ask: Ask, op: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const id = await idOf(ask, PROPOSE, [op]);
  await ask('RESET SESSION AUTHORIZATION');
  return id;
};

const anEntity = async (ask: Ask, label: string): Promise<string> =>
  idOf(ask, INSERT_ENTITY, [label, await proposal(ask, 'create_entity')]);

type Kind = 'entity' | 'relation';

const aRelation = async (
  ask: Ask,
  src: readonly [Kind, string],
  dst: readonly [Kind, string],
): Promise<string> =>
  idOf(ask, INSERT_RELATION, [...src, ...dst, await proposal(ask, 'create_relation')]);

// A-B, C-B written from C, C-D, A-E, B-E, and one relation from A to the relation A-B.
// E is at hop 1 from A and at hop 2 through B. D is at hop 3.
const neighbourhoodOf = (depth: number): Promise<Readonly<Record<string, number>>> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      const names = new Map<string, string>();
      const entity = async (label: string): Promise<string> => {
        const id = await anEntity(ask, label);
        names.set(id, label);
        return id;
      };
      const [a, b, c, d, e] = [
        await entity('A'),
        await entity('B'),
        await entity('C'),
        await entity('D'),
        await entity('E'),
      ];
      const ab = await aRelation(ask, ['entity', a], ['entity', b]);
      await aRelation(ask, ['entity', c], ['entity', b]);
      await aRelation(ask, ['entity', c], ['entity', d]);
      await aRelation(ask, ['entity', a], ['entity', e]);
      await aRelation(ask, ['entity', b], ['entity', e]);
      await aRelation(ask, ['entity', a], ['relation', ab]);
      names.set(ab, 'the relation A-B');

      await ask('SET LOCAL ROLE gabriel_read');
      const rows = walked.parse(
        await ask('SELECT entity_id, hop FROM api.neighbourhood($1::uuid, $2::int)', [a, depth]),
      );
      return Object.fromEntries(
        rows.map((row) => [names.get(row.entity_id) ?? row.entity_id, row.hop]),
      );
    } finally {
      await ask('ROLLBACK');
    }
  });

test('a walk of depth 1 gives the root at hop 0 and each direct neighbour at hop 1', async () => {
  expect(await neighbourhoodOf(1)).toStrictEqual({ A: 0, B: 1, E: 1 });
});

test('a walk of depth 2 follows a relation in both directions and keeps the shortest hop', async () => {
  expect(await neighbourhoodOf(2)).toStrictEqual({ A: 0, B: 1, E: 1, C: 2 });
});
