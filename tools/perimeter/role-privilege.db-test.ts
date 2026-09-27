// The write-authorisation model, stated as privileges. Every sentence here was a hand check
// before it was a test.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack } from '../probe.ts';

const DOORS = {
  put_document: 'public.put_document(text,text,text,text,text,text,text,text,date)',
  propose_change: 'public.propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean)',
  promote_proposal: 'public.promote_proposal(uuid,text)',
  reject_proposal: 'public.reject_proposal(uuid,text)',
  claim_job: 'public.claim_job()',
  release_expired_claims: 'public.release_expired_claims()',
  fail_job: 'public.fail_job(uuid,text)',
  set_entity_layout: 'public.set_entity_layout(jsonb)',
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

// THE TWO ENDS OF THE QUEUE ARE HELD BY DIFFERENT ROLES. The worker takes a row with the
// narrower secret, and the role that owns the doors of the operator is the one that gives a
// lost row back, so neither one holds both halves.

// The layout door writes a drawing of the graph and no evidence, so the worker that runs it holds
// this role: the one that cannot sign as the operator.
test('gabriel_agent holds EXECUTE on propose_change, the layout door, the claim and the failure', async () => {
  expect(await doorsHeldBy('agent')).toStrictEqual({
    put_document: false,
    propose_change: true,
    promote_proposal: false,
    reject_proposal: false,
    claim_job: true,
    release_expired_claims: false,
    fail_job: true,
    set_entity_layout: true,
  });
});

const REFUSED = [
  { identity: 'app', call: 'SELECT * FROM public.claim_job()' },
  { identity: 'agent', call: 'SELECT public.release_expired_claims()' },
  { identity: 'app', call: "SELECT public.fail_job(gen_random_uuid(), 'a perimeter test')" },
] as const;

for (const refused of REFUSED)
  test(`${refused.identity} cannot call the other end of the queue`, async () => {
    await expect(rolledBack(refused.identity, (ask) => ask(refused.call))).rejects.toMatchObject({
      code: '42501',
    });
  });

test('gabriel_app holds EXECUTE on the four acts of the operator and on the release', async () => {
  expect(await doorsHeldBy('app')).toStrictEqual({
    put_document: true,
    propose_change: true,
    promote_proposal: true,
    reject_proposal: true,
    claim_job: false,
    release_expired_claims: true,
    fail_job: false,
    set_entity_layout: false,
  });
});

// External constraint: role_table_grants reads the table ACL alone, and a grant on one column is
// only in column_privileges. UNION and not UNION ALL, because a table grant shows on each column.
const WRITES_OF = `
  SELECT g.table_schema || '.' || g.table_name || ' ' || g.privilege_type AS found
    FROM (SELECT t.table_schema, t.table_name, t.privilege_type, t.grantee
            FROM information_schema.role_table_grants t
          UNION
          SELECT c.table_schema, c.table_name, c.privilege_type, c.grantee
            FROM information_schema.column_privileges c) AS g
   WHERE g.grantee = $1 AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
   ORDER BY 1`;

const writes = z.array(z.object({ found: z.string() }));

test('gabriel_app writes no table, in any schema', async () => {
  const held = await probe('superuser', async (ask) =>
    writes.parse(await ask(WRITES_OF, ['gabriel_app'])).map((row) => row.found),
  );
  expect(held).toStrictEqual([]);
});

test('gabriel_agent writes no table, in any schema', async () => {
  const held = await probe('superuser', async (ask) =>
    writes.parse(await ask(WRITES_OF, ['gabriel_agent'])).map((row) => row.found),
  );
  expect(held).toStrictEqual([]);
});

test('a column grant of UPDATE on an evidentiary table shows as a write', async () => {
  const held = await rolledBack('superuser', async (ask) => {
    await ask('GRANT UPDATE (label) ON public.entities TO gabriel_app');
    return writes.parse(await ask(WRITES_OF, ['gabriel_app'])).map((row) => row.found);
  });
  expect(held).toStrictEqual(['public.entities UPDATE']);
});

// Departure: the claim is a door and not a table write. A worker that could mark a row by hand
// could put it in a state no claim produced, and the count of the attempts would prove nothing.
test('gabriel_agent cannot mark a job by hand', async () => {
  await expect(
    rolledBack('agent', (ask) => ask("UPDATE public.jobs SET status = 'running'")),
  ).rejects.toMatchObject({ code: '42501', message: 'permission denied for table jobs' });
});

test('gabriel_app cannot queue work without a document', async () => {
  await expect(
    rolledBack('app', (ask) => ask("INSERT INTO public.jobs (document_id) VALUES ('manual')")),
  ).rejects.toMatchObject({ code: '42501', message: 'permission denied for table jobs' });
});

const QUEUED = `SELECT count(*)::int AS n FROM public.jobs
   WHERE document_id = $1 AND status = 'queued' AND attempts = 0`;

const counted = z.array(z.object({ n: z.number().int() }));

const DOCUMENT = 'doc_perimeter_queue';

const PUT = `SELECT public.put_document($1, 'file', 'A perimeter test of the queue',
  NULL, NULL, NULL, NULL, NULL, '2026-09-02'::date) AS id`;

// Departure: the one way a job appears. The rollback proves the two writes are one act: the
// document row and the job row leave together, so neither can exist without the other.
test('the ingestion door queues the work in the transaction that writes the document', async () => {
  const inside = await rolledBack('app', async (ask) => {
    await ask(PUT, [DOCUMENT]);
    return counted.parse(await ask(QUEUED, [DOCUMENT]));
  });
  expect(inside).toStrictEqual([{ n: 1 }]);

  const after = await probe('app', async (ask) => counted.parse(await ask(QUEUED, [DOCUMENT])));
  expect(after).toStrictEqual([{ n: 0 }]);
});

const HAND_ENTERED = 'doc_perimeter_manual';

const PUT_MANUAL = `SELECT public.put_document($1, 'manual', 'A perimeter test of a hand entry')
  AS id`;

const ANY_JOB = 'SELECT count(*)::int AS n FROM public.jobs WHERE document_id = $1';

// Departure: a hand-entered source carries no file and no address, so an agent has nothing to
// read. The queue records the work and not the door, and this is the one row that proves it.
test('the ingestion door queues no work for a hand-entered source', async () => {
  const inside = await rolledBack('app', async (ask) => {
    await ask(PUT_MANUAL, [HAND_ENTERED]);
    return counted.parse(await ask(ANY_JOB, [HAND_ENTERED]));
  });
  expect(inside).toStrictEqual([{ n: 0 }]);
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
    await expect(rolledBack('read', (ask) => ask(sql))).rejects.toMatchObject({
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

// Both reserved documents, and not `manual` alone. Migration 0009 widened the two rules to the
// set, because a second reserved word named by neither rule was one the machine layer could sign
// with. `inherited` says no document supports the value, and that is a claim only a person makes.
const RESERVED = ['manual', 'inherited'] as const;

const cites = (document: string): string => `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A perimeter test"}'::jsonb, ARRAY['${document}']::text[]) AS id`;

const made = z.array(z.object({ id: z.uuid() }));

const proposeCiting = (identity: 'app' | 'agent', document: string): Promise<readonly unknown[]> =>
  rolledBack(identity, (ask) => ask(cites(document)));

for (const document of RESERVED) {
  test(`a machine proposal that cites ${document} is refused`, async () => {
    await expect(proposeCiting('agent', document)).rejects.toMatchObject({
      code: '23514',
      constraint: 'proposals_machine_not_reserved',
      message:
        'new row for relation "proposals" violates check constraint ' +
        '"proposals_machine_not_reserved"',
    });
  });

  test(`an operator proposal that cites ${document} is accepted`, async () => {
    expect(made.parse(await proposeCiting('app', document))).toHaveLength(1);
  });
}
