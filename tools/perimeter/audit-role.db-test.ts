// The perimeter of gabriel_audit, the role of the node audit through the tunnel to the VPS
// (migration 0099). The verdict of the panel of 2026-11-26: the role reads two views and nothing
// else, it can call no function, it is a member of nothing, and it cannot log in until
// tools/record-tunnel.ts opens the tunnel.

import { randomBytes } from 'node:crypto';

import { Client } from 'pg';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { connectionString } from '../db-runtime.ts';
import { probe, rolledBack } from '../probe.ts';

const ROLE = 'gabriel_audit';
const names = z.array(z.object({ name: z.string() }));
const listed = async (sql: string): Promise<string[]> =>
  probe('superuser', async (ask) => names.parse(await ask(sql, [ROLE])).map((row) => row.name));

test('gabriel_audit reads the two audit views and no other relation', async () => {
  expect(
    await listed(`SELECT n.nspname || '.' || c.relname || ' ' || p.privilege AS name
                    FROM pg_catalog.pg_class c
                    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                   CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE',
                                           'REFERENCES','TRIGGER']) AS p(privilege)
                   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                     AND n.nspname NOT LIKE 'pg_toast%'
                     -- PostGIS grants its three catalog tables to PUBLIC, and a table is out of
                     -- reach in a schema that the role cannot use.
                     AND has_schema_privilege($1, n.oid, 'USAGE')
                     AND has_table_privilege($1, c.oid, p.privilege)
                   ORDER BY 1`),
  ).toStrictEqual(['audit.document SELECT', 'audit.document_text SELECT']);
});

test('gabriel_audit uses the schema audit only, and creates nothing', async () => {
  expect(
    await listed(`SELECT n.nspname || ' ' || p.privilege AS name
                    FROM pg_catalog.pg_namespace n
                   CROSS JOIN unnest(ARRAY['USAGE','CREATE']) AS p(privilege)
                   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                     AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
                     AND has_schema_privilege($1, n.oid, p.privilege)
                   ORDER BY 1`),
  ).toStrictEqual(['audit USAGE']);
  expect(
    await listed(
      `SELECT 'CREATE' AS name WHERE has_database_privilege($1, current_database(), 'CREATE')`,
    ),
  ).toStrictEqual([]);
});

// A function is callable only in a schema that the role may use, so the list covers each door.
test('gabriel_audit can call no function outside the system schemas', async () => {
  expect(
    await listed(`SELECT p.oid::regprocedure::text AS name
                    FROM pg_catalog.pg_proc p
                    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                     AND has_schema_privilege($1, n.oid, 'USAGE')
                     AND has_function_privilege($1, p.oid, 'EXECUTE')
                   ORDER BY 1`),
  ).toStrictEqual([]);
});

test('gabriel_audit is a member of nothing, holds no attribute and cannot log in', async () => {
  expect(
    await listed(`SELECT g.rolname AS name FROM pg_catalog.pg_auth_members m
                    JOIN pg_catalog.pg_roles g ON g.oid = m.roleid
                    JOIN pg_catalog.pg_roles r ON r.oid = m.member
                   WHERE r.rolname = $1 OR g.rolname = $1`),
  ).toStrictEqual([]);
  const role = await probe('superuser', (ask) =>
    ask(
      `SELECT rolcanlogin, rolinherit, rolsuper, rolcreaterole, rolcreatedb, rolreplication,
              rolbypassrls, rolconnlimit, rolconfig
         FROM pg_catalog.pg_roles WHERE rolname = $1`,
      [ROLE],
    ),
  );
  expect(role).toStrictEqual([
    {
      rolcanlogin: false,
      rolinherit: false,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
      rolconnlimit: 2,
      rolconfig: ['default_transaction_read_only=on', 'statement_timeout=30s'],
    },
  ]);
});

const counts = z.array(z.object({ n: z.number().int() }));
const countAs = (sql: string): Promise<number> =>
  rolledBack('superuser', async (ask) => {
    await ask(`SET LOCAL ROLE ${ROLE}`);
    return counts.parse(await ask(sql))[0]?.n ?? -1;
  });
const countAsSuperuser = (sql: string): Promise<number> =>
  probe('superuser', async (ask) => counts.parse(await ask(sql))[0]?.n ?? -1);

test('gabriel_audit sees each export document and no other document', async () => {
  const exports = await countAsSuperuser('SELECT count(*)::int AS n FROM public.export_document');
  expect(exports).toBeGreaterThan(0);
  expect(await countAs('SELECT count(*)::int AS n FROM audit.document')).toBe(exports);
});

test('gabriel_audit sees the newest text of the export documents only', async () => {
  const pages = await countAsSuperuser(
    `SELECT count(*)::int AS n FROM public.document_text t
       JOIN public.export_document e ON e.id = t.document_id
      WHERE t.extractor = public.newest_text_extractor(t.document_id)`,
  );
  expect(pages).toBeGreaterThan(0);
  expect(await countAs('SELECT count(*)::int AS n FROM audit.document_text')).toBe(pages);
});

test('gabriel_audit is refused on a table of the record', async () => {
  await expect(countAs('SELECT count(*)::int AS n FROM public.documents')).rejects.toMatchObject({
    code: '42501',
  });
});

// The login that tools/record-tunnel.ts opens: a session of the role starts read only, and a
// client that sets the session to write is still refused by the grants.
test('a login of gabriel_audit starts read only and is refused on each write', async () => {
  const password = randomBytes(16).toString('hex');
  await probe('superuser', (ask) =>
    ask(`ALTER ROLE ${ROLE} LOGIN PASSWORD '${password}' VALID UNTIL 'infinity'`),
  );
  const address = new URL(connectionString('read'));
  address.username = ROLE;
  address.password = password;
  const client = new Client({ connectionString: address.toString() });
  try {
    await client.connect();
    const { rows } = await client.query('SHOW default_transaction_read_only');
    expect(rows).toStrictEqual([{ default_transaction_read_only: 'on' }]);
    await client.query('SET default_transaction_read_only = off');
    for (const write of [
      'CREATE TABLE audit.probe ()',
      "SELECT public.document_level('doc_a')",
      'SELECT 1 FROM public.documents',
    ])
      await expect(client.query(write)).rejects.toMatchObject({ code: '42501' });
  } finally {
    await client.end();
    await probe('superuser', (ask) =>
      ask(`ALTER ROLE ${ROLE} NOLOGIN PASSWORD NULL VALID UNTIL '-infinity'`),
    );
  }
});
