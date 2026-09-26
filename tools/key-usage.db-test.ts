// Departure: the fixture carries keys on both tables, so a view that drops a branch still has
// rows. These tests write known keys in a transaction that rolls back, and read the exact rows.

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
  '{"type":"vessel","label":"A key usage test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const PROPOSE_RELATION = `SELECT public.propose_change('create_relation',
  '{"type":"owns","src_id":"${END}","dst_id":"${END}"}'::jsonb,
  ARRAY['manual']::text[]) AS id`;

const HULL = 'probe_usage_hull';
const SHARE = 'probe_usage_share';
const ROW_DOC = 'probe-usage-row-doc';
const VALUE_DOC = 'probe-usage-value-doc';

const cited = (value: number): { v: number; src: string[] } => ({ v: value, src: [VALUE_DOC] });

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, attrs, sources, promoted_from)
  VALUES ('vessel', 'A key usage test', $1::jsonb, ARRAY[$2]::doc_id[], $3) RETURNING id`;

const INSERT_RELATION = `INSERT INTO public.relations (type, src_id, dst_id, attrs, sources,
  promoted_from) VALUES ('owns', $1, $1, $2::jsonb, ARRAY[$3]::doc_id[], $4) RETURNING id`;

// External constraint: the trigger that stamps the author refuses each role but the two writers.
const actOf = async (ask: Ask, text: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const id = await idOf(ask, text, []);
  await ask('RESET SESSION AUTHORIZATION');
  return id;
};

const entityOf = async (ask: Ask, value: number): Promise<string> =>
  idOf(ask, INSERT_ENTITY, [
    JSON.stringify({ [HULL]: cited(value) }),
    ROW_DOC,
    await actOf(ask, PROPOSE_ENTITY),
  ]);

// External constraint: the proposals ledger is append-only, so the rollback is the only way back.
const written = <T>(read: (ask: Ask, owners: readonly string[]) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      const end = await entityOf(ask, 1);
      await entityOf(ask, 2);
      const relation = await idOf(ask, INSERT_RELATION, [
        end,
        JSON.stringify({ [HULL]: cited(3), [SHARE]: cited(4) }),
        ROW_DOC,
        await actOf(ask, PROPOSE_RELATION),
      ]);
      return await read(ask, [end, relation]);
    } finally {
      await ask('ROLLBACK');
    }
  });

const usage = z.array(
  z.object({ key: z.string(), owner_kind: z.string(), owner_type: z.string(), claims: z.number() }),
);

test('key_usage groups each written key by its owner kind and type, with its count', async () => {
  const rows = await written(async (ask) =>
    usage.parse(
      await ask(
        `SELECT key, owner_kind, owner_type, claims::int AS claims FROM api.key_usage
          WHERE key = ANY($1) ORDER BY key, owner_kind`,
        [[HULL, SHARE]],
      ),
    ),
  );
  expect(rows).toStrictEqual([
    { key: HULL, owner_kind: 'entity', owner_type: 'vessel', claims: 2 },
    { key: HULL, owner_kind: 'relation', owner_type: 'owns', claims: 1 },
    { key: SHARE, owner_kind: 'relation', owner_type: 'owns', claims: 1 },
  ]);
});

const support = z.array(
  z.object({
    owner_kind: z.string(),
    owner_label: z.string(),
    doc_id: z.string(),
    attr_key: z.string().nullable(),
    value: z.number().nullable(),
  }),
);

test('value_support gives each cited value of an owner, and the source list of its row', async () => {
  const rows = await written(async (ask, owners) =>
    support.parse(
      await ask(
        `SELECT owner_kind, owner_label, doc_id, attr_key, value FROM api.value_support
          WHERE owner_id = ANY($1) ORDER BY owner_kind, attr_key NULLS LAST`,
        [owners],
      ),
    ),
  );
  const entity = { owner_kind: 'entity', owner_label: 'A key usage test' };
  expect(rows).toStrictEqual([
    { ...entity, doc_id: VALUE_DOC, attr_key: HULL, value: 1 },
    { ...entity, doc_id: ROW_DOC, attr_key: null, value: null },
    { owner_kind: 'relation', owner_label: 'owns', doc_id: VALUE_DOC, attr_key: HULL, value: 3 },
    { owner_kind: 'relation', owner_label: 'owns', doc_id: VALUE_DOC, attr_key: SHARE, value: 4 },
    { owner_kind: 'relation', owner_label: 'owns', doc_id: ROW_DOC, attr_key: null, value: null },
  ]);
});
