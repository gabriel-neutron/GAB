// The three roles that run a tool read the record through the api views, and they write nothing
// through them. A view runs with the rights of its owner, so each gesture below proves two facts
// at once: the read opens, and the write stays shut.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from '../probe.ts';

const ROLES = ['app', 'agent', 'research'] as const;

const OPEN_VIEWS = [
  'entity',
  'relation',
  'proposal',
  'document',
  'job',
  'entity_type',
  'relation_type',
] as const;

const counted = z.array(z.object({ n: z.number() }));

for (const role of ROLES)
  for (const view of OPEN_VIEWS)
    test(`gabriel_${role} reads api.${view}`, async () => {
      const found = await rolledBack(role, async (ask) =>
        counted.parse(await ask(`SELECT count(*)::int AS n FROM api.${view}`)),
      );
      expect(found).toHaveLength(1);
    });

const NEIGHBOURS = `SELECT count(*)::int AS n
  FROM api.relation r CROSS JOIN LATERAL api.neighbourhood(r.src_id, 1) AS w
  WHERE r.src_kind = 'entity' AND r.dst_kind = 'entity'`;

for (const role of ROLES)
  test(`gabriel_${role} runs api.neighbourhood and the walk finds a neighbour`, async () => {
    const [row] = await rolledBack(role, async (ask) => counted.parse(await ask(NEIGHBOURS)));
    expect(row?.n).toBeGreaterThan(0);
  });

const VERBS = [
  { verb: 'INSERT', sql: "INSERT INTO api.entity (label) VALUES ('a machine test')" },
  { verb: 'UPDATE', sql: "UPDATE api.entity SET label = 'a machine test'" },
  { verb: 'DELETE', sql: 'DELETE FROM api.entity' },
] as const;

for (const role of ROLES)
  for (const { verb, sql } of VERBS)
    test(`gabriel_${role} cannot ${verb} through an api view`, async () => {
      await expect(rolledBack(role, (ask) => ask(sql))).rejects.toMatchObject({
        code: '42501',
        message: 'permission denied for view entity',
      });
    });
