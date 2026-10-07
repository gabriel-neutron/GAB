// The gate the drift check cannot hold. A CHECK reaches no generated type, so a member added to
// one in SQL reaches no TypeScript file: the check stays green and the first row that carries the
// new value throws in the browser.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { row } from '../src/shared/read/rows.ts';
import { probe } from './probe.ts';

const EVERY_CHECK = `
  SELECT t.relname AS table_name, a.attname AS column_name,
         pg_catalog.pg_get_constraintdef(c.oid) AS definition
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
  WHERE c.contype = 'c' AND n.nspname = 'public'`;

const constraints = z.array(
  z.object({ table_name: z.string(), column_name: z.string(), definition: z.string() }),
);

type Constraint = z.infer<typeof constraints>[number];

const readChecks = async (): Promise<readonly Constraint[]> =>
  constraints.parse(await probe('app', (ask) => ask(EVERY_CHECK)));

// PostgreSQL writes `x IN ('a','b')` back as `x = ANY (ARRAY['a'::text, 'b'::text])`, and wraps a
// nullable column in `(x IS NULL) OR`. A definition of any other shape is a rule and not a set,
// so it is skipped: one column carries a closed set and three conditional rules.
const closedSetShape = (column: string): RegExp =>
  new RegExp(
    `^CHECK \\(\\((?:\\(${column} IS NULL\\) OR )?\\(?${column} = ANY \\(ARRAY\\[(.+)\\]\\)\\)?\\)\\)$`,
  );

const MEMBER = /'((?:[^']|'')*)'::text/g;

const membersOf = (definition: string, column: string): readonly string[] | null => {
  const stated = closedSetShape(column).exec(definition);
  const list = stated?.[1];
  if (list === undefined) return null;
  return [...list.matchAll(MEMBER)].map((found) => (found[1] ?? '').replaceAll("''", "'"));
};

const named = (at: string): { table: string; column: string } => {
  const [table, column, ...rest] = at.split('.');
  if (table === undefined || column === undefined || rest.length > 0)
    throw new Error(`the key ${at} names no table and column`);
  return { table, column };
};

// Each closed set the rows of the read API state, named by the table and the column of the CHECK.
const CLOSED_SET: Readonly<Record<string, readonly string[]>> = {
  'documents.kind': row.document.shape.kind.options,
  'relations.src_kind': row.relation.shape.src_kind.options,
  'relations.dst_kind': row.relation.shape.dst_kind.options,
  'proposals.op': row.proposal.shape.op.options,
  'proposals.target_kind': row.proposal.shape.target_kind.unwrap().options,
  'proposals.author_role': row.proposal.shape.author_role.options,
  'proposals.status': row.proposal.shape.status.options,
};

const declared = await readChecks();

for (const [at, stated] of Object.entries(CLOSED_SET)) {
  test(`the closed set of ${at} holds the members the base table permits`, () => {
    const { table, column } = named(at);
    const found = declared
      .filter((check) => check.table_name === table && check.column_name === column)
      .map((check) => membersOf(check.definition, column))
      .filter((members) => members !== null);

    expect(found, `no CHECK of ${at} states a closed set`).toHaveLength(1);
    expect([...(found[0] ?? [])].sort()).toStrictEqual([...stated].sort());
  });
}
