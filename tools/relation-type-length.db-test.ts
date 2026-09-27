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

test('a type of 200 characters is still accepted at both doors', async () => {
  await expect(proposed(LONGEST)).resolves.toMatch(/^[0-9a-f-]{36}$/);
  await expect(inserted(LONGEST)).resolves.toHaveLength(1);
});
