// Departure: this suite calls the door as the owner, because only the owner reads the table the
// door writes. A perimeter test holds who may call the door.

import { Client } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { connectionString } from '../../../tools/db-runtime.ts';

const secrets = z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') });

const ownerClient = (): Client => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error(
      'GABRIEL_DATABASE is not gabriel_test. Run the suite through its configuration.',
    );
  return new Client({
    connectionString: connectionString('superuser', held.data.GABRIEL_DATABASE),
  });
};

const client = ownerClient();

beforeAll(async () => {
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

const WRITE = 'SELECT public.set_entity_layout($1::jsonb)';
const WRITE_NULL = 'SELECT public.set_entity_layout(NULL)';
const ROWS = 'SELECT entity_id, x, y FROM public.entity_layout ORDER BY entity_id';
const TWO = 'SELECT id FROM public.entities ORDER BY id LIMIT 2';

const rows = z.array(z.object({ entity_id: z.uuid(), x: z.number(), y: z.number() }));
const entity = z.object({ id: z.uuid() });
const ids = z.tuple([entity, entity]);

// Origin: an identifier of the version-4 form that no fixture entity carries.
const UNKNOWN = '00000000-0000-4000-8000-00000000dead';

const stored = async (): Promise<z.infer<typeof rows>> =>
  rows.parse((await client.query(ROWS)).rows);

// External constraint: a failed statement aborts the transaction, so each refusal runs inside a
// savepoint, and the suite reads the table after it rolls back to that savepoint.
const refused = async (sql: string, values: unknown[]): Promise<unknown> => {
  await client.query('SAVEPOINT attempt');
  try {
    await client.query(sql, values);
    return 'accepted';
  } catch (error: unknown) {
    return error;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT attempt');
  }
};

const inRollback = async (work: (first: string, second: string) => Promise<void>) => {
  await client.query('BEGIN');
  try {
    const [first, second] = ids.parse((await client.query(TWO)).rows);
    await work(first.id, second.id);
  } finally {
    await client.query('ROLLBACK');
  }
};

const put = async (layout: unknown): Promise<void> => {
  await client.query(WRITE, [JSON.stringify(layout)]);
};

const MISSING_SET = { code: '22023' };

test('a NULL layout is refused and leaves every stored position', async () => {
  await inRollback(async (first) => {
    await put([{ id: first, x: 1, y: 2 }]);
    expect(await refused(WRITE_NULL, [])).toMatchObject(MISSING_SET);
    expect(await stored()).toStrictEqual([{ entity_id: first, x: 1, y: 2 }]);
  });
});

test.each([
  ['a JSON null', null],
  ['an object', { id: UNKNOWN, x: 0, y: 0 }],
  ['a number', 7],
])('a layout that is %s is refused and leaves every stored position', async (_case, layout) => {
  await inRollback(async (first) => {
    await put([{ id: first, x: 1, y: 2 }]);
    expect(await refused(WRITE, [JSON.stringify(layout)])).toMatchObject(MISSING_SET);
    expect(await stored()).toStrictEqual([{ entity_id: first, x: 1, y: 2 }]);
  });
});

test('an empty layout empties the table', async () => {
  await inRollback(async (first, second) => {
    await put([
      { id: first, x: 1, y: 2 },
      { id: second, x: 3, y: 4 },
    ]);
    await put([]);
    expect(await stored()).toStrictEqual([]);
  });
});

test('a second run replaces the first, and an entity it leaves out loses its position', async () => {
  await inRollback(async (first, second) => {
    await put([
      { id: first, x: 1, y: 2 },
      { id: second, x: 3, y: 4 },
    ]);
    await put([{ id: second, x: 5, y: 6 }]);
    expect(await stored()).toStrictEqual([{ entity_id: second, x: 5, y: 6 }]);
  });
});

test('an unknown identifier stops the whole run and leaves the run before it', async () => {
  await inRollback(async (first, second) => {
    await put([{ id: first, x: 1, y: 2 }]);
    const run = [
      { id: second, x: 3, y: 4 },
      { id: UNKNOWN, x: 5, y: 6 },
    ];
    expect(await refused(WRITE, [JSON.stringify(run)])).toMatchObject({
      code: '23503',
      constraint: 'entity_layout_entity_fkey',
    });
    expect(await stored()).toStrictEqual([{ entity_id: first, x: 1, y: 2 }]);
  });
});

// External constraint: JSON holds no NaN and no infinity, so each goes as a string that the
// double precision input reads.
test.each(['NaN', 'Infinity', '-Infinity'])('an x of %s is refused', async (x) => {
  await inRollback(async (first) => {
    const run = [{ id: first, x, y: 0 }];
    expect(await refused(WRITE, [JSON.stringify(run)])).toMatchObject({
      code: '23514',
      constraint: 'entity_layout_finite',
    });
  });
});
