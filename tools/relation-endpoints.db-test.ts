// An end of a relation carries no foreign key, because it may name an entity or a relation. The
// trigger on the insert and the refusals of the delete promotion are its only guard, and the
// writer checks the ends before it proposes, so its tests never reach them.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));
const present = z.array(z.object({ n: z.number() }));

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

const ABSENT = '00000000-0000-4000-8000-00000000e0d0';

const PROPOSE_ENTITY = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"An endpoint test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const PROPOSE_RELATION = `SELECT public.propose_change('create_relation',
  '{"type":"berthed_at"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, sources, promoted_from)
  VALUES ('vessel', 'An endpoint test', ARRAY['manual']::doc_id[], $1) RETURNING id`;

const INSERT_RELATION = `INSERT INTO public.relations
  (type, src_kind, src_id, dst_kind, dst_id, sources, promoted_from)
  VALUES ('berthed_at', $1, $2, $3, $4, ARRAY['manual']::doc_id[], $5) RETURNING id`;

// The trigger that stamps the author refuses every session role except the two writers.
const actOf = async (ask: Ask, text: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const id = await idOf(ask, text, []);
  await ask('RESET SESSION AUTHORIZATION');
  return id;
};

type Kind = 'entity' | 'relation';

const inserted = (live: 'src' | 'dst', absentKind: Kind): Promise<unknown> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      const end = await idOf(ask, INSERT_ENTITY, [await actOf(ask, PROPOSE_ENTITY)]);
      const from = await actOf(ask, PROPOSE_RELATION);
      return await ask(
        INSERT_RELATION,
        live === 'src'
          ? ['entity', end, absentKind, ABSENT, from]
          : [absentKind, ABSENT, 'entity', end, from],
      );
    } finally {
      await ask('ROLLBACK');
    }
  });

test.each([
  ['src', 'entity', 'dst'],
  ['src', 'relation', 'dst'],
  ['dst', 'entity', 'src'],
  ['dst', 'relation', 'src'],
] as const)('a relation whose %s names no %s is refused', async (end, kind, live) => {
  await expect(inserted(live, kind)).rejects.toMatchObject({
    code: '23503',
    message: `${end} ${ABSENT} (${kind}) does not exist`,
  });
});

// Each statement runs in its own transaction: an act is not decided by the transaction that
// proposed it. The proposals stay, because the ledger is append-only.
const promoted = (ask: Ask, id: string): Promise<string> =>
  idOf(ask, 'SELECT public.promote_proposal($1::uuid, $2::text) AS id', [id, 'a test']);

const CREATE_RELATION = `SELECT public.propose_change('create_relation',
  jsonb_build_object('type', 'berthed_at', 'src_kind', 'entity', 'src_id', $1::uuid,
    'dst_kind', $2::text, 'dst_id', $3::uuid),
  ARRAY['manual']::text[], NULL, NULL, ARRAY[$1::uuid, $3::uuid]) AS id`;

const DELETE = `SELECT public.propose_change($1::text, '{}'::jsonb, ARRAY['manual']::text[],
  $2::text, $3::uuid) AS id`;

const deleted = async (ask: Ask, kind: Kind, target: string): Promise<string> =>
  promoted(ask, await idOf(ask, DELETE, [`delete_${kind}`, kind, target]));

interface Graph {
  readonly entity: string;
  readonly relation: string;
}

const onGraph = <T>(work: (ask: Ask, graph: Graph) => Promise<T>): Promise<T> =>
  probe('app', async (ask) => {
    const entity = await promoted(ask, await idOf(ask, PROPOSE_ENTITY, []));
    const other = await promoted(ask, await idOf(ask, PROPOSE_ENTITY, []));
    const relation = await promoted(
      ask,
      await idOf(ask, CREATE_RELATION, [entity, 'entity', other]),
    );
    const upper = await promoted(
      ask,
      await idOf(ask, CREATE_RELATION, [entity, 'relation', relation]),
    );
    try {
      return await work(ask, { entity, relation });
    } finally {
      await deleted(ask, 'relation', upper);
      await deleted(ask, 'relation', relation);
      await deleted(ask, 'entity', entity);
      await deleted(ask, 'entity', other);
    }
  });

interface Outcome {
  readonly refusal: unknown;
  readonly kept: boolean;
}

// A refused act stays pending, so the test rejects it and leaves no open act behind.
const outcomeOf = async (ask: Ask, kind: Kind, target: string): Promise<Outcome> => {
  const act = await idOf(ask, DELETE, [`delete_${kind}`, kind, target]);
  const refusal = await promoted(ask, act).then(
    () => null,
    (cause: unknown) => cause,
  );
  if (refusal !== null)
    await ask('SELECT public.reject_proposal($1::uuid, $2::text)', [act, 'a test']);
  const [row] = present.parse(
    await ask(
      `SELECT count(*)::int AS n FROM public.${kind === 'entity' ? 'entities' : 'relations'}
        WHERE id = $1::uuid`,
      [target],
    ),
  );
  return { refusal, kept: row?.n === 1 };
};

test('the deletion of an entity that is an end of a relation is refused, and the entity stays', async () => {
  const outcome = await onGraph(async (ask, graph) => ({
    graph,
    outcome: await outcomeOf(ask, 'entity', graph.entity),
  }));
  expect(outcome.outcome).toMatchObject({
    refusal: {
      message: `entity ${outcome.graph.entity} is an endpoint of a relation, and it is not deleted`,
    },
    kept: true,
  });
});

test('the deletion of a relation that is an end of a relation is refused, and it stays', async () => {
  const outcome = await onGraph(async (ask, graph) => ({
    graph,
    outcome: await outcomeOf(ask, 'relation', graph.relation),
  }));
  expect(outcome.outcome).toMatchObject({
    refusal: {
      message: `relation ${outcome.graph.relation} is an endpoint of a relation, and it is not deleted`,
    },
    kept: true,
  });
});
