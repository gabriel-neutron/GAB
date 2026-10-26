// Migration 0089 puts the day and the order of the two ends into the claim key of a sts_with
// relation. The case puts the test database back in the state before 0089, inside a transaction
// that always rolls back, and runs the file.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const MIGRATION = join(import.meta.dirname, '..', 'db', 'migrations', '0089_sts_day_and_order_key.sql');

// The rule of 0080: the day enters the key of a port call. The ends keep the stored order.
const BEFORE_0089 = `
  SET LOCAL ROLE gabriel_owner;
  CREATE OR REPLACE FUNCTION claim_key_of(p_op text, p_target_kind text, p_target_id uuid,
                                          p_payload jsonb)
  RETURNS text
  LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
    SELECT md5(CASE p_op
      WHEN 'create_entity' THEN
        jsonb_build_array(p_op, p_payload->>'type', public.name_key(p_payload->>'label'))
      WHEN 'create_relation' THEN
        jsonb_build_array(p_op, p_payload->>'type',
                          public.claim_end_key(p_payload->>'src_id'),
                          public.claim_end_key(p_payload->>'dst_id'))
        || CASE WHEN p_payload->>'type' IN ('berthed_at', 'loads_at', 'discharges_at')
                     AND p_payload #> '{attrs,observed_on,v}' IS NOT NULL
                THEN jsonb_build_array(p_payload #> '{attrs,observed_on,v}')
                ELSE '[]'::jsonb
           END
      ELSE
        jsonb_build_array(p_op, p_target_kind, public.claim_end_key(p_target_id::text),
                          coalesce((SELECT jsonb_object_agg(a.key, a.value->'v')
                                      FROM jsonb_each(p_payload->'attrs') AS a),
                                   '{}'::jsonb),
                          p_payload - 'attrs' - 'sources')
    END::text)
  $$;
  RESET ROLE`;

// The files of this project run at the same time, and the migration changes a table that they
// write. The test takes every lock it needs first, with a short wait. A wait that ends, or a
// deadlock, runs the case again.
const LOCKS = 'LOCK TABLE public.proposals, public.documents IN ACCESS EXCLUSIVE MODE';

const LOCK_TIMEOUT = '55P03';
const DEADLOCK = '40P01';

const alone = async <T>(work: (ask: Ask) => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await rolledBack('superuser', async (ask) => {
        await ask("SET LOCAL lock_timeout = '200ms'");
        await ask(LOCKS);
        await ask('SET LOCAL lock_timeout = 0');
        return work(ask);
      });
    } catch (cause) {
      const waited =
        cause instanceof Error &&
        'code' in cause &&
        (cause.code === LOCK_TIMEOUT || cause.code === DEADLOCK);
      if (!waited || attempt === 50) throw cause;
    }
  }
};

const made = z.array(z.object({ id: z.uuid() }));

const proposed = async (ask: Ask, op: string, payload: object): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(
    await ask(
      `SELECT public.propose_change($1, $2::jsonb, ARRAY['doc_8f2a41']::text[], NULL, NULL) AS id`,
      [op, JSON.stringify(payload)],
    ),
  );
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('no act came back');
  return row.id;
};

const day = (value: string) => ({ observed_on: { v: value, src: ['doc_8f2a41'] } });

const keys = z.array(z.object({ id: z.uuid(), claim_key: z.string() }));

const held = async (ask: Ask): Promise<Map<string, string>> =>
  new Map(
    keys
      .parse(await ask('SELECT id, claim_key FROM public.proposals'))
      .map((row) => [row.id, row.claim_key] as const),
  );

const sts = (ask: Ask, src: string, dst: string, attrs?: object) =>
  proposed(ask, 'create_relation', {
    type: 'sts_with',
    src_id: src,
    dst_id: dst,
    ...(attrs === undefined ? {} : { attrs }),
  });

// A record in the state before 0089: two vessels, a transfer in each order, two dated transfers,
// one transfer with no day in each order, and a loads_at call that the rule must not move.
const oldRecord = async (ask: Ask) => {
  await ask(BEFORE_0089);
  const a = await proposed(ask, 'create_entity', { type: 'vessel', label: 'Nayara' });
  const b = await proposed(ask, 'create_entity', { type: 'vessel', label: 'Sikka Star' });
  const port = await proposed(ask, 'create_entity', { type: 'port', label: 'Sikka' });
  // The rule of 0089 orders the ends by their claim keys.
  const ends = await held(ask);
  const [low, high] = (ends.get(a) ?? '') < (ends.get(b) ?? '') ? [a, b] : [b, a];
  const first = await sts(ask, low, high, day('2026-05-19'));
  const second = await sts(ask, low, high, day('2026-06-02'));
  const reverse = await sts(ask, high, low, day('2026-05-19'));
  const undatedLow = await sts(ask, low, high);
  const undatedHigh = await sts(ask, high, low);
  const loads = await proposed(ask, 'create_relation', {
    type: 'loads_at',
    src_id: a,
    dst_id: port,
  });
  return { low, high, first, second, reverse, undatedLow, undatedHigh, loads };
};

const migrate = async (ask: Ask) => {
  await ask(await readFile(MIGRATION, 'utf8'));
  await ask('RESET ROLE');
};

test('two transfers on two days have two keys; the same day or the other order has one', async () => {
  const read = await alone(async (ask) => {
    const record = await oldRecord(ask);
    const before = await held(ask);
    await migrate(ask);
    const after = await held(ask);
    const fresh = async (src: string, dst: string, attrs?: object) =>
      sts(ask, src, dst, attrs).then(async (id) => (await held(ask)).get(id));
    return {
      record,
      before,
      after,
      sameDay: await fresh(record.low, record.high, day('2026-05-19')),
      reverseDay: await fresh(record.high, record.low, day('2026-05-19')),
      noDay: await fresh(record.low, record.high),
      noDayReverse: await fresh(record.high, record.low),
    };
  });
  const { record, before, after } = read;
  expect(after.get(record.first)).not.toBe(after.get(record.second));
  expect(after.get(record.first)).toBe(after.get(record.reverse));
  expect(after.get(record.undatedLow)).toBe(after.get(record.undatedHigh));
  // A new act gets the key that the migration wrote.
  expect(read.sameDay).toBe(after.get(record.first));
  expect(read.reverseDay).toBe(after.get(record.first));
  expect(read.noDay).toBe(after.get(record.undatedLow));
  expect(read.noDayReverse).toBe(after.get(record.undatedLow));
  // A transfer with no day in the low-to-high order and a loads_at call keep their key.
  expect(after.get(record.undatedLow)).toBe(before.get(record.undatedLow));
  expect(after.get(record.loads)).toBe(before.get(record.loads));
});

test('the migration moves the dated transfers and no other act of the record', async () => {
  const moved = await alone(async (ask) => {
    const record = await oldRecord(ask);
    const before = await held(ask);
    await migrate(ask);
    const after = await held(ask);
    const ids = [...before.keys()].filter((id) => after.get(id) !== before.get(id));
    return { record, ids };
  });
  expect(moved.ids).toContain(moved.record.first);
  expect(moved.ids).not.toContain(moved.record.loads);
  expect(moved.ids).not.toContain(moved.record.undatedLow);
});

test('the migration stops when the new rule would move the key of another relation', async () => {
  const run = alone(async (ask) => {
    const record = await oldRecord(ask);
    await ask('SET LOCAL ROLE gabriel_owner');
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask("UPDATE public.proposals SET claim_key = 'wrong' WHERE id = $1", [record.loads]);
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    await ask('RESET ROLE');
    await migrate(ask);
  });
  await expect(run).rejects.toThrow('not a sts_with relation');
});
