// A departure: the audit arms of the perimeter file, plus the facts that keep arm 4 honest. A
// table added to `public` under another owner silences arm 4, so the owner is checked too.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../probe.ts';

const findings = z.array(z.object({ found: z.string() }));

const foundBy = async (sql: string): Promise<readonly string[]> =>
  probe('superuser', async (ask) => findings.parse(await ask(sql)).map((row) => row.found));

// External constraint: proconfig holds every SET of a function, so a NULL test passes a definer
// that sets another parameter. The underscore is escaped because LIKE reads it as any character.
const NO_SEARCH_PATH = String.raw`SELECT p.proname AS found
            FROM pg_catalog.pg_proc p
           WHERE p.prosecdef
             AND NOT EXISTS (
                   SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) AS s(setting)
                    WHERE s.setting LIKE 'search\_path=%')`;

// External constraint: a search_path that names public resolves a bare table name there. The
// lookbehind passes a name after a dot, so api.entity_type is not the table entity_type.
const INVOKER_READS_PUBLIC = String.raw`SELECT p.proname AS found
            FROM pg_catalog.pg_proc p
           WHERE p.pronamespace = 'api'::regnamespace
             AND NOT p.prosecdef
             AND (p.prosrc ~* '\mpublic\.'
                  OR EXISTS (
                       SELECT 1 FROM pg_catalog.pg_class c
                        WHERE c.relnamespace = 'public'::regnamespace
                          AND c.relkind IN ('r','p','v','m','f')
                          AND p.prosrc ~* ('(?<![.\w"])"?' || c.relname || '\M')))`;

// External constraint: role_table_grants reads the table ACL alone, and a grant on one column is
// only in column_privileges. UNION and not UNION ALL, because a table grant shows on each column.
const WRITE_GRANT = `SELECT g.table_schema || '.' || g.table_name
                 || ' ' || g.privilege_type || ' to ' || g.grantee AS found
            FROM (SELECT t.table_schema, t.table_name, t.privilege_type, t.grantee
                    FROM information_schema.role_table_grants t
                  UNION
                  SELECT c.table_schema, c.table_name, c.privilege_type, c.grantee
                    FROM information_schema.column_privileges c) AS g
           WHERE g.table_schema IN ('public','api')
             AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
             AND g.grantee <> 'gabriel_owner'
             AND NOT EXISTS (
                   SELECT 1 FROM pg_catalog.pg_depend d
                     JOIN pg_catalog.pg_class c ON c.oid = d.objid
                     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                    WHERE d.deptype = 'e' AND n.nspname = g.table_schema
                      AND c.relname = g.table_name)`;

const ARMS = [
  { fault: 'SECURITY DEFINER function with no search_path', sql: NO_SEARCH_PATH },
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
    // A departure: the extension clause keeps out PostGIS, which gives twelve rows on each run.
    // An arm that always answers is an arm nobody reads.
    sql: WRITE_GRANT,
  },
  {
    fault: 'api function with invoker rights that reads public',
    // A departure: arms 1 and 2 filter on prosecdef, so an invoker function escapes both. It
    // raises for gabriel_read, which holds nothing on public, and its GRANT reads as a door.
    sql: INVOKER_READS_PUBLIC,
  },
  {
    fault: 'default privilege that lets a role other than gabriel_owner execute its next function',
    // External constraint: a default set in one schema adds to the default of every schema and
    // cannot revoke it. With no row for every schema, the built-in default gives PUBLIC EXECUTE.
    sql: `SELECT coalesce(n.nspname, 'every schema') || ' EXECUTE to '
                 || CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                         ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS found
            FROM (SELECT 0::oid AS schema,
                         coalesce((SELECT d.defaclacl FROM pg_catalog.pg_default_acl d
                                    WHERE d.defaclrole = 'gabriel_owner'::regrole
                                      AND d.defaclnamespace = 0 AND d.defaclobjtype = 'f'),
                                  pg_catalog.acldefault('f', 'gabriel_owner'::regrole::oid))
                           AS acl
                  UNION ALL
                  SELECT d.defaclnamespace, d.defaclacl FROM pg_catalog.pg_default_acl d
                   WHERE d.defaclrole = 'gabriel_owner'::regrole
                     AND d.defaclnamespace <> 0 AND d.defaclobjtype = 'f') AS s
            LEFT JOIN pg_catalog.pg_namespace n ON n.oid = s.schema
            CROSS JOIN LATERAL pg_catalog.aclexplode(s.acl) AS a
           WHERE a.privilege_type = 'EXECUTE'
             AND (a.grantee = 0 OR pg_catalog.pg_get_userbyid(a.grantee) <> 'gabriel_owner')
           ORDER BY 1`,
  },
] as const;

for (const arm of ARMS)
  test(`the perimeter carries no ${arm.fault}`, async () => {
    expect(await foundBy(arm.sql), `the audit arm found a ${arm.fault}`).toStrictEqual([]);
  });

const foundAfter = async (create: string, sql: string): Promise<readonly string[]> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      await ask(create);
      return findings.parse(await ask(sql)).map((row) => row.found);
    } finally {
      await ask('ROLLBACK');
    }
  });

test('arm 1 finds a definer that sets another parameter and no search_path', async () => {
  const found = await foundAfter(
    `CREATE FUNCTION public.zz_no_search_path() RETURNS int LANGUAGE sql
       SECURITY DEFINER SET statement_timeout = '5s' AS 'SELECT 1'`,
    NO_SEARCH_PATH,
  );
  expect(found).toStrictEqual(['zz_no_search_path']);
});

test('arm 5 finds an api invoker function that names a public table with no schema', async () => {
  const found = await foundAfter(
    `CREATE FUNCTION api.zz_bare_read() RETURNS bigint LANGUAGE sql
       SET search_path = pg_catalog, public, pg_temp AS 'SELECT count(*) FROM entities'`,
    INVOKER_READS_PUBLIC,
  );
  expect(found).toStrictEqual(['zz_bare_read']);
});

test('arm 4 finds a column grant of UPDATE on a table of public', async () => {
  const found = await foundAfter(
    'GRANT UPDATE (label) ON public.entities TO gabriel_agent',
    WRITE_GRANT,
  );
  expect(found).toStrictEqual(['public.entities UPDATE to gabriel_agent']);
});

const DEFINER_DOORS = `
  SELECT n.nspname || '.' || p.proname || ' to '
         || CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                 ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS found
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) AS a
   WHERE n.nspname IN ('public','api') AND p.prosecdef
     AND a.privilege_type = 'EXECUTE'
     AND (a.grantee = 0 OR pg_catalog.pg_get_userbyid(a.grantee) <> 'gabriel_owner')
   ORDER BY 1`;

const THE_DOOR_SET = [
  'public.claim_job to gabriel_agent',
  'public.fail_job to gabriel_agent',
  'public.promote_proposal to gabriel_app',
  'public.propose_change to gabriel_agent',
  'public.propose_change to gabriel_app',
  'public.put_document to gabriel_app',
  'public.reject_proposal to gabriel_app',
  'public.release_expired_claims to gabriel_app',
  'public.set_entity_layout to gabriel_agent',
];

// A departure: a door writes as gabriel_owner and holds no table grant, so EXECUTE on one is a
// write that arm 4 cannot see. The door set is held by hand, and a new grant fails here.
test('every definer door is granted to the roles in this list and to no other', async () => {
  expect(await foundBy(DEFINER_DOORS)).toStrictEqual(THE_DOOR_SET);
});

// External constraint: a NULL ACL is the built-in default, which gives PUBLIC EXECUTE, and
// aclexplode gives no row for it. The default privilege is dropped here to make that door.
test('a definer door that nobody revoked shows as a door to PUBLIC', async () => {
  const doors = await probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      await ask(
        'ALTER DEFAULT PRIVILEGES FOR ROLE gabriel_owner GRANT EXECUTE ON FUNCTIONS TO PUBLIC',
      );
      await ask('SET LOCAL ROLE gabriel_owner');
      await ask(`CREATE FUNCTION public.zz_unrevoked_door() RETURNS int LANGUAGE sql
                   SECURITY DEFINER SET search_path = pg_catalog AS 'SELECT 1'`);
      return findings.parse(await ask(DEFINER_DOORS)).map((row) => row.found);
    } finally {
      await ask('ROLLBACK');
    }
  });
  expect(doors).toContain('public.zz_unrevoked_door to PUBLIC');
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

// A departure: arm 4 enumerates the tables of public. A migration ledger there would be one
// more table, and the arm would then have to permit a write grant on it.
test('the migration ledger is outside public, which is what keeps arm 4 honest', async () => {
  expect(await foundBy(LEDGER)).toStrictEqual(['migrations']);
});

const READ_HOLDS = `
  SELECT g.table_schema || '.' || g.table_name || ' ' || g.privilege_type AS found
    FROM information_schema.role_table_grants g
   WHERE g.grantee = 'gabriel_read'
   ORDER BY 1`;

const TWELVE_VIEWS = [
  'api.document SELECT',
  'api.entity SELECT',
  'api.entity_type SELECT',
  'api.full_graph SELECT',
  'api.full_map SELECT',
  'api.job SELECT',
  'api.key_usage SELECT',
  'api.layout SELECT',
  'api.proposal SELECT',
  'api.relation SELECT',
  'api.value_support SELECT',
];

test('gabriel_read holds SELECT on the eleven api views and nothing else', async () => {
  expect(await foundBy(READ_HOLDS)).toStrictEqual(TWELVE_VIEWS);
});

const NEIGHBOURS = `
  SELECT n.entity_id::text AS found
    FROM api.relation r
   CROSS JOIN LATERAL api.neighbourhood(r.src_id, 1) n
   WHERE r.src_kind = 'entity' AND r.dst_kind = 'entity'
   LIMIT 1`;

// A departure: a static arm proves a shape, and this test proves the door opens. A grant of
// EXECUTE that raises on each call passes arm 5.
test('gabriel_read can execute api.neighbourhood, and not only hold the grant', async () => {
  const found = await probe('read', async (ask) => findings.parse(await ask(NEIGHBOURS)));
  expect(
    found.length,
    'the fixture holds an entity-to-entity relation, so the walk finds one',
  ).toBe(1);
});
