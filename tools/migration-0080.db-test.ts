// Migration 0080 puts the day of a port call into its claim key. The case puts the test database
// back in the state before 0080, inside a transaction that always rolls back, and runs the file.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const MIGRATION = join(import.meta.dirname, '..', 'db', 'migrations', '0080_port_call_day_key.sql');

// The rule of 0056: the key of a relation holds its type and its two ends.
const BEFORE_0080 = `
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
      ELSE
        jsonb_build_array(p_op, p_target_kind, public.claim_end_key(p_target_id::text),
                          coalesce((SELECT jsonb_object_agg(a.key, a.value->'v')
                                      FROM jsonb_each(p_payload->'attrs') AS a),
                                   '{}'::jsonb),
                          p_payload - 'attrs' - 'sources')
    END::text)
  $$;
  RESET ROLE`;

// Departure: the files of this project run at the same time, and the migration changes a table
// that they write. The test takes every lock it needs first, with a short wait, so it never holds
// one lock while it waits for another: the door of a proposal writes proposals and reads
// documents. A wait that ends, or a deadlock, runs the case again.
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

const proposed = async (
  ask: Ask,
  op: string,
  payload: object,
  target: readonly [string, string] | null = null,
): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(
    await ask(
      `SELECT public.propose_change($1, $2::jsonb, ARRAY['doc_8f2a41']::text[], $3, $4::uuid) AS id`,
      [op, JSON.stringify(payload), target?.[0] ?? null, target?.[1] ?? null],
    ),
  );
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('no act came back');
  return row.id;
};

const day = (value: string) => ({ observed_on: { v: value, src: ['doc_8f2a41'] } });

const faultsOf = async (ask: Ask, act: string): Promise<string[]> => {
  const [row] = z
    .array(z.object({ unit_id: z.uuid() }))
    .parse(await ask('SELECT unit_id FROM public.proposals WHERE id = $1', [act]));
  const found = z
    .array(z.object({ faults: z.array(z.object({ kind: z.string() })) }))
    .parse(await ask('SELECT faults FROM public.unit_faults($1::uuid[])', [[row?.unit_id]]));
  return found.flatMap((one) => one.faults.map((fault) => fault.kind));
};

const keys = z.array(z.object({ id: z.uuid(), claim_key: z.string() }));

const held = async (ask: Ask): Promise<Map<string, string>> =>
  new Map(
    keys
      .parse(await ask('SELECT id, claim_key FROM public.proposals'))
      .map((row) => [row.id, row.claim_key] as const),
  );

// A record in the state before 0080: two ends, two dated calls at one pair, one call with no day,
// a flagged_falsely act with a day, a dated call that the operator rejected, an update of a dated
// call (level 1), a relation on a dated call (level 1), and an update of that relation (level 2).
const oldRecord = async (ask: Ask) => {
  await ask(BEFORE_0080);
  const vessel = await proposed(ask, 'create_entity', { type: 'vessel', label: 'Nayara' });
  const port = await proposed(ask, 'create_entity', { type: 'port', label: 'Sikka' });
  const call = (type: string, attrs?: object) =>
    proposed(ask, 'create_relation', {
      type,
      src_id: vessel,
      dst_id: port,
      ...(attrs === undefined ? {} : { attrs }),
    });
  const first = await call('loads_at', day('2026-05-19'));
  const second = await call('loads_at', day('2026-06-02'));
  const undated = await call('loads_at');
  const flagged = await call('flagged_falsely', day('2026-05-19'));
  const rejected = await call('loads_at', day('2026-07-07'));
  await ask("SELECT public.reject_relation($1::uuid, 'wrong_value', NULL, 'a test')", [rejected]);
  const update = await proposed(
    ask,
    'update_attrs',
    { attrs: { note: { v: 'one', src: ['doc_8f2a41'] } } },
    ['relation', first],
  );
  const onCall = await proposed(ask, 'create_relation', {
    type: 'restricted_by',
    src_kind: 'relation',
    src_id: first,
    dst_id: port,
  });
  const onRelation = await proposed(
    ask,
    'update_attrs',
    { attrs: { note: { v: 'two', src: ['doc_8f2a41'] } } },
    ['relation', onCall],
  );
  return {
    vessel,
    port,
    first,
    second,
    undated,
    flagged,
    rejected,
    update,
    onCall,
    onRelation,
  };
};

test('the migration moves the dated port calls and the acts that name them, and no other act', async () => {
  const read = await alone(async (ask) => {
    const record = await oldRecord(ask);
    // The fixture holds dated calls too, with keys of the new rule, so the count is of this record.
    const [dated] = z.array(z.object({ n: z.coerce.number() })).parse(
      await ask(
        `SELECT count(*) AS n FROM public.proposals
          WHERE op = 'create_relation' AND payload->>'src_id' = $1
            AND payload->>'type' IN ('berthed_at', 'loads_at', 'discharges_at')
            AND payload #> '{attrs,observed_on,v}' IS NOT NULL`,
        [record.vessel],
      ),
    );
    const before = await held(ask);
    await ask(await readFile(MIGRATION, 'utf8'));
    await ask('RESET ROLE');
    const after = await held(ask);
    // A fresh proposal of the first claim gets the key that the migration wrote.
    const again = await proposed(ask, 'create_relation', {
      type: 'loads_at',
      src_id: record.vessel,
      dst_id: record.port,
      attrs: day('2026-05-19'),
    });
    // The rejection of a dated call reaches the same call and no other day of it.
    const proposedOn = (value: string) =>
      proposed(ask, 'create_relation', {
        type: 'loads_at',
        src_id: record.vessel,
        dst_id: record.port,
        attrs: day(value),
      });
    const sameDay = await proposedOn('2026-07-07');
    const otherDay = await proposedOn('2026-05-19');
    const fresh = z.array(z.object({ id: z.uuid(), key: z.string() })).parse(
      await ask(
        `SELECT id, public.claim_key_of(op, target_kind, target_id, payload) AS key
             FROM public.proposals WHERE id = ANY ($1::uuid[])`,
        [[record.update, record.onCall, record.onRelation]],
      ),
    );
    return {
      record,
      dated: dated?.n,
      before,
      after,
      again: (await held(ask)).get(again),
      fresh: new Map(fresh.map((row) => [row.id, row.key] as const)),
      sameDay: await faultsOf(ask, sameDay),
      otherDay: await faultsOf(ask, otherDay),
    };
  });
  const { record, before, after } = read;
  expect(read.dated).toBe(3);
  const changed = [...after.keys()].filter((id) => after.get(id) !== before.get(id));
  expect(new Set(changed)).toStrictEqual(
    new Set([
      record.first,
      record.second,
      record.rejected,
      record.update,
      record.onCall,
      record.onRelation,
    ]),
  );
  expect(after.get(record.first)).not.toBe(after.get(record.second));
  expect(read.again).toBe(after.get(record.first));
  // Level after level: the relation on a dated call and the update of that relation follow it.
  for (const id of [record.update, record.onCall, record.onRelation])
    expect(after.get(id)).toBe(read.fresh.get(id));
  expect(read.sameDay).toContain('rejected_before');
  expect(read.otherDay).not.toContain('rejected_before');
});

test('the migration stops when the new rule would move the key of another relation', async () => {
  const run = alone(async (ask) => {
    const record = await oldRecord(ask);
    await ask('SET LOCAL ROLE gabriel_owner');
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask("UPDATE public.proposals SET claim_key = 'wrong' WHERE id = $1", [record.undated]);
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    await ask('RESET ROLE');
    await ask(await readFile(MIGRATION, 'utf8'));
  });
  await expect(run).rejects.toThrow('moves the key of a relation with no day of a port call');
});
