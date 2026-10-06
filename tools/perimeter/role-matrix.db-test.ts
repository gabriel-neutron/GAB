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
      "public.append_chat_message": "app",
      "public.claim_job": "agent",
      "public.complete_job": "agent",
      "public.confirm_fabrication": "app",
      "public.contest_letter": "app",
      "public.decide_originator_fact": "app",
      "public.enqueue_job": "agent app research",
      "public.ensure_originator": "app",
      "public.ensure_originator_candidate": "agent app",
      "public.fail_job": "agent",
      "public.issuer_card_for": "app",
      "public.link_imprint": "app",
      "public.load_trust_list": "app",
      "public.merge_originator": "app",
      "public.open_conversation": "app",
      "public.originator_exceptions": "app",
      "public.originator_letter_for": "app",
      "public.promote_proposal": "app",
      "public.propose_change": "agent app research",
      "public.propose_originator_fact": "agent app",
      "public.put_claim_reading": "agent",
      "public.put_document": "app",
      "public.put_document_text": "agent app research",
      "public.put_fetched_document": "agent research",
      "public.record_model_call": "agent",
      "public.refresh_originator": "app",
      "public.reject_proposal": "app",
      "public.remove_operator_letter": "app",
      "public.requeue_running_jobs": "agent",
      "public.review_originator_card": "app",
      "public.runner_settings": "agent",
      "public.second_read_done": "agent",
      "public.set_entity_layout": "agent",
      "public.set_operator_letter": "app",
      "public.set_party_false": "app",
      "public.sign_change": "app",
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

// Any door that decides a proposal has "promote" or "reject" in its name, so a new door of that
// kind falls under the rule with no edit here. The act of the operator promotes the proposal it
// writes, and the step that writes the record runs inside both, so the two are named.
const DECIDING_DOORS_HELD = `
  SELECT r.role, p.oid::regprocedure::text AS door
    FROM pg_catalog.pg_proc p
   CROSS JOIN unnest($1::text[]) AS r(role)
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE '%promot%' OR p.proname LIKE '%reject%'
          OR p.proname IN ('sign_change', 'apply_proposal'))
     AND has_function_privilege(r.role, p.oid, 'EXECUTE')`;

const DECIDING_DOORS = `
  SELECT count(*)::int AS n FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE '%promot%' OR p.proname LIKE '%reject%'
          OR p.proname IN ('sign_change', 'apply_proposal'))`;

test('a machine role holds no door that promotes or rejects', async () => {
  const counted = await probe('superuser', (ask) => ask(DECIDING_DOORS));
  expect(z.array(z.object({ n: z.number().int() })).parse(counted)[0]?.n).toBeGreaterThan(0);
  const held = await probe('superuser', (ask) => ask(DECIDING_DOORS_HELD, [[...MACHINES]]));
  expect(held).toStrictEqual([]);
});

for (const identity of ['agent', 'research'] as const)
  for (const door of ['promote_proposal', 'reject_proposal'])
    test(`gabriel_${identity} is refused when it calls ${door}`, async () => {
      await expect(
        rolledBack(identity, (ask) =>
          ask(`SELECT public.${door}(gen_random_uuid(), 'a perimeter test')`),
        ),
      ).rejects.toMatchObject({ code: '42501' });
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

test('only the worker role claims a job', async () => {
  expect((await matrix())['public.claim_job']).toBe('agent');
});

test('the operator promotes and rejects', async () => {
  const held = await matrix();
  expect(held['public.promote_proposal']).toBe('app');
  expect(held['public.reject_proposal']).toBe('app');
});
