// A departure: the audit arms of the perimeter file, plus the facts that keep arm 4 honest. A
// table added to `public` under another owner silences arm 4, so the owner is checked too.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../probe.ts';

const findings = z.array(z.object({ found: z.string() }));

const foundBy = async (sql: string, values?: readonly unknown[]): Promise<readonly string[]> =>
  probe('superuser', async (ask) => findings.parse(await ask(sql, values)).map((row) => row.found));

const WRITE_VERBS = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];

const EXEMPT_CASCADES = {
  entity_layout_entity_fkey:
    'A position is presentation, not evidence. The cascade destroys the drawing of a row that ' +
    'is already deleted, and no caller loses an evidentiary row through it.',
};

// A departure: the table set is read from the catalogue and never written by hand, so a table
// born in `public` is covered on the day it is created. Each line of the exemption list is the
// act of a person, and it carries the reason beside it.
const EVERY_TABLE = `
  SELECT t.table_name AS found
    FROM information_schema.tables t
   WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
   ORDER BY 1`;

const evidentiary = await foundBy(EVERY_TABLE);

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

// External constraint: since PostgreSQL 16 a GRANT of a role gives the SET option by default, so
// a member can SET ROLE to it, and a predefined role such as pg_write_all_data adds no table grant.
const MEMBERSHIP = `SELECT DISTINCT r.rolname || ' in ' || g.rolname AS found
            FROM pg_catalog.pg_auth_members m
            JOIN pg_catalog.pg_roles r ON r.oid = m.member
            JOIN pg_catalog.pg_roles g ON g.oid = m.roleid
           WHERE m.roleid = 'gabriel_owner'::regrole
              OR r.rolname IN ('gabriel_app','gabriel_agent','gabriel_research','gabriel_read')
          UNION ALL
          SELECT r.rolname || ' is ' || a.attribute
            FROM pg_catalog.pg_roles r
           CROSS JOIN LATERAL (VALUES ('SUPERUSER', r.rolsuper), ('CREATEROLE', r.rolcreaterole),
                                      ('CREATEDB', r.rolcreatedb), ('BYPASSRLS', r.rolbypassrls),
                                      ('REPLICATION', r.rolreplication)) AS a(attribute, held)
           WHERE r.rolname IN ('gabriel_app','gabriel_agent','gabriel_research','gabriel_read') AND a.held
           ORDER BY 1`;

// External constraint: a default with no IN SCHEMA is stored with defaclnamespace 0, which no
// namespace matches, and it opens the next table of public too.
const NEXT_TABLE_OPEN = `SELECT coalesce(n.nspname, 'every schema') || ' ' || a.privilege_type
                 || ' to ' || CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                   ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS found
            FROM pg_catalog.pg_default_acl d
            LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
            CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS a
           WHERE d.defaclobjtype = 'r'
             AND (d.defaclnamespace = 0 OR n.nspname = 'public')
             AND a.privilege_type = ANY($1)
             AND (a.grantee = 0 OR pg_catalog.pg_get_userbyid(a.grantee) <> 'gabriel_owner')
           ORDER BY 1`;

interface Arm {
  readonly fault: string;
  readonly sql: string;
  readonly values?: readonly unknown[];
}

// External constraint: a referential action other than RESTRICT or NO ACTION writes the child
// row past the privileges of the caller. The codes are c CASCADE, n SET NULL and d SET DEFAULT.
const CASCADING_KEY = {
  sql: `SELECT c.conname AS found
          FROM pg_catalog.pg_constraint c
          JOIN pg_catalog.pg_class child ON child.oid = c.conrelid
         WHERE c.contype = 'f'
           AND (c.confdeltype IN ('c','n','d') OR c.confupdtype IN ('c','n','d'))
           AND NOT (c.conname = ANY($2))
           AND child.relnamespace = 'public'::regnamespace AND child.relname = ANY($1)
         ORDER BY 1`,
  values: [evidentiary, Object.keys(EXEMPT_CASCADES)],
};

const ARMS: readonly Arm[] = [
  { fault: 'SECURITY DEFINER function with no search_path', sql: NO_SEARCH_PATH },
  {
    fault: 'SECURITY DEFINER function that gabriel_owner does not own',
    sql: `SELECT p.proname AS found
            FROM pg_catalog.pg_proc p
           WHERE p.pronamespace IN ('public'::regnamespace, 'api'::regnamespace)
             AND p.prosecdef AND p.proowner <> 'gabriel_owner'::regrole`,
  },
  { fault: 'role membership or elevated attribute of a login role', sql: MEMBERSHIP },
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
  {
    fault: 'default privilege that opens the next table of public',
    sql: NEXT_TABLE_OPEN,
    values: [WRITE_VERBS],
  },
  {
    fault: 'foreign key whose delete or update action writes an evidentiary row',
    ...CASCADING_KEY,
  },
];

for (const arm of ARMS)
  test(`the perimeter carries no ${arm.fault}`, async () => {
    expect(await foundBy(arm.sql, arm.values), `the audit arm found a ${arm.fault}`).toStrictEqual(
      [],
    );
  });

const foundAfter = async (
  create: string,
  sql: string,
  values?: readonly unknown[],
): Promise<readonly string[]> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      await ask(create);
      return findings.parse(await ask(sql, values)).map((row) => row.found);
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

test('arm 3 finds a login role made a member of a predefined role that writes', async () => {
  const found = await foundAfter('GRANT pg_write_all_data TO gabriel_agent', MEMBERSHIP);
  expect(found).toStrictEqual(['gabriel_agent in pg_write_all_data']);
});

test('arm 3 finds a login role given an elevated attribute', async () => {
  const found = await foundAfter('ALTER ROLE gabriel_read BYPASSRLS', MEMBERSHIP);
  expect(found).toStrictEqual(['gabriel_read is BYPASSRLS']);
});

test('arm 7 finds a default that opens the next table of every schema', async () => {
  const found = await foundAfter(
    'ALTER DEFAULT PRIVILEGES FOR ROLE gabriel_owner GRANT INSERT ON TABLES TO gabriel_app',
    NEXT_TABLE_OPEN,
    [WRITE_VERBS],
  );
  expect(found).toStrictEqual(['every schema INSERT to gabriel_app']);
});

const REKEYED_TYPE = (action: string): string =>
  `ALTER TABLE public.entities DROP CONSTRAINT entities_type_fkey,
     ADD CONSTRAINT entities_type_fkey FOREIGN KEY (type) REFERENCES public.entity_type(key)
       ${action}`;

test('arm 8 finds a foreign key that cascades an update onto an evidentiary row', async () => {
  const found = await foundAfter(
    REKEYED_TYPE('ON UPDATE CASCADE ON DELETE RESTRICT'),
    CASCADING_KEY.sql,
    CASCADING_KEY.values,
  );
  expect(found).toStrictEqual(['entities_type_fkey']);
});

test('arm 8 finds a foreign key that sets an evidentiary column to null on a delete', async () => {
  const found = await foundAfter(
    REKEYED_TYPE('ON UPDATE RESTRICT ON DELETE SET NULL'),
    CASCADING_KEY.sql,
    CASCADING_KEY.values,
  );
  expect(found).toStrictEqual(['entities_type_fkey']);
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

const READ_VIEWS = [
  'api.document SELECT',
  'api.document_provider SELECT',
  'api.entity SELECT',
  'api.entity_type SELECT',
  'api.full_map SELECT',
  'api.layout SELECT',
  'api.proposal SELECT',
  'api.relation SELECT',
  'api.relation_type SELECT',
];

test('gabriel_read holds SELECT on the nine public api views and nothing else', async () => {
  expect(await foundBy(READ_HOLDS)).toStrictEqual(READ_VIEWS);
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

const MACHINE_HOLDS = `
  SELECT g.grantee || ' ' || g.table_schema || '.' || g.table_name || ' ' || g.privilege_type
           AS found
    FROM information_schema.role_table_grants g
   WHERE g.grantee IN ('gabriel_app','gabriel_agent','gabriel_research')
     AND g.table_schema = 'api'
   ORDER BY 1`;

const MACHINE_VIEWS = ['document', 'entity', 'job', 'proposal', 'relation'];

// A departure: the five views are named, and ALL TABLES is not used, so a view added later opens
// to no tool until a person writes it in.
test('the three tool roles hold SELECT on five api views and on nothing else of api', async () => {
  const expected = ['gabriel_agent', 'gabriel_app', 'gabriel_research'].flatMap((role) =>
    MACHINE_VIEWS.map((view) => `${role} api.${view} SELECT`),
  );
  expect(await foundBy(MACHINE_HOLDS)).toStrictEqual(expected);
});

const NEIGHBOURHOOD_HOLDERS = `
  SELECT pg_catalog.pg_get_userbyid(a.grantee) AS found
    FROM pg_catalog.pg_proc p
   CROSS JOIN LATERAL pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) AS a
   WHERE p.pronamespace = 'api'::regnamespace AND p.proname = 'neighbourhood'
     AND a.privilege_type = 'EXECUTE'
   ORDER BY 1`;

test('api.neighbourhood runs for the owner, the read role and the three tool roles alone', async () => {
  expect(await foundBy(NEIGHBOURHOOD_HOLDERS)).toStrictEqual([
    'gabriel_agent',
    'gabriel_app',
    'gabriel_owner',
    'gabriel_read',
    'gabriel_research',
  ]);
});
