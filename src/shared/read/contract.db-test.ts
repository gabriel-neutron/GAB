// Every row of every published view, read over HTTP and parsed. The generated contract once
// refused every row of seven of the eight views, and four suites stayed green.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { keyUsage } from '@/contract/api/KeyUsage';
import { valueSupport } from '@/contract/api/ValueSupport';

import { readRows } from './http';
import { toDomain } from './map';

interface View {
  readonly view: string;
  readonly read: (row: unknown) => unknown;
  /** The column a bad row breaks, and the value that breaks it. The schema must name it back. */
  readonly column: string;
  readonly instead: unknown;
}

const VIEWS: readonly View[] = [
  { view: 'document', read: (row) => toDomain.document(row), column: 'kind', instead: 'pamphlet' },
  { view: 'entity', read: (row) => toDomain.entity(row), column: 'label', instead: null },
  {
    view: 'relation',
    read: (row) => toDomain.relation(row),
    column: 'src_kind',
    instead: 'vessel',
  },
  { view: 'proposal', read: (row) => toDomain.proposal(row), column: 'status', instead: 'maybe' },
  {
    view: 'entity_type',
    read: (row) => toDomain.entityType(row),
    column: 'ord',
    instead: 'third',
  },
  {
    view: 'attribute_key',
    read: (row) => toDomain.attributeKey(row),
    column: 'kind',
    instead: 'colour',
  },
  {
    view: 'value_support',
    read: (row) => valueSupport.parse(row),
    column: 'owner_id',
    instead: 'the northern ledger',
  },
  { view: 'key_usage', read: (row) => keyUsage.parse(row), column: 'claims', instead: 'many' },
];

const named = (view: string, cause: unknown): Error =>
  new Error(`the ${view} view answered a row the contract refuses: ${String(cause)}`);

const rowShape = z.record(z.string(), z.unknown());

// Every column a refusal names, and no other. A schema that is not run at all raises nothing,
// and a schema that reads the wrong column names the wrong one.
const columnsRefused = (read: (row: unknown) => unknown, row: unknown): readonly string[] => {
  try {
    read(row);
  } catch (cause) {
    if (!(cause instanceof z.ZodError)) throw cause;
    return [...new Set(cause.issues.map((issue) => issue.path.join('.')))];
  }
  throw new Error('the contract accepted a row that the base table cannot hold');
};

for (const { view, read, column, instead } of VIEWS) {
  test(`every row of the ${view} view is the shape the contract states`, async () => {
    const rows = await readRows(view);
    for (const row of rows)
      try {
        read(row);
      } catch (cause) {
        throw named(view, cause);
      }
    expect(rows.length).toBeGreaterThan(0);
  });

  test(`the ${view} view refuses a row whose ${column} the base table cannot hold`, async () => {
    const [first] = await readRows(view);
    const bad = { ...rowShape.parse(first), [column]: instead };
    expect({ view, columns: columnsRefused(read, bad) }).toStrictEqual({
      view,
      columns: [column],
    });
  });
}

// A schema cache that the reader took before a reset answers 404, and one that it took after a
// drop answers an empty list. Neither is a contract fault, and both empty every surface.
test('the entity view answers with rows, and not with an empty list', async () => {
  expect((await readRows('entity')).length).toBeGreaterThan(0);
});
