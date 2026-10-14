// Two writers at the same time. Each test opens two connections, and the second statement must wait
// for the first one: the test proves the wait with the lock list of the server, and not with a
// timer. These tests commit their rows, because a second connection sees only committed rows. Each
// test decides the acts that it leaves pending, so no pending unit stays in the database.

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { cited, label as newLabel } from './author-fixture.ts';
import { connectionString } from './db-runtime.ts';
import type { Ask } from './probe.ts';

type Identity = Parameters<typeof connectionString>[0];

interface Opened {
  readonly ask: Ask;
  readonly pid: number;
  readonly end: () => Promise<void>;
}

const opened = async (identity: Identity): Promise<Opened> => {
  const client = new Client({ connectionString: connectionString(identity) });
  await client.connect();
  const ask: Ask = async (text, values) =>
    (
      await client.query<Record<string, unknown>>(
        text,
        values === undefined ? undefined : [...values],
      )
    ).rows;
  const [row] = z
    .array(z.object({ pid: z.number() }))
    .parse(await ask('SELECT pg_backend_pid() AS pid'));
  if (row === undefined) throw new Error('the server gave no process number');
  return { ask, pid: row.pid, end: () => client.end() };
};

// External constraint: the roles stop a statement after 30 seconds, so a wait that never ends
// must show at once. Origin of the numbers: a lock appears in a few milliseconds.
const POLL_MS = 50;
const WAIT_DEADLINE_MS = 5_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const BLOCKED = 'SELECT $2::int = ANY (pg_blocking_pids($1::int)) AS yes';

const blockedBy = async (probe: Opened, waiter: Opened, holder: Opened): Promise<void> => {
  const deadline = Date.now() + WAIT_DEADLINE_MS;
  while (Date.now() < deadline) {
    const [row] = z
      .array(z.object({ yes: z.boolean() }))
      .parse(await probe.ask(BLOCKED, [waiter.pid, holder.pid]));
    if (row?.yes === true) return;
    await sleep(POLL_MS);
  }
  throw new Error('the second connection never waited');
};

/** The waiter starts its statement, the test proves that it waits for the holder, the holder
 * commits, and the answer of the waiter is the answer of this call. */
const afterCommitOf = async <T>(
  probe: Opened,
  holder: Opened,
  waiter: Opened,
  work: () => Promise<T>,
): Promise<T> => {
  const running = work();
  // The promise is awaited below. This handler keeps a refusal from being reported before.
  running.catch(() => undefined);
  try {
    await blockedBy(probe, waiter, holder);
  } catch (cause) {
    await holder.ask('ROLLBACK');
    await running.catch(() => undefined);
    throw cause;
  }
  await holder.ask('COMMIT');
  return running;
};

let probe: Opened;
let app: Opened;
let opens: Opened[] = [];

const open = async (identity: Identity): Promise<Opened> => {
  const one = await opened(identity);
  opens.push(one);
  return one;
};

beforeAll(async () => {
  probe = await open('superuser');
  app = await open('app');
});

afterAll(async () => {
  for (const one of opens) {
    await one.ask('ROLLBACK').catch(() => undefined);
    await one.end();
  }
  opens = [];
});

const made = z.array(z.object({ target_id: z.uuid(), proposal_id: z.uuid() }));

const SIGN = `SELECT * FROM public.sign_change('a test', $1, $2::jsonb, ARRAY['manual']::text[],
  NULL, NULL, $3::uuid[])`;

const signed = async (ask: Ask, op: string, payload: object, names: readonly string[] = []) => {
  const [row] = made.parse(await ask(SIGN, [op, JSON.stringify(payload), names]));
  if (row === undefined) throw new Error('the act was not signed');
  return row.target_id;
};

const entityOf = (type: string, label: string) =>
  signed(app.ask, 'create_entity', { type, label, sources: ['manual'] });

/** The operator decides each pending unit that the test left. */
const tidy = async (acts: readonly string[], labels: readonly string[]): Promise<void> => {
  const units = z.array(z.object({ unit_id: z.uuid() })).parse(
    await probe.ask(
      `SELECT DISTINCT unit_id FROM public.proposals
        WHERE status = 'pending' AND (id = ANY($1::uuid[]) OR payload->>'label' = ANY($2::text[]))`,
      [acts, labels],
    ),
  );
  for (const { unit_id } of units)
    await app.ask(`SELECT public.reject_unit($1, 'other', 'a test note', 'a test')`, [unit_id]);
};

const statusOf = async (act: string) =>
  z
    .array(z.object({ status: z.string(), decided_as: z.string().nullable() }))
    .parse(
      await probe.ask('SELECT status, decided_as FROM public.proposals WHERE id = $1', [act]),
    )[0];

const unitOf = async (act: string): Promise<string> => {
  const [row] = z
    .array(z.object({ unit_id: z.uuid() }))
    .parse(await probe.ask('SELECT unit_id FROM public.proposals WHERE id = $1', [act]));
  if (row === undefined) throw new Error('the act is not in the queue');
  return row.unit_id;
};

test('two promotions of one unit: the second waits, and the unit is decided once', async () => {
  const label = newLabel();
  const [made1] = z
    .array(z.object({ id: z.uuid() }))
    .parse(
      await app.ask(
        `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
        [JSON.stringify({ type: 'military_unit', label, sources: ['manual'] })],
      ),
    );
  if (made1 === undefined) throw new Error('the act was not proposed');
  const row = { id: made1.id, unit_id: await unitOf(made1.id) };
  const second = await open('app');
  try {
    await app.ask('BEGIN');
    await app.ask(`SELECT public.promote_unit($1, 'a test')`, [row.unit_id]);
    await expect(
      afterCommitOf(probe, app, second, () =>
        second.ask(`SELECT public.promote_unit($1, 'a test')`, [row.unit_id]),
      ),
    ).rejects.toMatchObject({ constraint: 'unit_pending' });
    const entities = z
      .array(z.object({ n: z.coerce.number() }))
      .parse(
        await probe.ask('SELECT count(*) AS n FROM public.entities WHERE label = $1', [label]),
      );
    expect(entities[0]?.n).toBe(1);
  } finally {
    await app.ask('ROLLBACK');
    await tidy([row.id], [label]);
  }
});

test('a decision of the operator while a machine writes: the write stays, the decision stands', async () => {
  const label = newLabel();
  const machine = await open('superuser');
  const writer = await open('superuser');
  await writer.ask('BEGIN');
  const first = await cited(writer.ask, { author: `Author ${randomUUID()}`, label });
  await writer.ask('COMMIT');
  try {
    await app.ask('BEGIN');
    await app.ask(`SELECT public.reject_unit($1, 'other', 'a test note', 'a test')`, [
      await unitOf(first.act),
    ]);
    await machine.ask('BEGIN');
    // A second act with the same claim sends the first unit through the rules again, and that
    // unit is locked by the decision of the operator.
    const second = await afterCommitOf(probe, app, machine, () =>
      cited(machine.ask, { author: `Author ${randomUUID()}`, label }),
    );
    await machine.ask('COMMIT');
    expect(await statusOf(second.act)).toMatchObject({ status: 'pending' });
    expect(await statusOf(first.act)).toMatchObject({ status: 'rejected', decided_as: 'unit' });
    await tidy([second.act], [label]);
  } finally {
    await app.ask('ROLLBACK');
    await machine.ask('ROLLBACK');
    await tidy([first.act], [label]);
  }
});

test('a merge while a batch names the absorbed entity: the merge waits, and then it refuses', async () => {
  const kept = await entityOf('military_unit', newLabel());
  const absorbed = await entityOf('military_unit', newLabel());
  const doc = `doc_${randomUUID().slice(0, 8)}`;
  const text = 'The unit of the concurrency test holds twelve men.';
  await probe.ask(
    `SELECT public.put_document($1, 'file', $2, $3, NULL, NULL, NULL, 'text/plain',
       '2026-10-07'::date)`,
    [doc, `Source ${doc}`, `raw/${doc}.txt`],
  );
  await probe.ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    doc,
    JSON.stringify([text]),
    'concurrency-test@1',
  ]);
  const item = {
    id: randomUUID(),
    op: 'update_attrs',
    target_kind: 'entity',
    target_id: absorbed,
    payload: { attrs: { strength: { v: '12', src: [doc] } } },
    src: [doc],
    names: [],
    model_call_id: null,
    originator: `Author ${randomUUID()}`,
    modality: 'asserts',
    citations: [
      { document: doc, text_extractor: 'concurrency-test@1', page: 1, start: 0, end: text.length },
    ],
  };
  let act: string | null = null;
  const batch = await open('research');
  const merging = await open('app');
  try {
    await batch.ask('BEGIN');
    const [written] = z
      .array(z.object({ proposal_id: z.uuid() }))
      .parse(
        await batch.ask('SELECT proposal_id FROM public.propose_batch($1::jsonb)', [
          JSON.stringify([item]),
        ]),
      );
    act = written?.proposal_id ?? null;
    await expect(
      afterCommitOf(probe, batch, merging, () =>
        merging.ask(`SELECT * FROM public.merge_entities('a test', $1, $2, false)`, [
          kept,
          absorbed,
        ]),
      ),
    ).rejects.toMatchObject({ constraint: 'merge_absorbed_free' });
    const alive = z
      .array(z.object({ n: z.coerce.number() }))
      .parse(
        await probe.ask('SELECT count(*) AS n FROM public.entities WHERE id = $1', [absorbed]),
      );
    expect(alive[0]?.n).toBe(1);
  } finally {
    await batch.ask('ROLLBACK');
    await tidy(act === null ? [] : [act], []);
  }
});

test('two openings of one relation: the second waits, and then it refuses', async () => {
  const owner = await entityOf('company', newLabel());
  const vessel = await entityOf('vessel', newLabel());
  const open1 = (ask: Ask) =>
    ask(SIGN, [
      'create_relation',
      JSON.stringify({
        type: 'owns',
        src_id: owner,
        dst_id: vessel,
        sources: ['manual'],
        valid_from: '2019-05-02',
      }),
      [owner, vessel],
    ]);
  const second = await open('app');
  try {
    await app.ask('BEGIN');
    await open1(app.ask);
    await expect(afterCommitOf(probe, app, second, () => open1(second.ask))).rejects.toMatchObject({
      constraint: 'relations_one_open_per_type',
    });
    const held = z
      .array(z.object({ n: z.coerce.number() }))
      .parse(
        await probe.ask(
          'SELECT count(*) AS n FROM public.relations WHERE src_id = $1 AND dst_id = $2',
          [owner, vessel],
        ),
      );
    expect(held[0]?.n).toBe(1);
  } finally {
    await app.ask('ROLLBACK');
    await second.ask('ROLLBACK');
  }
});
