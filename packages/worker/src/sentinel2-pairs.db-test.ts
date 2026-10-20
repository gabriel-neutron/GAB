// The query of strikes against the disposable database: the superuser writes a small record in one
// transaction that rolls back, and the query reads it as the role of the worker.

import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { roleAddress } from './address.ts';
import { strikesOf } from './sentinel2-pairs.ts';

z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 1 });

afterAll(async () => {
  await pool.end();
});

const SITE = '00000000-0000-4000-8000-0000000000a1';
const OTHER_SITE = '00000000-0000-4000-8000-0000000000a2';
const STRIKE = '00000000-0000-4000-8000-0000000000b1';
const NIGHT = '00000000-0000-4000-8000-0000000000b2';
const FIRE = '00000000-0000-4000-8000-0000000000b3';
const NO_SITE = '00000000-0000-4000-8000-0000000000b4';

test('the query reads claimed attacks with a site point, a day or a night', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE public.proposals IN SHARE ROW EXCLUSIVE MODE');
    // Each row of the record cites the act that made it, once. The test borrows one act of the
    // fixture and drops the two unique constraints inside the transaction that rolls back.
    await client.query('ALTER TABLE public.entities DROP CONSTRAINT entities_promoted_from_key');
    await client.query(
      `DO $$ DECLARE c text; BEGIN
         SELECT conname INTO c FROM pg_constraint
          WHERE conrelid = 'public.relations'::regclass AND contype = 'u'
            AND pg_get_constraintdef(oid) = 'UNIQUE (promoted_from)';
         IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.relations DROP CONSTRAINT %I', c); END IF;
       END $$`,
    );
    const { rows: acts } = await client.query<{ id: string }>(
      'SELECT id FROM public.proposals ORDER BY id LIMIT 1',
    );
    const act = acts[0]?.id;
    const nextAct = () => act;
    const { rows: documents } = await client.query<{ id: string }>(
      'SELECT id FROM public.documents ORDER BY id LIMIT 1',
    );
    const sources = [documents[0]?.id];
    const entity = (id: string, type: string, label: string, attrs: object, point: boolean) =>
      client.query(
        `INSERT INTO public.entities (id, type, label, sources, attrs, geom, promoted_from)
         VALUES ($1, $2, $3, $7::doc_id[], $4::jsonb,
                 CASE WHEN $5 THEN ST_SetSRID(ST_MakePoint(38.65, 44.86), 4326) END, $6)`,
        [id, type, label, JSON.stringify(attrs), point, nextAct(), sources],
      );
    const kind = (v: string) => ({ event_kind: { v, src: sources } });
    await entity(SITE, 'facility', 'Test refinery', {}, true);
    await entity(OTHER_SITE, 'facility', 'Test terminal without a point', {}, false);
    await entity(
      STRIKE,
      'event',
      'claimed attack — Test refinery — 2026-05-15',
      { ...kind('claimed attack'), occurred_on: { v: '2026-05-15', src: sources } },
      false,
    );
    await entity(
      NIGHT,
      'event',
      'claimed attack — Test refinery — 2026-05-15 (night)',
      { ...kind('claimed attack'), occurred_on: { v: ['2026-05-14', '2026-05-15'], src: sources } },
      false,
    );
    await entity(
      FIRE,
      'event',
      'fire — Test refinery — 2026-05-16',
      { ...kind('fire'), occurred_on: { v: '2026-05-16', src: sources } },
      false,
    );
    await entity(
      NO_SITE,
      'event',
      'claimed attack — Test terminal without a point — 2026-05-17',
      { ...kind('claimed attack'), occurred_on: { v: '2026-05-17', src: sources } },
      false,
    );
    for (const [event, site] of [
      [STRIKE, SITE],
      [NIGHT, SITE],
      [FIRE, SITE],
      [NO_SITE, OTHER_SITE],
    ] as const)
      await client.query(
        `INSERT INTO public.relations (type, src_id, dst_id, sources, attrs, promoted_from)
         VALUES ('occurred_at', $1, $2, $4::doc_id[], '{}'::jsonb, $3)`,
        [event, site, nextAct(), sources],
      );
    await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
    const { strikes } = await strikesOf(client);
    expect(strikes.map((one) => [one.ref, one.day, one.until])).toEqual([
      [STRIKE, '2026-05-15', '2026-05-15'],
      [NIGHT, '2026-05-14', '2026-05-15'],
    ]);
    expect(strikes[0]).toMatchObject({ latitude: 44.86, longitude: 38.65 });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
