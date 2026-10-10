import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { Queryable } from '../queryable.ts';
import { findNameCandidates } from './name-candidates.ts';

// Departure: each test runs in one transaction that rolls back, and the command runs in it as the
// operator role, as it does on the PC.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 1 });

afterAll(async () => {
  await pool.end();
});

const asOperator = async (work: (db: Queryable) => Promise<void>): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await work(client);
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
};

const entity = async (
  db: Queryable,
  type: string,
  label: string,
  attrs: Record<string, unknown> = {},
): Promise<string> => {
  const { rows } = await db.query(
    `SELECT target_id FROM public.sign_change('a test', 'create_entity', $1::jsonb,
         ARRAY['manual'], NULL, NULL, '{}'::uuid[])`,
    [
      JSON.stringify({
        type,
        label,
        attrs: Object.fromEntries(
          Object.entries(attrs).map(([key, v]) => [key, { v, src: ['manual'] }]),
        ),
        sources: ['manual'],
      }),
    ],
  );
  const [row] = z.array(z.object({ target_id: z.uuid() })).parse(rows);
  if (row === undefined) throw new Error('the entity was not written');
  return row.target_id;
};

const listed = async (db: Queryable, ids: readonly string[]) =>
  z
    .array(z.object({ key: z.string(), type: z.string(), first_id: z.uuid(), second_id: z.uuid() }))
    .parse(
      (await db.query('SELECT key, type, first_id, second_id FROM public.name_candidates()')).rows,
    )
    .filter((row) => ids.includes(row.first_id) || ids.includes(row.second_id));

const sorted = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

test('the command stores the pairs of one type with a Latin and a Cyrillic name of one key', async () => {
  await asOperator(async (db) => {
    const refinery = await entity(db, 'facility', 'Kirishinefteorgsintez NPZ test');
    const refineryRu = await entity(db, 'facility', 'Киришинефтеоргсинтез НПЗ тест');
    // One name, two types: no pair.
    const port = await entity(db, 'port', 'Novorossiysk test');
    const company = await entity(db, 'company', 'Новороссийск тест');
    // A former name in the other script counts.
    const shipper = await entity(db, 'company', 'PJSC Sovcomflot test', {
      former_names: ['Совкомфлот Шиппинг тест'],
    });
    const shipperRu = await entity(db, 'company', 'Совкомфлот тест');
    const shipping = await entity(db, 'company', 'Sovcomflot Shipping test');

    const run = await findNameCandidates(db);
    expect(run.added).toBeGreaterThanOrEqual(3);
    const ids = [refinery, refineryRu, port, company, shipper, shipperRu, shipping];
    const [r1, r2] = sorted(refinery, refineryRu);
    const [s1, s2] = sorted(shipper, shipperRu);
    const [t1, t2] = sorted(shipper, shipping);
    expect(
      (await listed(db, ids)).map((row) => [row.type, row.key, row.first_id, row.second_id]),
    ).toStrictEqual([
      ['company', 'sovkomflot shiping test', t1, t2],
      ['company', 'sovkomflot test', s1, s2],
      ['facility', 'kirishinefteorgsintez npz test', r1, r2],
    ]);
  });
});

test('a refused pair is not listed again when the command runs again', async () => {
  await asOperator(async (db) => {
    const latin = await entity(db, 'company', 'Transneft Volga test');
    const cyrillic = await entity(db, 'company', 'Транснефть Волга тест');
    await findNameCandidates(db);
    expect(await listed(db, [latin, cyrillic])).toHaveLength(1);
    await db.query(`SELECT public.refuse_name_candidate('a test', $1::uuid, $2::uuid)`, [
      latin,
      cyrillic,
    ]);
    const again = await findNameCandidates(db);
    expect(again.kept).toBeGreaterThanOrEqual(1);
    expect(await listed(db, [latin, cyrillic])).toStrictEqual([]);
  });
});
