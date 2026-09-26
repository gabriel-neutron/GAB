import { expect, test } from 'vitest';
import { z } from 'zod';

import { entityLayout } from './layout.ts';
import { runLayout } from './layout-job.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const D = '44444444-4444-4444-8444-444444444444';
const E = '55555555-5555-4555-8555-555555555555';

interface EntityRow {
  readonly id: string;
}

interface LinkRow {
  readonly src_id: string;
  readonly dst_id: string;
}

interface Call {
  readonly text: string;
  readonly values: readonly unknown[] | undefined;
}

const ENTITY_ROWS: readonly EntityRow[] = [A, B, C, D, E].map((id) => ({ id }));
const LINK_ROWS: readonly LinkRow[] = [
  { src_id: A, dst_id: B },
  { src_id: B, dst_id: C },
  { src_id: D, dst_id: A },
];

const WRITE = 'SELECT public.set_entity_layout($1::jsonb)';

const positions = z.array(z.object({ id: z.uuid(), x: z.number(), y: z.number() }));

const byText = (one: string, two: string): number => {
  if (one < two) return -1;
  return one > two ? 1 : 0;
};

const byEntity = (one: EntityRow, two: EntityRow): number => byText(one.id, two.id);

const byLink = (one: LinkRow, two: LinkRow): number =>
  byText(one.src_id, two.src_id) || byText(one.dst_id, two.dst_id);

// Departure: the fake applies an ORDER BY the way the database does, and it gives heap order
// when the read has none. A call that it has no answer for rejects, so no call passes in silence.
const databaseOf = (entityRows: readonly EntityRow[], linkRows: readonly LinkRow[]) => {
  const calls: Call[] = [];
  const answer = (text: string): readonly unknown[] => {
    if (text.startsWith('SELECT id FROM public.entities'))
      return text.includes('ORDER BY id') ? [...entityRows].sort(byEntity) : entityRows;
    if (text.startsWith('SELECT src_id, dst_id FROM public.relations'))
      return text.includes('ORDER BY src_id, dst_id') ? [...linkRows].sort(byLink) : linkRows;
    if (text === WRITE) return [{ set_entity_layout: null }];
    throw new Error(`The fake database has no answer for: ${text}`);
  };
  const query = async (text: string, values?: unknown[]): Promise<{ rows: unknown[] }> => {
    calls.push({ text, values });
    return Promise.resolve({ rows: [...answer(text)] });
  };
  return { query, calls };
};

const payloadOf = (call: Call | undefined): z.infer<typeof positions> => {
  const sent = z.tuple([z.string()]).parse(call?.values);
  return positions.parse(JSON.parse(sent[0]));
};

test('the entities read is ordered by id, and the links read by both ends', async () => {
  const database = databaseOf(ENTITY_ROWS, LINK_ROWS);
  await runLayout(database);
  const [entitiesRead, linksRead] = database.calls;
  expect(entitiesRead?.text).toContain('ORDER BY id');
  expect(linksRead?.text).toContain('ORDER BY src_id, dst_id');
});

test('the run sends every position it computes to the layout door as its last call', async () => {
  const database = databaseOf(ENTITY_ROWS, LINK_ROWS);
  const placed = await runLayout(database);

  expect(database.calls).toHaveLength(3);
  const write = database.calls.at(-1);
  expect(write?.text).toBe(WRITE);

  const expected = entityLayout(
    [A, B, C, D, E],
    LINK_ROWS.map((row) => ({ source: row.src_id, target: row.dst_id })),
  );
  expect(payloadOf(write)).toStrictEqual(expected);
  expect(placed).toBe(5);
});

test('one entity with no relation is sent with the position the layout gives it', async () => {
  const database = databaseOf([{ id: A }], []);
  expect(await runLayout(database)).toBe(1);
  expect(payloadOf(database.calls.at(-1))).toStrictEqual(entityLayout([A], []));
});

test('the same corpus in two heap orders gives the same picture', async () => {
  const first = databaseOf(ENTITY_ROWS, LINK_ROWS);
  const second = databaseOf([...ENTITY_ROWS].reverse(), [...LINK_ROWS].reverse());
  await runLayout(first);
  await runLayout(second);
  expect(payloadOf(second.calls.at(-1))).toStrictEqual(payloadOf(first.calls.at(-1)));
});
