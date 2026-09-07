// A departure: the table set is read from the catalogue and never written by hand, so a table
// born in `public` is covered on the day it is created. Each line of the exemption list is the
// act of a person, and it carries the reason beside it.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from './probe.ts';

const WRITE_VERBS = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'];

const EXEMPT_CASCADES = {
  entity_layout_entity_fkey:
    'A position is presentation, not evidence. The cascade destroys the drawing of a row that ' +
    'is already deleted, and no caller loses an evidentiary row through it.',
};

const findings = z.array(z.object({ found: z.string() }));

const foundBy = async (sql: string, values: readonly unknown[]): Promise<readonly string[]> =>
  probe('superuser', async (ask) => findings.parse(await ask(sql, values)).map((row) => row.found));

const EVERY_TABLE = `
  SELECT t.table_name AS found
    FROM information_schema.tables t
   WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
   ORDER BY 1`;

const evidentiary = await foundBy(EVERY_TABLE, []);

const ARMS = [
  {
    fault: 'default privilege that opens the next table of public',
    sql: `SELECT n.nspname || ' ' || a.privilege_type || ' to '
                 || CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                         ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS found
            FROM pg_catalog.pg_default_acl d
            JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
            CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS a
           WHERE d.defaclobjtype = 'r' AND n.nspname = 'public'
             AND a.privilege_type = ANY($1)
             AND (a.grantee = 0 OR pg_catalog.pg_get_userbyid(a.grantee) <> 'gabriel_owner')
           ORDER BY 1`,
    values: [WRITE_VERBS],
  },
  {
    fault: 'foreign key that cascades a delete of an evidentiary row',
    sql: `SELECT c.conname AS found
            FROM pg_catalog.pg_constraint c
            JOIN pg_catalog.pg_class child ON child.oid = c.conrelid
           WHERE c.contype = 'f' AND c.confdeltype = 'c'
             AND NOT (c.conname = ANY($2))
             AND child.relnamespace = 'public'::regnamespace AND child.relname = ANY($1)
           ORDER BY 1`,
    values: [evidentiary, Object.keys(EXEMPT_CASCADES)],
  },
] as const;

for (const arm of ARMS)
  test(`the perimeter carries no ${arm.fault}`, async () => {
    expect(await foundBy(arm.sql, arm.values), `the arm found a ${arm.fault}`).toStrictEqual([]);
  });
