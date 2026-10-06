// The write-authorisation model, stated as privileges. Every sentence here was a hand check
// before it was a test.

import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from '../probe.ts';

const DOORS = {
  put_document: 'public.put_document(text,text,text,text,text,text,text,text,date,text,numeric)',
  propose_change:
    'public.propose_change(text,jsonb,text[],text,uuid,uuid[],numeric,boolean,uuid,text)',
  record_model_call:
    'public.record_model_call(text,text,text,text,text,integer,text,uuid,text,integer,integer,text,text[])',
  promote_proposal: 'public.promote_proposal(uuid,text)',
  reject_proposal: 'public.reject_proposal(uuid,text)',
  claim_job: 'public.claim_job()',
  release_expired_claims: 'public.release_expired_claims()',
  fail_job: 'public.fail_job(uuid,text)',
  enqueue_job: 'public.enqueue_job(text,text)',
  complete_job: 'public.complete_job(uuid)',
  release_job_for_quota: 'public.release_job_for_quota(uuid)',
  runner_settings: 'public.runner_settings()',
  set_entity_layout: 'public.set_entity_layout(jsonb)',
  open_conversation: 'public.open_conversation(text,text,uuid)',
  append_chat_message: 'public.append_chat_message(uuid,text,text,uuid,jsonb)',
  put_document_text: 'public.put_document_text(text,jsonb,text)',
  put_fetched_document: 'public.put_fetched_document(text,text,text,text,text,text,date,text,text)',
  put_claim_reading:
    'public.put_claim_reading(uuid,uuid,text,integer,integer,integer,text,boolean,uuid,text,text,text,text,text,jsonb,text)',
  second_read_done: 'public.second_read_done(uuid,text,text,text)',
  add_citation: 'public.add_citation(uuid,uuid,text,integer,integer,integer,text)',
  run_evidence_checks: 'public.run_evidence_checks(uuid,uuid)',
  mark_adverse_predicates: 'public.mark_adverse_predicates(uuid)',
  load_adverse_predicates: 'public.load_adverse_predicates(text,jsonb)',
  record_family_probe: 'public.record_family_probe(text,text,text,integer,integer)',
} as const;

const holders = z.array(z.object({ door: z.string(), held: z.boolean() }));

const doorsHeldBy = async (
  identity: 'app' | 'agent' | 'research',
): Promise<Record<string, boolean>> => {
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
test('gabriel_agent holds EXECUTE on propose_change, the call record, the layout door, the claim and the failure', async () => {
  expect(await doorsHeldBy('agent')).toStrictEqual({
    put_document: false,
    propose_change: true,
    promote_proposal: false,
    reject_proposal: false,
    record_model_call: true,
    claim_job: true,
    release_expired_claims: false,
    fail_job: true,
    enqueue_job: true,
    complete_job: true,
    release_job_for_quota: true,
    runner_settings: true,
    set_entity_layout: true,
    open_conversation: false,
    append_chat_message: false,
    put_document_text: true,
    put_fetched_document: true,
    put_claim_reading: true,
    second_read_done: true,
    add_citation: true,
    run_evidence_checks: true,
    mark_adverse_predicates: false,
    load_adverse_predicates: false,
    record_family_probe: false,
  });
});

// THE RESEARCH ROLE PROPOSES AND STORES A FETCHED DOCUMENT, AND IT CANNOT DECIDE OR CLAIM. It holds
// no door of the operator, no door of the queue except the request for work, and no call record.
test('gabriel_research holds EXECUTE on five doors and no other', async () => {
  expect(await doorsHeldBy('research')).toStrictEqual({
    put_document: false,
    propose_change: true,
    promote_proposal: false,
    reject_proposal: false,
    record_model_call: false,
    claim_job: false,
    release_expired_claims: false,
    fail_job: false,
    enqueue_job: true,
    complete_job: false,
    release_job_for_quota: false,
    runner_settings: false,
    set_entity_layout: false,
    open_conversation: false,
    append_chat_message: false,
    put_document_text: true,
    put_fetched_document: true,
    put_claim_reading: false,
    second_read_done: false,
    add_citation: false,
    run_evidence_checks: false,
    mark_adverse_predicates: false,
    load_adverse_predicates: false,
    record_family_probe: false,
  });
});

const REFUSED = [
  { identity: 'app', call: 'SELECT * FROM public.claim_job()' },
  { identity: 'agent', call: 'SELECT public.release_expired_claims()' },
  { identity: 'app', call: "SELECT public.fail_job(gen_random_uuid(), 'a perimeter test')" },
  { identity: 'app', call: 'SELECT public.complete_job(gen_random_uuid())' },
  { identity: 'app', call: 'SELECT public.release_job_for_quota(gen_random_uuid())' },
  { identity: 'research', call: 'SELECT * FROM public.runner_settings()' },
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
    record_model_call: false,
    claim_job: false,
    release_expired_claims: true,
    fail_job: false,
    enqueue_job: true,
    complete_job: false,
    release_job_for_quota: false,
    runner_settings: false,
    set_entity_layout: false,
    open_conversation: true,
    append_chat_message: true,
    put_document_text: true,
    put_fetched_document: false,
    put_claim_reading: false,
    second_read_done: false,
    add_citation: false,
    run_evidence_checks: false,
    mark_adverse_predicates: true,
    load_adverse_predicates: true,
    record_family_probe: true,
  });
});

// THE TIER IS HELD BY NO ROLE YET. The reader of an export gets EXECUTE with the export, because
// the owner of a view does not lend it. gabriel_read has no USAGE on public, so the superuser
// asks on its behalf.
const TIER_HELD = `SELECT r.role,
    has_function_privilege(r.role, 'public.document_tier(text)', 'EXECUTE') AS held
  FROM unnest($1::text[]) AS r(role) ORDER BY r.role`;

const heldBy = z.array(z.object({ role: z.string(), held: z.boolean() }));

test('no login role holds EXECUTE on the tier', async () => {
  const roles = ['gabriel_agent', 'gabriel_app', 'gabriel_read', 'gabriel_research'];
  const found = await probe('superuser', async (ask) =>
    heldBy.parse(await ask(TIER_HELD, [roles])),
  );
  expect(found).toStrictEqual(roles.map((role) => ({ role, held: false })));
});

// The provider table is in public, and the read role reads the api views alone.
test('gabriel_read holds no SELECT on the provider table', async () => {
  const found = await probe('superuser', (ask) =>
    ask("SELECT has_table_privilege('gabriel_read', 'public.document_provider', 'SELECT') AS held"),
  );
  expect(found).toStrictEqual([{ held: false }]);
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

test('gabriel_research writes no table, in any schema', async () => {
  const held = await probe('superuser', async (ask) =>
    writes.parse(await ask(WRITES_OF, ['gabriel_research'])).map((row) => row.found),
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

// Departure: the call record is a door too, and the table that the door writes stays closed. A
// worker that could insert a row by hand could write a call that no model made.
for (const identity of ['agent', 'app'] as const)
  test(`gabriel_${identity} cannot write a model call by hand`, async () => {
    await expect(
      rolledBack(identity, (ask) =>
        ask(`INSERT INTO public.model_call (agent, agent_version, endpoint, requested_model,
               prompt_sha256, latency_ms, outcome)
             VALUES ('a', 'v1', 'e', 'm', repeat('a', 64), 1, 'ok')`),
      ),
    ).rejects.toMatchObject({ code: '42501', message: 'permission denied for table model_call' });
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
  'raw/perimeter-queue.pdf', NULL, NULL, NULL, 'application/pdf', '2026-09-02'::date) AS id`;

const ENQUEUE = "SELECT public.enqueue_job($1, 'extract_text') AS id";

// Departure: the one way a job appears. The rollback proves the two writes are one act: the
// document row and the job row leave together, so neither can exist without the other.
test('the enqueue door queues the work in the transaction that asks for it', async () => {
  const inside = await rolledBack('app', async (ask) => {
    await ask(PUT, [DOCUMENT]);
    await ask(ENQUEUE, [DOCUMENT]);
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
  '{"type":"vessel","label":"A perimeter test"}'::jsonb, ARRAY['${document}']::text[],
  NULL, NULL, '{}', NULL, false, $1::uuid) AS id`;

const made = z.array(z.object({ id: z.uuid() }));

// A machine act names its call, and the agent holds the one door that records it. The operator
// names none.
const callOf = async (identity: 'app' | 'agent' | 'research', ask: Ask): Promise<string | null> => {
  if (identity !== 'agent') return null;
  const [row] = made.parse(
    await ask(`SELECT public.record_model_call('a perimeter test', 'v1', 'e', 'm',
                 repeat('a', 64), 1, 'ok', p_minimiser => 'perimeter-test',
                 p_personal_categories => '{}'::text[]) AS id`),
  );
  return row?.id ?? null;
};

const proposeCiting = (
  identity: 'app' | 'agent' | 'research',
  document: string,
): Promise<readonly unknown[]> =>
  rolledBack(identity, async (ask) => ask(cites(document), [await callOf(identity, ask)]));

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

  test(`a research proposal that cites ${document} is refused`, async () => {
    await expect(proposeCiting('research', document)).rejects.toMatchObject({
      code: '23514',
      constraint: 'proposals_machine_not_reserved',
    });
  });

  test(`an operator proposal that cites ${document} is accepted`, async () => {
    expect(made.parse(await proposeCiting('app', document))).toHaveLength(1);
  });
}

// Departure: an agent reads no uncommitted row of another session, so the suite commits the one
// document the act cites, and removes it after. No act that cites it survives the rollback.
const ORDINARY = 'doc_perimeter_value_source';

const PUT_ORDINARY = `INSERT INTO public.documents (id, kind, title)
  VALUES ($1, 'url', 'A perimeter test of a value source') ON CONFLICT (id) DO NOTHING`;

beforeAll(async () => {
  await probe('superuser', (ask) => ask(PUT_ORDINARY, [ORDINARY]));
});

afterAll(async () => {
  await probe('superuser', (ask) => ask('DELETE FROM public.documents WHERE id = $1', [ORDINARY]));
});

const valueCites = (value: string, act: readonly string[]): Promise<readonly unknown[]> =>
  rolledBack('agent', async (ask) =>
    ask(
      `SELECT public.propose_change('create_entity', jsonb_build_object('type', 'vessel',
         'label', 'A perimeter test', 'attrs', jsonb_build_object('flag',
         jsonb_build_object('v', 'PA', 'src', jsonb_build_array($1::text)))), $2::text[],
         NULL, NULL, '{}', NULL, false, $3::uuid) AS id`,
      [value, act, await callOf('agent', ask)],
    ),
  );

// Departure: no rule reads a reserved word inside a value. A value source stays inside the act
// sources, so a reserved word in a value is either missing from them or cited by the act.
test('a machine value that cites manual where the act does not is refused', async () => {
  await expect(valueCites('manual', [ORDINARY])).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_src_within',
  });
});

test('a machine value that cites manual where the act does is refused', async () => {
  await expect(valueCites('manual', [ORDINARY, 'manual'])).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_machine_not_reserved',
  });
});

test('a machine value that cites the document of its act is accepted', async () => {
  expect(made.parse(await valueCites(ORDINARY, [ORDINARY]))).toHaveLength(1);
});

// Departure: the conversations are the operator's and they are private. The read role has no
// USAGE on public, the agent holds no grant, and the writer reads them as gabriel_app.
const CHAT_TABLES = ['conversation', 'chat_message', 'chat_citation'] as const;

for (const table of CHAT_TABLES) {
  test(`gabriel_read cannot read ${table}`, async () => {
    await expect(
      probe('read', async (ask) => ask(`SELECT count(*) FROM public.${table}`)),
    ).rejects.toMatchObject({ code: '42501', message: 'permission denied for schema public' });
  });

  test(`gabriel_agent cannot read ${table}`, async () => {
    await expect(
      probe('agent', async (ask) => ask(`SELECT count(*) FROM public.${table}`)),
    ).rejects.toMatchObject({ code: '42501', message: `permission denied for table ${table}` });
  });

  test(`gabriel_app reads ${table}`, async () => {
    expect(
      await probe('app', async (ask) => ask(`SELECT count(*) FROM public.${table}`)),
    ).toHaveLength(1);
  });
}

const BY_HAND = [
  ['conversation', "INSERT INTO public.conversation (title) VALUES ('a test')"],
  ['conversation', "UPDATE public.conversation SET title = 'a test'"],
  ['conversation', 'DELETE FROM public.conversation'],
  [
    'chat_message',
    `INSERT INTO public.chat_message (conversation_id, role, text)
       VALUES (gen_random_uuid(), 'user', 'a test')`,
  ],
  ['chat_message', "UPDATE public.chat_message SET text = 'a test'"],
  ['chat_message', 'DELETE FROM public.chat_message'],
  [
    'chat_citation',
    `INSERT INTO public.chat_citation (message_id, document_id)
       VALUES (gen_random_uuid(), 'manual')`,
  ],
  ['chat_citation', "UPDATE public.chat_citation SET excerpt = 'a test'"],
  ['chat_citation', 'DELETE FROM public.chat_citation'],
] as const;

for (const [table, sql] of BY_HAND)
  test(`gabriel_app cannot write ${table} by hand: ${sql.split(' ')[0]}`, async () => {
    await expect(rolledBack('app', (ask) => ask(sql))).rejects.toMatchObject({
      code: '42501',
      message: `permission denied for table ${table}`,
    });
  });
