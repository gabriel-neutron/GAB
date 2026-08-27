// The write-authorisation model, stated as privileges. Every sentence here was a hand check
// before it was a test.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../probe.ts';

const DOORS = {
  put_document: 'public.put_document(text,text,text,text,text,text,text,text,date)',
  propose_change: 'public.propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean)',
  promote_proposal: 'public.promote_proposal(uuid,text)',
  reject_proposal: 'public.reject_proposal(uuid,text)',
} as const;

const holders = z.array(z.object({ door: z.string(), held: z.boolean() }));

const doorsHeldBy = async (identity: 'app' | 'agent'): Promise<Record<string, boolean>> => {
  const names = Object.keys(DOORS);
  const signatures = Object.values(DOORS);
  const rows = await probe(identity, async (ask) =>
    holders.parse(
      await ask(
        `SELECT d.door, has_function_privilege(d.signature, 'EXECUTE') AS held
           FROM unnest($1::text[], $2::text[]) AS d(door, signature)`,
        [names, signatures],
      ),
    ),
  );
  return Object.fromEntries(rows.map((row) => [row.door, row.held]));
};

test('gabriel_agent holds EXECUTE on propose_change and on no other door', async () => {
  expect(await doorsHeldBy('agent')).toStrictEqual({
    put_document: false,
    propose_change: true,
    promote_proposal: false,
    reject_proposal: false,
  });
});

test('gabriel_app holds EXECUTE on all four doors', async () => {
  expect(await doorsHeldBy('app')).toStrictEqual({
    put_document: true,
    propose_change: true,
    promote_proposal: true,
    reject_proposal: true,
  });
});

const WRITES_OF = `
  SELECT g.table_schema || '.' || g.table_name || ' ' || g.privilege_type AS found
    FROM information_schema.role_table_grants g
   WHERE g.grantee = $1 AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
   ORDER BY 1`;

const writes = z.array(z.object({ found: z.string() }));

test('gabriel_app writes no table, in any schema', async () => {
  const held = await probe('superuser', async (ask) =>
    writes.parse(await ask(WRITES_OF, ['gabriel_app'])).map((row) => row.found),
  );
  expect(held).toStrictEqual([]);
});

test('gabriel_read reads no table of public', async () => {
  await expect(
    probe('read', async (ask) => ask('SELECT count(*) FROM public.entities')),
  ).rejects.toMatchObject({ code: '42501', message: 'permission denied for schema public' });
});

const VERBS = [
  { verb: 'INSERT', sql: "INSERT INTO api.entity (label) VALUES ('a test')" },
  { verb: 'UPDATE', sql: "UPDATE api.entity SET label = 'a test'" },
  { verb: 'DELETE', sql: 'DELETE FROM api.entity' },
] as const;

for (const { verb, sql } of VERBS)
  test(`gabriel_read cannot ${verb} through an api view`, async () => {
    await expect(probe('read', async (ask) => ask(sql))).rejects.toMatchObject({
      code: '42501',
      message: 'permission denied for view entity',
    });
  });

const settings = z.array(z.object({ statement_timeout: z.string() }));

test('gabriel_read carries a five second statement timeout', async () => {
  const held = await probe('read', async (ask) =>
    settings.parse(await ask('SHOW statement_timeout')),
  );
  expect(held).toStrictEqual([{ statement_timeout: '5s' }]);
});

const CITES_MANUAL = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A perimeter test"}'::jsonb, ARRAY['manual']::text[]) AS id`;

const made = z.array(z.object({ id: z.uuid() }));

// Every call below runs inside a transaction that rolls back, because the proposals ledger is
// append-only and a trigger refuses a delete.
const proposeCitingManual = async (identity: 'app' | 'agent'): Promise<readonly unknown[]> =>
  probe(identity, async (ask) => {
    await ask('BEGIN');
    try {
      return await ask(CITES_MANUAL);
    } finally {
      await ask('ROLLBACK');
    }
  });

test('a machine proposal that cites manual is refused', async () => {
  await expect(proposeCitingManual('agent')).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_machine_not_manual',
    message:
      'new row for relation "proposals" violates check constraint ' +
      '"proposals_machine_not_manual"',
  });
});

test('an operator proposal that cites manual is accepted', async () => {
  expect(made.parse(await proposeCitingManual('app'))).toHaveLength(1);
});
