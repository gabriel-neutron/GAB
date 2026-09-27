// Departure: the writer tests promote an update on an entity only, so this file alone runs the
// arm of the promotion that reads and writes the attributes of a relation.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));
const attributes = z.array(z.object({ attrs: z.record(z.string(), z.unknown()) }));
const decided = z.array(z.object({ prior_value: z.record(z.string(), z.unknown()) }));

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

const promoted = (ask: Ask, id: string): Promise<string> =>
  idOf(ask, 'SELECT public.promote_proposal($1::uuid, $2::text) AS id', [id, 'a test']);

const ENTITY = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A relation update test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const RELATION = `SELECT public.propose_change('create_relation',
  jsonb_build_object('type', 'berthed_at', 'src_id', $1::uuid, 'dst_id', $2::uuid,
    'attrs', '{"berth":{"v":"north","src":["manual"]},"draft_m":{"v":9,"src":["manual"]}}'::jsonb),
  ARRAY['manual']::text[], NULL, NULL, ARRAY[$1::uuid, $2::uuid]) AS id`;

const UPDATE = `SELECT public.propose_change($1::text,
  '{"attrs":{"berth":{"v":"south","src":["manual"]},"cargo":{"v":"coal","src":["manual"]}}}'::jsonb,
  ARRAY['manual']::text[], 'relation', $2::uuid) AS id`;

const DELETE = `SELECT public.propose_change($1::text, '{}'::jsonb, ARRAY['manual']::text[],
  $2::text, $3::uuid) AS id`;

type Kind = 'entity' | 'relation';

const deleted = async (ask: Ask, kind: Kind, target: string): Promise<string> =>
  promoted(ask, await idOf(ask, DELETE, [`delete_${kind}`, kind, target]));

interface Outcome {
  readonly attrs: Record<string, unknown>;
  readonly prior: Record<string, unknown>;
}

// External constraint: the proposals ledger is append-only, and an act is not decided by the
// transaction that proposed it, so each statement commits and the graph is deleted after.
const updated = (op: 'update_attrs' | 'update_relation'): Promise<Outcome> =>
  probe('app', async (ask) => {
    const src = await promoted(ask, await idOf(ask, ENTITY, []));
    const dst = await promoted(ask, await idOf(ask, ENTITY, []));
    const relation = await promoted(ask, await idOf(ask, RELATION, [src, dst]));
    try {
      const act = await idOf(ask, UPDATE, [op, relation]);
      await promoted(ask, act);
      const [row] = attributes.parse(
        await ask('SELECT attrs FROM public.relations WHERE id = $1::uuid', [relation]),
      );
      const [decision] = decided.parse(
        await ask('SELECT prior_value FROM public.proposals WHERE id = $1::uuid', [act]),
      );
      return { attrs: row?.attrs ?? {}, prior: decision?.prior_value ?? {} };
    } finally {
      await deleted(ask, 'relation', relation);
      await deleted(ask, 'entity', src);
      await deleted(ask, 'entity', dst);
    }
  });

test.each(['update_attrs', 'update_relation'] as const)(
  'a promoted %s on a relation merges its attributes and keeps the prior value of each named key',
  async (op) => {
    await expect(updated(op)).resolves.toStrictEqual({
      attrs: {
        berth: { v: 'south', src: ['manual'] },
        draft_m: { v: 9, src: ['manual'] },
        cargo: { v: 'coal', src: ['manual'] },
      },
      prior: { berth: { v: 'north', src: ['manual'] } },
    });
  },
);
