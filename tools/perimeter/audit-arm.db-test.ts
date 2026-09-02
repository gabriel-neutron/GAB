// The five audit arms of the perimeter file, plus the facts that keep arm 4 honest. A tool once
// added a table to `public` and silenced arm 4 by changing its owner; a person caught it and no
// check did.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../probe.ts';

const findings = z.array(z.object({ found: z.string() }));

const foundBy = async (sql: string): Promise<readonly string[]> =>
  probe('superuser', async (ask) => findings.parse(await ask(sql)).map((row) => row.found));

const ARMS = [
  {
    fault: 'SECURITY DEFINER function with no search_path',
    sql: `SELECT p.proname AS found
            FROM pg_catalog.pg_proc p
           WHERE p.prosecdef AND p.proconfig IS NULL`,
  },
  {
    fault: 'SECURITY DEFINER function that gabriel_owner does not own',
    sql: `SELECT p.proname AS found
            FROM pg_catalog.pg_proc p
           WHERE p.pronamespace IN ('public'::regnamespace, 'api'::regnamespace)
             AND p.prosecdef AND p.proowner <> 'gabriel_owner'::regrole`,
  },
  {
    fault: 'member of gabriel_owner',
    sql: `SELECT r.rolname AS found
            FROM pg_catalog.pg_auth_members m
            JOIN pg_catalog.pg_roles r ON r.oid = m.member
           WHERE m.roleid = 'gabriel_owner'::regrole`,
  },
  {
    fault: 'write grant on a table of public or api',
    // The extension clause is the arm as the perimeter file states it. Without it PostGIS
    // returns twelve rows on every run, and an arm that always answers is an arm nobody reads.
    sql: `SELECT g.table_schema || '.' || g.table_name
                 || ' ' || g.privilege_type || ' to ' || g.grantee AS found
            FROM information_schema.role_table_grants g
           WHERE g.table_schema IN ('public','api')
             AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
             AND g.grantee <> 'gabriel_owner'
             AND NOT EXISTS (
                   SELECT 1 FROM pg_catalog.pg_depend d
                     JOIN pg_catalog.pg_class c ON c.oid = d.objid
                     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                    WHERE d.deptype = 'e' AND n.nspname = g.table_schema
                      AND c.relname = g.table_name)`,
  },
  {
    fault: 'api function with invoker rights that reads public',
    // Arms 1 and 2 filter on prosecdef, so a function that is NOT a definer escapes both.
    // gabriel_read holds nothing on public, so such a function raises for the only role that
    // may call it, and the GRANT reads as a working door.
    sql: String.raw`SELECT p.proname AS found
            FROM pg_catalog.pg_proc p
           WHERE p.pronamespace = 'api'::regnamespace
             AND NOT p.prosecdef AND p.prosrc ~ '\mpublic\.'`,
  },
] as const;

for (const arm of ARMS)
  test(`the perimeter carries no ${arm.fault}`, async () => {
    expect(await foundBy(arm.sql), `the audit arm found a ${arm.fault}`).toStrictEqual([]);
  });

const DEFINER_DOORS = `
  SELECT n.nspname || '.' || p.proname || ' to '
         || CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                 ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS found
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(p.proacl) AS a
   WHERE n.nspname IN ('public','api') AND p.prosecdef
     AND a.privilege_type = 'EXECUTE'
     AND (a.grantee = 0 OR pg_catalog.pg_get_userbyid(a.grantee) <> 'gabriel_owner')
   ORDER BY 1`;

const THE_DOOR_SET = [
  'public.promote_proposal to gabriel_app',
  'public.propose_change to gabriel_agent',
  'public.propose_change to gabriel_app',
  'public.put_document to gabriel_app',
  'public.reject_proposal to gabriel_app',
];

// ARM 6. The five arms above read a table grant, and a SECURITY DEFINER door holds none: the door
// writes as gabriel_owner, so EXECUTE on one is the right to write a table that arm 4 says the
// caller cannot touch. The list below is the door set, held by hand, so a door granted to a role
// later fails here until a person writes it in. claim_job is absent, and that absence is the
// statement: no role takes a row from the queue while no door gives one back.
test('every definer door is granted to the roles in this list and to no other', async () => {
  expect(await foundBy(DEFINER_DOORS)).toStrictEqual(THE_DOOR_SET);
});

const OUTSIDE_OWNER = `
  SELECT c.relname AS table_name, pg_catalog.pg_get_userbyid(c.relowner) AS owner,
         (SELECT e.extname FROM pg_catalog.pg_depend d
            JOIN pg_catalog.pg_extension e ON e.oid = d.refobjid
           WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
           AS extension
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
     AND pg_catalog.pg_get_userbyid(c.relowner) <> 'gabriel_owner'
   ORDER BY c.relname`;

const owners = z.array(
  z.object({ table_name: z.string(), owner: z.string(), extension: z.string().nullable() }),
);

test('gabriel_owner owns every table of public, and PostGIS owns the one exception', async () => {
  const outside = await probe('superuser', async (ask) => owners.parse(await ask(OUTSIDE_OWNER)));
  expect(outside).toStrictEqual([
    { table_name: 'spatial_ref_sys', owner: 'gabriel', extension: 'postgis' },
  ]);
});

const LEDGER = `
  SELECT n.nspname AS found
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relname = 'pgmigrations'`;

// Arm 4 enumerates the tables of public. A migration ledger inside public would be one more
// table in that enumeration, and the arm would then have to permit a write grant on it.
test('the migration ledger is outside public, which is what keeps arm 4 honest', async () => {
  expect(await foundBy(LEDGER)).toStrictEqual(['migrations']);
});

const READ_HOLDS = `
  SELECT g.table_schema || '.' || g.table_name || ' ' || g.privilege_type AS found
    FROM information_schema.role_table_grants g
   WHERE g.grantee = 'gabriel_read'
   ORDER BY 1`;

const EIGHT_VIEWS = [
  'api.attribute_key SELECT',
  'api.document SELECT',
  'api.entity SELECT',
  'api.entity_type SELECT',
  'api.key_usage SELECT',
  'api.proposal SELECT',
  'api.relation SELECT',
  'api.value_support SELECT',
];

test('gabriel_read holds SELECT on the eight api views and nothing else', async () => {
  expect(await foundBy(READ_HOLDS)).toStrictEqual(EIGHT_VIEWS);
});

const NEIGHBOURS = `
  SELECT n.entity_id::text AS found
    FROM api.relation r
   CROSS JOIN LATERAL api.neighbourhood(r.src_id, 1) n
   WHERE r.src_kind = 'entity' AND r.dst_kind = 'entity'
   LIMIT 1`;

// A static arm proves a shape. This one proves the door opens. Arm 5 and this test are the two
// halves of one defect: the read role held EXECUTE on api.neighbourhood and every call raised.
test('gabriel_read can execute api.neighbourhood, and not only hold the grant', async () => {
  const found = await probe('read', async (ask) => findings.parse(await ask(NEIGHBOURS)));
  expect(
    found.length,
    'the fixture holds an entity-to-entity relation, so the walk finds one',
  ).toBe(1);
});
