// External constraint: a btree refuses an index row larger than about 2,704 bytes. A long type
// that commits as a proposal fails at its promotion, so each door holds the bound alone.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

const PROPOSE = `SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[]) AS id`;

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, sources, promoted_from)
  VALUES ('vessel', 'A relation type test', ARRAY['manual']::doc_id[], $1) RETURNING id`;

const INSERT_RELATION = `INSERT INTO public.relations (type, src_id, dst_id, sources, promoted_from)
  VALUES ($1, $2, $2, ARRAY['manual']::doc_id[], $3) RETURNING id`;

const ENTITY_PAYLOAD = JSON.stringify({ type: 'vessel', label: 'A relation type test' });

const SRC = '00000000-0000-4000-8000-000000000001';
const DST = '00000000-0000-4000-8000-000000000002';

const LONGEST = 'x'.repeat(200);
const TOO_LONG = 'x'.repeat(201);

const relationPayload = (type: string): string =>
  JSON.stringify({ type, src_kind: 'entity', src_id: SRC, dst_kind: 'entity', dst_id: DST });

// External constraint: the trigger that stamps the author refuses each role but the two writers.
const proposedIn = async (ask: Ask, op: string, payload: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(await ask(PROPOSE, [op, payload]));
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('the proposal was not written');
  return row.id;
};

// External constraint: the proposals ledger is append-only, so the rollback is the only way back.
const inTransaction = <T>(work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

const proposed = (type: string): Promise<string> =>
  inTransaction((ask) => proposedIn(ask, 'create_relation', relationPayload(type)));

const inserted = (type: string): Promise<unknown> =>
  inTransaction(async (ask) => {
    const carrier = await proposedIn(ask, 'create_entity', ENTITY_PAYLOAD);
    const [end] = made.parse(await ask(INSERT_ENTITY, [carrier]));
    if (end === undefined) throw new Error('the entity was not written');
    const from = await proposedIn(ask, 'create_relation', relationPayload('owns'));
    return made.parse(await ask(INSERT_RELATION, [type, end.id, from]));
  });

const landed = z.array(z.object({ type: z.string(), proposed_type: z.string().nullable() }));

const PROMOTE = 'SELECT public.promote_proposal($1::uuid, $2::text) AS id';

const DELETE = `SELECT public.propose_change($1::text, '{}'::jsonb, ARRAY['manual']::text[],
  $2::text, $3::uuid) AS id`;

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

// Each statement runs in its own transaction: an act is not decided by the transaction that
// proposed it. The proposals stay, because the ledger is append-only, and the rows go.
const promotedIn = async (ask: Ask, op: string, payload: string): Promise<string> =>
  idOf(ask, PROMOTE, [await idOf(ask, PROPOSE, [op, payload]), 'a test']);

const removed = async (ask: Ask, kind: 'entity' | 'relation', target: string): Promise<void> => {
  await idOf(ask, PROMOTE, [await idOf(ask, DELETE, [`delete_${kind}`, kind, target]), 'a test']);
};

const endsPayload = (type: string, end: string): string =>
  JSON.stringify({ type, src_kind: 'entity', src_id: end, dst_kind: 'entity', dst_id: end });

const promotedOf = (type: string): Promise<z.infer<typeof landed>> =>
  probe('app', async (ask) => {
    const end = await promotedIn(ask, 'create_entity', ENTITY_PAYLOAD);
    try {
      const relation = await promotedIn(ask, 'create_relation', endsPayload(type, end));
      try {
        return landed.parse(
          await ask('SELECT type, proposed_type FROM public.relations WHERE id = $1::uuid', [
            relation,
          ]),
        );
      } finally {
        await removed(ask, 'relation', relation);
      }
    } finally {
      await removed(ask, 'entity', end);
    }
  });

test('a create_relation whose type is longer than 200 characters is refused at the proposal', async () => {
  await expect(proposed(TOO_LONG)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_create_relation_type_length',
  });
});

test('a relation whose type is longer than 200 characters is refused at the insert', async () => {
  await expect(inserted(TOO_LONG)).rejects.toMatchObject({
    code: '23514',
    constraint: 'relations_type_length',
  });
});

// Departure: no live type is 200 characters long, so the word cannot reach the column through
// its foreign key. The promotion puts it beside the fallback row, and that is the door it reaches.
test('a type of 200 characters is still accepted at the proposal and kept by the promotion', async () => {
  await expect(proposed(LONGEST)).resolves.toMatch(/^[0-9a-f-]{36}$/);
  await expect(promotedOf(LONGEST)).resolves.toStrictEqual([
    { type: 'unknown', proposed_type: LONGEST },
  ]);
});
