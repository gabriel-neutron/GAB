// The report of candidate duplicates against the disposable database: the superuser writes a small
// record in one transaction that rolls back, and the report reads it.

import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import { gemDuplicates } from './gem-duplicates.ts';

z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 1 });

afterAll(async () => {
  await pool.end();
});

const id = (n: number): string => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;

test('a true pair is listed; near fields of two names and a far pair of one name are not', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE public.proposals IN SHARE ROW EXCLUSIVE MODE');
    // Each row of the record cites the act that made it, once. The test borrows one act of the
    // fixture and drops the unique constraint inside the transaction that rolls back.
    await client.query('ALTER TABLE public.entities DROP CONSTRAINT entities_promoted_from_key');
    const { rows: acts } = await client.query<{ id: string }>(
      'SELECT id FROM public.proposals ORDER BY id LIMIT 1',
    );
    const { rows: documents } = await client.query<{ id: string }>(
      'SELECT id FROM public.documents ORDER BY id LIMIT 1',
    );
    const sources = [documents[0]?.id];
    const entity = (n: number, label: string, longitude: number, gem: boolean) =>
      client.query(
        `INSERT INTO public.entities (id, type, label, sources, attrs, geom, promoted_from)
         VALUES ($1, 'facility', $2, $3::doc_id[], $4::jsonb,
                 ST_SetSRID(ST_MakePoint($5, 69), 4326), $6)`,
        [
          id(n),
          label,
          sources,
          JSON.stringify(gem ? { gem_unit_id: { v: `G${String(n)}`, src: sources } } : {}),
          longitude,
          acts[0]?.id,
        ],
      );
    // Pair A is a true pair 2 km apart. Pair B is a field near another field, with a name that
    // has a prefix. Pair C has one name 3 degrees of longitude (about 120 km) apart.
    await entity(1, 'Yuzhno-Kirinskoye Oil and Gas Field (Russia)', 40.0, true);
    await entity(2, 'Yuzhno-Kirinskoye Field', 40.05, false);
    await entity(3, 'Kirinskoye field', 40.0, true);
    await entity(5, 'Urengoy gas field', 40.0, true);
    await entity(6, 'Urengoy', 43.0, false);
    // Pair D: a dossier entity with no point pairs on the name. A name with a prefix, and an entity
    // that holds a GEM key, do not.
    await entity(8, 'Bovanenkovskoye (Gazprom) Oil and Gas Asset (Russia)', 41.0, true);
    await entity(9, 'Bovanenkovo oil and gas condensate deposit', 0, false);
    await entity(10, 'Bovanenkovo', 0, true);
    await client.query('UPDATE public.entities SET geom = NULL WHERE id = ANY($1)', [
      [id(9), id(10)],
    ]);

    const pairs = (await gemDuplicates(client)).filter((p) => Number(p.gemId.slice(-2)) < 11);
    expect(pairs.map((p) => [p.gemId, p.dossierId])).toStrictEqual([
      [id(1), id(2)],
      [id(8), id(9)],
    ]);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
