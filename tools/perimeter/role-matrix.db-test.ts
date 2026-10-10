// Who can open each door: propose, promote, reject, queue, claim. A door writes as its owner and
// holds no table grant, so EXECUTE on a door is the whole write perimeter of a role. The snapshot
// shows each change of a grant in the diff, and the hard assertions below never move.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack } from '../probe.ts';

// External constraint: a NULL ACL is the built-in default, which gives PUBLIC EXECUTE, and
// aclexplode gives no row for it, so the default is read in its place.
const DOOR_HOLDERS = `
  SELECT n.nspname || '.' || p.proname AS door,
         CASE WHEN a.grantee = 0 THEN 'PUBLIC'
              ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS holder
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   CROSS JOIN LATERAL pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) AS a
   WHERE n.nspname IN ('public', 'api') AND p.prosecdef
     AND a.privilege_type = 'EXECUTE'
     AND (a.grantee = 0 OR pg_catalog.pg_get_userbyid(a.grantee) <> 'gabriel_owner')
   ORDER BY 1, 2`;

const holders = z.array(z.object({ door: z.string(), holder: z.string() }));

// Each door maps to the roles that open it, in one line, so the snapshot reads as a table.
const matrix = async (): Promise<Record<string, string>> => {
  const rows = await probe('superuser', async (ask) => holders.parse(await ask(DOOR_HOLDERS)));
  const held: Record<string, string[]> = {};
  for (const row of rows) (held[row.door] ??= []).push(row.holder.replace(/^gabriel_/u, ''));
  return Object.fromEntries(Object.entries(held).map(([door, roles]) => [door, roles.join(' ')]));
};

const MACHINES = ['gabriel_agent', 'gabriel_research'] as const;

test('the role matrix of the doors', async () => {
  expect(await matrix()).toMatchInlineSnapshot(`
    {
      "public.ai_promote_group": "research",
      "public.ai_promote_unit": "research",
      "public.ai_reject_relation": "research",
      "public.ai_reject_unit": "research",
      "public.approve_reference_set": "app",
      "public.author_names_dry_run": "app",
      "public.author_names_waiting": "app",
      "public.citations_independent": "app",
      "public.claim_job": "agent",
      "public.complete_job": "agent",
      "public.correct_document_title": "app",
      "public.decide_author_name": "app",
      "public.decision_said": "app",
      "public.document_jobs": "app research",
      "public.enqueue_job": "agent app research",
      "public.enqueue_mapped_load": "agent",
      "public.fact_digit": "app",
      "public.fail_job": "agent",
      "public.fill_document_provider": "agent research",
      "public.fill_document_uri": "app",
      "public.join_author_name": "agent",
      "public.lead_jobs": "app research",
      "public.letter_of": "app",
      "public.merge_entities": "app",
      "public.nato_pair": "app",
      "public.promote_group": "app",
      "public.promote_unit": "app",
      "public.propose_batch": "agent research",
      "public.propose_change": "app",
      "public.propose_mapping": "agent",
      "public.put_document": "app",
      "public.put_document_text": "agent app research",
      "public.put_fetched_document": "agent research",
      "public.put_load_report": "agent",
      "public.rating_context": "agent",
      "public.record_act_check": "agent",
      "public.record_lead_document": "agent",
      "public.record_model_call": "agent checker",
      "public.record_research_check": "checker",
      "public.reference_set": "app",
      "public.reject_relation": "app",
      "public.reject_unit": "app",
      "public.release_claims": "agent app research",
      "public.release_disclaimer": "agent app research",
      "public.release_documents": "agent app research",
      "public.release_entities": "agent app research",
      "public.release_merges": "agent app research",
      "public.release_relations": "agent app research",
      "public.requeue_failed_ratings": "app",
      "public.requeue_running_jobs": "agent",
      "public.review_decided": "app research",
      "public.review_group": "app research",
      "public.review_groups": "app research",
      "public.review_units": "app research",
      "public.runner_settings": "agent",
      "public.set_entity_layout": "agent",
      "public.sign_change": "app",
      "public.start_lead": "app research",
      "public.store_author_letter": "agent",
      "public.store_reference_author": "app",
      "public.undo_merge": "app",
      "public.unit_rule": "app",
    }
  `);
});

test('a door that nobody revoked shows in the matrix as open to PUBLIC', async () => {
  const rows = await rolledBack('superuser', async (ask) => {
    await ask(
      'ALTER DEFAULT PRIVILEGES FOR ROLE gabriel_owner GRANT EXECUTE ON FUNCTIONS TO PUBLIC',
    );
    await ask('SET LOCAL ROLE gabriel_owner');
    await ask(`CREATE FUNCTION public.zz_unrevoked_door() RETURNS int LANGUAGE sql
                 SECURITY DEFINER SET search_path = pg_catalog AS 'SELECT 1'`);
    return holders.parse(await ask(DOOR_HOLDERS));
  });
  expect(rows).toContainEqual({ door: 'public.zz_unrevoked_door', holder: 'PUBLIC' });
});

test('no door is open to PUBLIC or to the public read role', async () => {
  const open = Object.entries(await matrix()).filter(([, roles]) =>
    roles.split(' ').some((role) => role === 'PUBLIC' || role === 'read'),
  );
  expect(open).toStrictEqual([]);
});

// Any door that decides a proposal has "promote", "reject" or "decide" in its name, so a new door
// of that kind falls under the rule with no edit here. The act of the operator promotes the proposal it
// writes, and the steps that write the record run inside the doors, so each one is named.
const DECIDING_DOORS_HELD = `
  SELECT r.role, p.oid::regprocedure::text AS door
    FROM pg_catalog.pg_proc p
   CROSS JOIN unnest($1::text[]) AS r(role)
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE '%promot%' OR p.proname LIKE '%reject%' OR p.proname LIKE '%decide%'
          OR p.proname IN ('sign_change', 'apply_proposal', 'apply_proposal_as', 'apply_rules', 'run_rules',
                         'write_unit', 'write_unit_as', 'ai_decision'))
     AND has_function_privilege(r.role, p.oid, 'EXECUTE')
   ORDER BY 1, 2`;

const DECIDING_DOORS = `
  SELECT count(*)::int AS n FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE '%promot%' OR p.proname LIKE '%reject%' OR p.proname LIKE '%decide%'
          OR p.proname IN ('sign_change', 'apply_proposal', 'apply_proposal_as', 'apply_rules', 'run_rules',
                         'write_unit', 'write_unit_as', 'ai_decision'))`;

// The research role decides only as an AI reviewer: four doors that record their own origin.
// The worker decides nothing. The read of the decided acts has "decide" in its name.
test('a machine role holds no door that promotes or rejects, except the doors of an AI reviewer', async () => {
  const counted = await probe('superuser', (ask) => ask(DECIDING_DOORS));
  expect(z.array(z.object({ n: z.number().int() })).parse(counted)[0]?.n).toBeGreaterThan(0);
  const held = await probe('superuser', (ask) => ask(DECIDING_DOORS_HELD, [[...MACHINES]]));
  expect(held).toStrictEqual([
    { role: 'gabriel_research', door: 'ai_promote_group(uuid,uuid[],text)' },
    { role: 'gabriel_research', door: 'ai_promote_unit(uuid,text)' },
    { role: 'gabriel_research', door: 'ai_reject_relation(uuid,text,text,text)' },
    { role: 'gabriel_research', door: 'ai_reject_unit(uuid,text,text,text)' },
    // A read: the decided acts, as the review page shows them.
    { role: 'gabriel_research', door: 'review_decided(timestamp with time zone,uuid,integer)' },
  ]);
});

// The functions that the rules run on stand in the database for the doors to call. The matrix above
// lists a function that is SECURITY DEFINER only, so this list names each step, definer or not.
// The read of the operator is the one exception: unit_rule, which the snapshot shows.
const RULE_STEPS = [
  'apply_rules',
  'run_rules',
  'start_deepening',
  'rejected_after_search',
  'rerun_on_budget',
  'units_of_job',
  'units_of_author',
  'fact_is_strong',
  'unit_doubt_cause',
  'rule_of_faults',
  'unit_said',
] as const;

const RULE_STEPS_HELD = `
  SELECT r.role, p.proname AS door
    FROM pg_catalog.pg_proc p
   CROSS JOIN unnest($1::text[]) AS r(role)
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY ($2::text[])
     AND has_function_privilege(r.role, p.oid, 'EXECUTE')`;

test('no role and no PUBLIC holds a step of the rules', async () => {
  const known = await probe('superuser', (ask) =>
    ask(
      `SELECT count(DISTINCT proname)::int AS n FROM pg_catalog.pg_proc
        WHERE pronamespace = 'public'::regnamespace AND proname = ANY ($1::text[])`,
      [[...RULE_STEPS]],
    ),
  );
  // A name that does not exist is a typo in this list, so the count must match the names.
  expect(z.array(z.object({ n: z.number().int() })).parse(known)[0]?.n).toBe(RULE_STEPS.length);
  const held = await probe('superuser', (ask) =>
    ask(RULE_STEPS_HELD, [
      [
        'gabriel_app',
        'gabriel_agent',
        'gabriel_research',
        'gabriel_read',
        'gabriel_checker',
        'public',
      ],
      [...RULE_STEPS],
    ]),
  );
  expect(held).toStrictEqual([]);
});

test('a machine role cannot write a check, or set that it passed', async () => {
  for (const identity of ['agent', 'research', 'checker'] as const) {
    await expect(
      rolledBack(identity, (ask) =>
        ask(
          `INSERT INTO public.act_check (proposal_id, checker_model, checker_family, reader_family,
             verdict) SELECT id, 'm', 'a', 'b', 'supported' FROM public.proposals LIMIT 1`,
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  }
});

// The doors of the operator. The research role decides through its own doors, with its own origin.
const DECISIONS = [
  "public.promote_unit(gen_random_uuid(), 'a perimeter test')",
  "public.promote_group(gen_random_uuid(), ARRAY[gen_random_uuid()], 'a perimeter test')",
  "public.reject_unit(gen_random_uuid(), 'duplicate', NULL, 'a perimeter test')",
  "public.reject_relation(gen_random_uuid(), 'duplicate', NULL, 'a perimeter test')",
] as const;

for (const identity of ['agent', 'research'] as const)
  for (const door of DECISIONS)
    test(`gabriel_${identity} is refused when it calls ${door}`, async () => {
      await expect(rolledBack(identity, (ask) => ask(`SELECT ${door}`))).rejects.toMatchObject({
        code: '42501',
      });
    });

for (const identity of ['agent', 'research'] as const)
  test(`gabriel_${identity} is refused when it signs an act of the operator`, async () => {
    await expect(
      rolledBack(identity, (ask) =>
        ask(`SELECT * FROM public.sign_change('a perimeter test', 'create_entity',
               '{"type":"vessel","label":"A perimeter test"}'::jsonb, ARRAY['manual'],
               NULL, NULL, '{}')`),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

// A merge and its undo are judgements of the operator on identity (M12).
const MERGE_DOORS = [
  "public.merge_entities('a perimeter test', gen_random_uuid(), gen_random_uuid())",
  "public.undo_merge('a perimeter test', gen_random_uuid())",
] as const;

for (const identity of ['agent', 'research', 'checker', 'read'] as const)
  for (const door of MERGE_DOORS)
    test(`gabriel_${identity} is refused when it calls ${door}`, async () => {
      await expect(
        rolledBack(identity, (ask) => ask(`SELECT * FROM ${door}`)),
      ).rejects.toMatchObject({ code: '42501' });
    });

test('only the worker role claims a job', async () => {
  expect((await matrix())['public.claim_job']).toBe('agent');
});

// A rejection keeps a reason and a note that stay private to the operator and to the AI reviewer.
for (const identity of ['read', 'agent'] as const)
  test(`gabriel_${identity} cannot read the decided acts with the reasons of the rejections`, async () => {
    await expect(
      rolledBack(identity, (ask) => ask('SELECT public.review_decided(NULL, NULL, 1)')),
    ).rejects.toMatchObject({ code: '42501' });
  });

// Each door that writes a check or the record of a model call. A forged check would let a rule
// accept a fact that no second model read.
const CHECK_DOORS = [
  "public.record_act_check(gen_random_uuid(), 'm', 'a', 'b', 'supported')",
  "public.record_research_check(gen_random_uuid(), 'm', 'a', 'b', 'supported')",
  "public.record_model_call('a perimeter test', 'v1', 'e', 'm', repeat('a', 64), 1, 'ok')",
] as const;

for (const door of CHECK_DOORS)
  test(`gabriel_research is refused when it calls ${door}`, async () => {
    await expect(rolledBack('research', (ask) => ask(`SELECT ${door}`))).rejects.toMatchObject({
      code: '42501',
    });
  });

const HELD_BY = `
  SELECT p.oid::regprocedure::text AS door
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace IN ('public'::regnamespace, 'api'::regnamespace)
     AND has_function_privilege($1, p.oid, 'EXECUTE')
     AND (p.prosecdef OR p.proacl IS NOT NULL)
   ORDER BY 1`;

test('gabriel_checker holds two doors and no other, and reads no table', async () => {
  const held = await probe('superuser', async (ask) =>
    z
      .array(z.object({ door: z.string() }))
      .parse(await ask(HELD_BY, ['gabriel_checker']))
      .map((row) => row.door),
  );
  expect(held).toStrictEqual([
    'record_model_call(text,text,text,text,text,integer,text,uuid,text,integer,integer)',
    'record_research_check(uuid,text,text,text,text,text)',
  ]);
  const tables = await probe('superuser', (ask) =>
    ask(
      `SELECT count(*)::int AS n FROM information_schema.role_table_grants
        WHERE grantee = 'gabriel_checker'`,
    ),
  );
  expect(tables).toStrictEqual([{ n: 0 }]);
});

test('a door of the check refuses an act that another role wrote', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    const [act] = z.array(z.object({ id: z.uuid(), author_role: z.string() })).parse(
      await ask(
        `SELECT id, author_role FROM public.proposals
            WHERE originator IS NOT NULL AND author_role = 'gabriel_agent' LIMIT 1`,
      ),
    );
    if (act === undefined) return 'the fixture holds no act of gabriel_agent';
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_checker');
    await ask('SAVEPOINT refused');
    try {
      await ask("SELECT public.record_research_check($1, 'm', 'a', 'b', 'supported')", [act.id]);
      return 'written';
    } catch (cause) {
      return cause instanceof Error ? cause.message : String(cause);
    }
  });
  expect(refused).toBe(
    'a check of this door belongs to an act of a machine that gabriel_research wrote',
  );
});
