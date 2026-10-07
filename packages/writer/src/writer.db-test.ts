import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';

const pool = openPool();
// An act door never reaches the raw store, so this one refuses every object.
const NO_STORE = { put: () => Promise.reject(new Error('no act door reaches the raw store')) };
const app = writeRoutes(pool, NO_STORE);

interface Held {
  readonly entities: number;
  readonly relations: number;
}

const LIVE_COUNTS =
  'SELECT (SELECT count(*) FROM public.entities) AS entities,' +
  ' (SELECT count(*) FROM public.relations) AS relations';

const liveCounts = async (): Promise<Held> => {
  const held = await one(LIVE_COUNTS, []);
  return { entities: Number(held['entities']), relations: Number(held['relations']) };
};

// Every gesture below undoes itself, so the record ends where it began, whatever was loaded into
// it. The accepted proposals stay: the ledger is append-only, and a trigger refuses a delete.
let began: Held | null = null;

beforeAll(async () => {
  began = await liveCounts();
});

afterAll(async () => {
  const left = await liveCounts();
  await pool.end();
  expect(left).toStrictEqual(began);
});

const replyShape = z.object({
  proposalId: z.string().optional(),
  targetId: z.string().nullable().optional(),
  state: z.string().optional(),
  refusal: z.string().optional(),
});

type Reply = z.infer<typeof replyShape>;

const post = async (door: string, body: unknown): Promise<[number, Reply]> => {
  const answer = await app.request(`/write/${door}`, {
    method: 'POST',
    headers: { host: '127.0.0.1:5177', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return [answer.status, replyShape.parse(await answer.json())];
};

const one = async (text: string, values: readonly unknown[]): Promise<Record<string, unknown>> => {
  const found = await pool.query<Record<string, unknown>>(text, [...values]);
  return found.rows[0] ?? {};
};

// Scoped to one target. A global count says the total did not move, which stays true when the
// act under test writes a row and another act removes one.
const proposalsFor = async (targetId: string): Promise<number> =>
  Number(
    (
      await one('SELECT count(*) AS n FROM public.proposals WHERE target_id = $1::uuid', [targetId])
    )['n'],
  );

const DECIDED =
  'SELECT status, author_role, prior_value, dissent FROM public.proposals WHERE id = $1::uuid';

const decided = async (proposalId: string | undefined): Promise<Record<string, unknown>> =>
  one(DECIDED, [proposalId]);

const OPERATOR_ACT = {
  status: 'accepted',
  author_role: 'gabriel_app',
  dissent: false,
} as const;

const signedEntity = async (label: string): Promise<string> => {
  const [status, reply] = await post('create-entity', { type: 'vessel', label });
  expect(status).toBe(200);
  return reply.targetId ?? '';
};

const LIVE_ROWS =
  'SELECT (SELECT count(*) FROM public.entities WHERE id = $1::uuid)' +
  ' + (SELECT count(*) FROM public.relations WHERE id = $1::uuid) AS n';

const liveRows = async (targetId: string): Promise<number> =>
  Number((await one(LIVE_ROWS, [targetId]))['n']);

// Cleanup runs in a `finally`, so a failed assertion leaves no row. The end state is read and
// never assumed: a delete that a live relation blocks answers 409, and the row would stay.
const removed = async (...targets: readonly (string | null | undefined)[]): Promise<void> => {
  for (const targetId of targets)
    if (targetId !== undefined && targetId !== null && targetId !== '') {
      await post('delete-relation', { targetId });
      await post('delete-entity', { targetId });
      expect({ targetId, live: await liveRows(targetId) }).toStrictEqual({ targetId, live: 0 });
    }
};

test('propose and promote inside one transaction is refused', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const made = await client.query<Record<string, unknown>>(
      `SELECT public.propose_change('create_entity',
         '{"type":"vessel","label":"One transaction"}'::jsonb,
         ARRAY['manual']::text[]) AS id`,
    );
    const id = made.rows[0]?.['id'];
    await expect(
      client.query('SELECT public.promote_proposal($1::uuid, $2::text)', [id, 'a test']),
    ).rejects.toMatchObject({ code: '42501' });
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
});

// The database stamps each hour from the start of the transaction, so an act proposed and
// promoted in one transaction carries one hour twice.
test('an operator edit is proposed and promoted in one transaction', async () => {
  const target = await signedEntity('Writer test one transaction');
  try {
    const held = await one(
      'SELECT p.created_at = p.decided_at AS one_act FROM public.proposals p' +
        ' JOIN public.entities e ON e.promoted_from = p.id WHERE e.id = $1::uuid',
      [target],
    );
    expect(held['one_act']).toBe(true);
  } finally {
    await removed(target);
  }
});

const STORED_CREATION =
  'SELECT public.ST_AsGeoJSON(geom)::jsonb AS shape, public.ST_SRID(geom) AS srid,' +
  ' public.ST_AsText(geom) AS wkt,' +
  ' attrs, sources::text[] AS sources FROM public.entities WHERE id = $1::uuid';

test('the five gestures reach the evidentiary layer', async () => {
  const [entityStatus, entityReply] = await post('create-entity', {
    type: 'facility',
    label: 'Writer test quay',
    geom: { type: 'Point', coordinates: [4.05, 51.95] },
    attrs: { berth_count: { v: 2 } },
  });

  let other = '';
  let relationId: string | null | undefined;
  try {
    expect(entityStatus).toBe(200);
    expect(entityReply.state).toBe('signed');

    const madeBy = await one('SELECT promoted_from FROM public.entities WHERE id = $1::uuid', [
      entityReply.targetId,
    ]);
    expect(madeBy['promoted_from']).toBe(entityReply.proposalId);
    expect(await decided(entityReply.proposalId)).toMatchObject(OPERATOR_ACT);
    expect(await one(STORED_CREATION, [entityReply.targetId])).toStrictEqual({
      shape: { type: 'Point', coordinates: [4.05, 51.95] },
      srid: 4326,
      wkt: 'POINT(4.05 51.95)',
      attrs: { berth_count: { v: 2, src: ['manual'] } },
      sources: ['manual'],
    });

    other = await signedEntity('Writer test vessel');

    const [relationStatus, relationReply] = await post('create-relation', {
      type: 'operates',
      srcId: other,
      dstId: entityReply.targetId,
      validFrom: '2026-01-01',
    });
    relationId = relationReply.targetId;
    expect(relationStatus).toBe(200);

    const named = await one(
      'SELECT type, src_id, dst_id, valid_from::text AS valid_from, promoted_from,' +
        ' (SELECT names FROM public.proposals p WHERE p.id = r.promoted_from) AS names' +
        ' FROM public.relations r WHERE r.id = $1::uuid',
      [relationReply.targetId],
    );
    expect(named['promoted_from']).toBe(relationReply.proposalId);
    expect(named['names']).toStrictEqual([other, entityReply.targetId]);

    // The two ends and the interval, read back from the row. A swap of the ends and a dropped
    // interval both leave the reply of the door unchanged.
    expect({
      type: named['type'],
      src_id: named['src_id'],
      dst_id: named['dst_id'],
      valid_from: named['valid_from'],
    }).toStrictEqual({
      type: 'operates',
      src_id: other,
      dst_id: entityReply.targetId,
      valid_from: '2026-01-01',
    });
    expect(await decided(relationReply.proposalId)).toMatchObject(OPERATOR_ACT);

    const [updateStatus, updateReply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: entityReply.targetId,
      attrs: { berth_count: { v: 4 } },
    });
    expect(updateStatus).toBe(200);
    expect(updateReply.targetId).toBe(entityReply.targetId);
    expect(await decided(updateReply.proposalId)).toMatchObject(OPERATOR_ACT);
    const held = await one('SELECT attrs FROM public.entities WHERE id = $1::uuid', [
      entityReply.targetId,
    ]);
    expect(held['attrs']).toMatchObject({ berth_count: { v: 4, src: ['manual'] } });

    const [relationGone, relationGoneReply] = await post('delete-relation', {
      targetId: relationReply.targetId,
    });
    expect(relationGone).toBe(200);
    expect(await decided(relationGoneReply.proposalId)).toMatchObject(OPERATOR_ACT);
    expect(await liveRows(relationId ?? '')).toBe(0);

    const [entityGone, entityGoneReply] = await post('delete-entity', {
      targetId: entityReply.targetId,
    });
    expect(entityGone).toBe(200);
    expect(await decided(entityGoneReply.proposalId)).toMatchObject(OPERATOR_ACT);
    expect(await liveRows(entityReply.targetId ?? '')).toBe(0);
  } finally {
    await removed(relationId, other, entityReply.targetId);
  }
});

// The writer never composes a citation, so the key that already cites a document is written
// through the same two doors, by hand, before the gesture under test runs.
const citedEntity = async (label: string): Promise<string> => {
  const target = await signedEntity(label);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const made = await client.query<Record<string, unknown>>(
      `SELECT public.propose_change('update_attrs',
         '{"attrs":{"coal_stock_t":{"v":41200,"src":["doc_8f2a41"]}}}'::jsonb,
         ARRAY['doc_8f2a41']::text[], 'entity', $1::uuid) AS id`,
      [target],
    );
    await client.query('COMMIT');
    await client.query('BEGIN');
    await client.query('SELECT public.promote_proposal($1::uuid, $2::text)', [
      made.rows[0]?.['id'],
      'a test',
    ]);
    await client.query('COMMIT');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
  return target;
};

// The writer keeps a refused act pending. Left in the ledger, it moves the pending count that
// the corpus, contract and service tests read on the next run.
const settled = async (target: string): Promise<void> => {
  const waiting = await pool.query<{ id: string }>(
    "SELECT id FROM public.proposals WHERE target_id = $1::uuid AND status = 'pending'",
    [target],
  );
  for (const { id } of waiting.rows)
    await one('SELECT public.reject_proposal($1::uuid, $2::text)', [id, 'a test']);
};

const HELD_CLAIM = { coal_stock_t: { v: 41200, src: ['doc_8f2a41'] } };

const heldAttributes = async (target: string): Promise<unknown> =>
  (await one('SELECT attrs FROM public.entities WHERE id = $1::uuid', [target]))['attrs'];

test('a corrected value cites the operator alone, and the prior value keeps the old claim', async () => {
  const target = await citedEntity('Writer test corrected value');
  try {
    const [status, reply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: { coal_stock_t: { v: 43500 } },
    });
    expect(status).toBe(200);
    expect(await heldAttributes(target)).toStrictEqual({
      coal_stock_t: { v: 43500, src: ['manual'] },
    });
    expect((await decided(reply.proposalId))['prior_value']).toStrictEqual(HELD_CLAIM);
  } finally {
    await settled(target);
    await removed(target);
  }
});

test('an update that keeps the value re-cites the document the key already holds', async () => {
  const target = await citedEntity('Writer test kept value');
  try {
    const [status] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: { coal_stock_t: { v: 41200 } },
    });
    expect(status).toBe(200);
    expect(await heldAttributes(target)).toStrictEqual({
      coal_stock_t: { v: 41200, src: ['doc_8f2a41', 'manual'] },
    });
  } finally {
    await settled(target);
    await removed(target);
  }
});

// A machine act that keeps a value names its own documents alone. The promotion keeps each
// document that the value already cites, and a second spelling of one number is the same value.
test.for(['41200', '41200.0'])(
  'a kept value %s keeps each document it already cites, and adds the new one',
  async (spelling) => {
    const target = await citedEntity(`Writer test kept document ${spelling}`);
    try {
      const made = await one(
        `SELECT public.propose_change('update_attrs',
           jsonb_build_object('attrs', jsonb_build_object('coal_stock_t', jsonb_build_object(
             'v', $2::numeric, 'src', jsonb_build_array('doc_3c1104')))),
           ARRAY['doc_3c1104']::text[], 'entity', $1::uuid) AS id`,
        [target, spelling],
      );
      await one('SELECT public.promote_proposal($1::uuid, $2::text)', [made['id'], 'a test']);
      expect(await heldAttributes(target)).toStrictEqual({
        coal_stock_t: { v: Number(spelling), src: ['doc_8f2a41', 'doc_3c1104'] },
      });
    } finally {
      await removed(target);
    }
  },
);

test('a delete of an endpoint is refused and writes no proposal', async () => {
  const source = await signedEntity('Writer test endpoint source');
  const target = await signedEntity('Writer test endpoint target');
  let relationId: string | null | undefined;
  try {
    const [, relation] = await post('create-relation', {
      type: 'berthed_at',
      srcId: source,
      dstId: target,
    });
    relationId = relation.targetId;

    const before = await proposalsFor(target);
    const [status, reply] = await post('delete-entity', { targetId: target });
    expect(status).toBe(422);
    expect(reply.refusal).toBe(
      'targetId: the entity is an endpoint of 1 relation, and it is not deleted. Delete each of' +
        ' those relations first, and then delete the entity again',
    );
    expect(await proposalsFor(target)).toBe(before);
  } finally {
    await removed(relationId, source, target);
  }
});

// An update that names no attribute applied nothing, committed as accepted, and still moved the
// target's `updated_at`. The door refuses it now, so it never reaches the queue.
test('an update that names no attribute is refused and writes no proposal', async () => {
  const target = await signedEntity('Writer test empty update');
  try {
    const before = await proposalsFor(target);
    const [status, reply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: {},
    });
    expect(status).toBe(422);
    // The record names the field before its own sentence.
    expect(reply.refusal).toBe('attrs: an update names at least one attribute');
    expect(await proposalsFor(target)).toBe(before);
  } finally {
    await removed(target);
  }
});

// THE KEY HAS A SHAPE, AND THE SHAPE IS NOT A VOCABULARY. M11 stands: the record holds no list
// of permitted words, and it states the shape of a key in its refusal.
test('a key the record refuses is named in the sentence of the record', async () => {
  const target = await signedEntity('Writer test minted key');
  try {
    const before = await proposalsFor(target);
    const [status, reply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: { 'Coal Stock': { v: 41.5 } },
    });
    expect(status).toBe(422);
    expect(reply.refusal).toContain('attrs: each attribute key is lower case words');
    expect(await proposalsFor(target)).toBe(before);

    // The sentence of the key never answers a body whose `attrs` is not a record at all.
    const [wrongShape, wrongReply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: 'coal_stock_t',
    });
    expect(wrongShape).toBe(422);
    expect(wrongReply.refusal).toBe('attrs: Invalid input: expected record, received string');

    const [minted] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: { coal_stock_t: { v: 41.5 } },
    });
    expect(minted).toBe(200);
    expect(await proposalsFor(target)).toBe(before + 1);
  } finally {
    await removed(target);
  }
});

// Departure: an IMO number is usually a string of seven digits. M11 puts no rule on a value
// beyond its shape, so the door writes the number as it was given and the database takes it.
test('a value of a kind that its key does not usually carry is written', async () => {
  const target = await signedEntity('Writer test free kind');
  try {
    const before = await proposalsFor(target);
    const [status] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: { imo: { v: 9482137 } },
    });
    expect(status).toBe(200);
    expect(await proposalsFor(target)).toBe(before + 1);
  } finally {
    await removed(target);
  }
});

// `sources` is `doc_id[]`, a domain over `text[]`. node-postgres parses only the built-in array
// OIDs, so a domain array comes back as its literal, `{manual}`, unless it is cast down here.
const COLUMNS_OF =
  'SELECT label, type, proposed_type, sources::text[] AS sources FROM public.entities WHERE id = $1::uuid';

const NO_ENTITY = '5b7e2c90-1d4a-4e36-9f08-2a6c3d8e1f47';

const UNCHANGED =
  'the act changes neither the name nor the type of the entity, and nothing was applied';

const absent = (end: 'source' | 'target', id: string): string =>
  end === 'source'
    ? `srcId: the source ${id} does not exist`
    : `targetId: the target ${id} does not exist, and nothing was applied`;

test('the name and the type change by one act, and a word with no type waits as unknown', async () => {
  const [, made] = await post('create-entity', { type: 'tanker', label: 'Writer test retype' });
  const target = made.targetId ?? '';
  try {
    expect(await one(COLUMNS_OF, [target])).toMatchObject({
      type: 'unknown',
      proposed_type: 'tanker',
    });

    const [status, reply] = await post('update-entity', {
      targetId: target,
      label: 'Writer test retyped',
      type: 'vessel',
    });
    expect([status, reply.state, reply.targetId]).toStrictEqual([200, 'signed', target]);
    expect(await one(COLUMNS_OF, [target])).toStrictEqual({
      label: 'Writer test retyped',
      type: 'vessel',
      proposed_type: null,
      sources: ['manual'],
    });
    expect((await decided(reply.proposalId))['prior_value']).toStrictEqual({
      label: 'Writer test retype',
      type: 'unknown',
      proposed_type: 'tanker',
      sources: ['manual'],
    });

    const [back] = await post('update-entity', { targetId: target, type: 'shipyard' });
    expect(back).toBe(200);
    expect(await one(COLUMNS_OF, [target])).toMatchObject({
      type: 'unknown',
      proposed_type: 'shipyard',
    });
  } finally {
    await removed(target);
  }
});

// A row made by the writer cites `manual`, and so does the rename. The row is made here from a
// document, so the list after the act differs from the list before it.
test('a rename replaces the list of the row, and the prior value keeps the old list', async () => {
  const made = await one(
    `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['doc_8f2a41']::text[]) AS id`,
    [JSON.stringify({ type: 'vessel', label: 'Writer test cited rename' })],
  );
  const promoted = await one('SELECT public.promote_proposal($1::uuid, $2::text) AS id', [
    made['id'],
    'a test',
  ]);
  const target = String(promoted['id']);
  try {
    expect((await one(COLUMNS_OF, [target]))['sources']).toStrictEqual(['doc_8f2a41']);

    const [status, reply] = await post('update-entity', {
      targetId: target,
      label: 'Writer test cited renamed',
    });
    expect(status).toBe(200);
    expect((await one(COLUMNS_OF, [target]))['sources']).toStrictEqual(['manual']);
    expect((await decided(reply.proposalId))['prior_value']).toStrictEqual({
      label: 'Writer test cited rename',
      sources: ['doc_8f2a41'],
    });
  } finally {
    await removed(target);
  }
});

test('an act that changes neither the name nor the type is refused and writes nothing', async () => {
  const target = await signedEntity('Writer test same name');
  try {
    const before = await proposalsFor(target);
    const [status, reply] = await post('update-entity', {
      targetId: target,
      label: 'Writer test same name',
      type: 'vessel',
    });
    expect(status).toBe(422);
    expect(reply.refusal).toBe(UNCHANGED);
    expect(await proposalsFor(target)).toBe(before);

    const [gone, goneReply] = await post('update-entity', {
      targetId: NO_ENTITY,
      label: 'Nobody',
    });
    expect([gone, goneReply.refusal]).toStrictEqual([422, absent('target', NO_ENTITY)]);
  } finally {
    await removed(target);
  }
});

test('a word that waits as unknown, sent again or kept by a rename to the same name, is refused', async () => {
  const [, made] = await post('create-entity', { type: 'tanker', label: 'Writer test same word' });
  const target = made.targetId ?? '';
  try {
    const held = await one(COLUMNS_OF, [target]);
    expect(held).toMatchObject({ type: 'unknown', proposed_type: 'tanker' });
    const before = await proposalsFor(target);

    const [again, againReply] = await post('update-entity', { targetId: target, type: 'tanker' });
    const [kept, keptReply] = await post('update-entity', {
      targetId: target,
      label: 'Writer test same word',
    });
    expect([
      [again, againReply.refusal],
      [kept, keptReply.refusal],
    ]).toStrictEqual([
      [422, UNCHANGED],
      [422, UNCHANGED],
    ]);
    expect(await proposalsFor(target)).toBe(before);
    expect(await one(COLUMNS_OF, [target])).toStrictEqual(held);
  } finally {
    await settled(target);
    await removed(target);
  }
});

// A new relation names its two ends and no target, so its proposals are found by the names.
const proposalsNaming = async (id: string): Promise<number> =>
  Number(
    (
      await one(
        'SELECT count(*) AS n FROM public.proposals WHERE target_id = $1::uuid OR $1::uuid = ANY(names)',
        [id],
      )
    )['n'],
  );

test('an act on an element that does not exist is refused and writes no proposal', async () => {
  const live = await signedEntity('Writer test absent end');
  try {
    const before = await proposalsNaming(NO_ENTITY);
    const beforeLive = await proposalsNaming(live);
    const acts: readonly (readonly [string, Record<string, unknown>])[] = [
      ['create-relation', { type: 'berthed_at', srcId: NO_ENTITY, dstId: live }],
      ['create-relation', { type: 'berthed_at', srcId: live, dstId: NO_ENTITY }],
      ['update-attrs', { targetKind: 'entity', targetId: NO_ENTITY, attrs: { imo: { v: 1 } } }],
      ['update-attrs', { targetKind: 'relation', targetId: NO_ENTITY, attrs: { imo: { v: 1 } } }],
      ['delete-relation', { targetId: NO_ENTITY }],
      ['delete-entity', { targetId: NO_ENTITY }],
    ];
    const answers = [];
    for (const [door, body] of acts) {
      const [status, reply] = await post(door, body);
      answers.push([door, status, reply.refusal]);
    }
    expect(answers).toStrictEqual([
      ['create-relation', 422, absent('source', NO_ENTITY)],
      ['create-relation', 422, `dstId: the target ${NO_ENTITY} does not exist`],
      ['update-attrs', 422, absent('target', NO_ENTITY)],
      ['update-attrs', 422, absent('target', NO_ENTITY)],
      ['delete-relation', 422, absent('target', NO_ENTITY)],
      ['delete-entity', 422, absent('target', NO_ENTITY)],
    ]);
    expect(await proposalsNaming(NO_ENTITY)).toBe(before);
    expect(await proposalsNaming(live)).toBe(beforeLive);
  } finally {
    await removed(live);
  }
});

test('a relation that is an end of another relation is refused its delete', async () => {
  const source = await signedEntity('Writer test relation end source');
  const target = await signedEntity('Writer test relation end target');
  let inner: string | null | undefined;
  let outer: string | null | undefined;
  try {
    const [, made] = await post('create-relation', {
      type: 'berthed_at',
      srcId: source,
      dstId: target,
    });
    inner = made.targetId;
    const [status, reply] = await post('create-relation', {
      type: 'berthed_at',
      srcKind: 'relation',
      srcId: inner,
      dstId: target,
    });
    outer = reply.targetId;
    expect(status).toBe(200);
    expect(
      await one('SELECT src_kind, src_id FROM public.relations WHERE id = $1::uuid', [outer]),
    ).toStrictEqual({ src_kind: 'relation', src_id: inner });

    const [updated] = await post('update-attrs', {
      targetKind: 'relation',
      targetId: inner,
      attrs: { berth_count: { v: 1 } },
    });
    expect(updated).toBe(200);

    const before = await proposalsFor(inner ?? '');
    const [refused, refusal] = await post('delete-relation', { targetId: inner });
    expect([refused, refusal.refusal]).toStrictEqual([
      422,
      'targetId: the relation is an endpoint of 1 relation, and it is not deleted. Delete each' +
        ' of those relations first, and then delete this relation again',
    ]);
    expect(await proposalsFor(inner ?? '')).toBe(before);
    expect(await liveRows(inner ?? '')).toBe(1);
  } finally {
    await removed(outer, inner, source, target);
  }
});

// The whole sentence, because it is the witness: the create door read the body against the
// create schema, and it named the key of the other act as one it does not know.
const CREATE_DOOR_REFUSAL =
  'type: Invalid input: expected string, received undefined;' +
  ' label: Invalid input: expected string, received undefined;' +
  ' Unrecognized key: "targetId"';

// The address states the act, and the body never does. A body that names another act is judged
// by the door it reached, so the act of the door runs and the act of the body does not.
test('the door states the act, and a body that names another act cannot change it', async () => {
  const target = await signedEntity('Writer test door precedence');
  try {
    const before = await proposalsFor(target);
    const [refusedStatus, refusedReply] = await post('create-entity', {
      op: 'delete_entity',
      targetId: target,
    });
    expect(refusedStatus).toBe(422);
    expect(refusedReply.refusal).toBe(CREATE_DOOR_REFUSAL);
    expect(await liveRows(target)).toBe(1);
    expect(await proposalsFor(target)).toBe(before);

    const [goneStatus, goneReply] = await post('delete-entity', {
      op: 'create_entity',
      targetId: target,
    });
    expect(goneStatus).toBe(200);
    expect(goneReply.state).toBe('signed');
    expect(await liveRows(target)).toBe(0);
  } finally {
    await removed(target);
  }
});

const TARGET_OF_NO_ACT = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

// ------------------------------------------------------------------------ the decision door --

// An act that waits, written through the proposal door alone. `promote_proposal` refuses an act
// that the calling transaction wrote, so each statement commits on its own.
const waiting = async (label: string): Promise<string> => {
  const made = await one(
    `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
    [JSON.stringify({ type: 'vessel', label })],
  );
  return String(made['id']);
};

const decisionOf = async (proposalId: string): Promise<Record<string, unknown>> =>
  one('SELECT status, decided_by FROM public.proposals WHERE id = $1::uuid', [proposalId]);

test('the promotion door writes the row under the identifier of the act that made it', async () => {
  const proposalId = await waiting('Writer test promotion door');
  let targetId: string | null | undefined;
  try {
    const [status, reply] = await post('promote-proposal', { proposalId });
    targetId = reply.targetId;
    expect([status, reply.state]).toStrictEqual([200, 'decided']);
    expect(reply.proposalId).toBe(proposalId);
    // A relation of a batch names an entity before its promotion, by the identifier of its act.
    expect(targetId).toBe(proposalId);

    const made = await one('SELECT promoted_from FROM public.entities WHERE id = $1::uuid', [
      targetId,
    ]);
    expect(made['promoted_from']).toBe(proposalId);
    expect(await decisionOf(proposalId)).toStrictEqual({
      status: 'accepted',
      decided_by: 'the writer door',
    });
  } finally {
    await removed(targetId);
  }
});

// A rejected act is never deleted: it is the record of what was set aside.
test('the rejection door decides the act, and it writes no row', async () => {
  const proposalId = await waiting('Writer test rejection door');
  const [status, reply] = await post('reject-proposal', { proposalId });

  expect([status, reply.state, reply.targetId]).toStrictEqual([200, 'decided', null]);
  expect(await decisionOf(proposalId)).toStrictEqual({
    status: 'rejected',
    decided_by: 'the writer door',
  });
  expect(
    Number(
      (
        await one('SELECT count(*) AS n FROM public.entities WHERE promoted_from = $1::uuid', [
          proposalId,
        ])
      )['n'],
    ),
  ).toBe(0);

  // The queue of a second analyst still holds the act. The second decision writes nothing.
  const [again, reply2] = await post('promote-proposal', { proposalId });
  expect(again).toBe(422);
  expect(reply2.refusal).toBe(
    `the act ${proposalId} is rejected already, and a decided act is frozen`,
  );
  // A refusal names no act. The browser reads a name as the doubt, and this answer holds none.
  expect(reply2.proposalId).toBeUndefined();
});

test.for(['promote-proposal', 'reject-proposal'])(
  'the %s door refuses a decision that names no act of the record',
  async (door) => {
    const proposalId = '00000000-0000-4000-8000-000000000000';
    const [status, reply] = await post(door, { proposalId });
    expect([status, reply.refusal]).toStrictEqual([422, `the record holds no act ${proposalId}`]);
  },
);

test('a decision that names no proposal at all is refused before the record is reached', async () => {
  const [status, reply] = await post('reject-proposal', { targetId: TARGET_OF_NO_ACT });
  expect(status).toBe(422);
  expect(reply.refusal).toBe('the body names no act');
});

// An act that waits on a row, written through the proposal door alone. The row is deleted after
// it, so the promotion of this act reaches the record and the record raises.
const waitingDelete = async (targetId: string): Promise<string> => {
  const made = await one(
    `SELECT public.propose_change('delete_entity', '{}'::jsonb, ARRAY['manual']::text[],
       'entity', $1::uuid) AS id`,
    [targetId],
  );
  return String(made['id']);
};

test('a promotion whose target is gone is refused, and the answer names no act', async () => {
  const target = await signedEntity('Writer test target gone');
  const proposalId = await waitingDelete(target);
  try {
    const [gone] = await post('delete-entity', { targetId: target });
    expect(gone).toBe(200);

    const [status, reply] = await post('promote-proposal', { proposalId });
    expect(status).toBe(422);
    expect(reply.refusal).toBe(absent('target', target));
    // The database raised it, so nothing was written and the act still waits under its name.
    expect(reply.proposalId).toBeUndefined();
    expect(await decisionOf(proposalId)).toStrictEqual({ status: 'pending', decided_by: null });
  } finally {
    // A proposal is never deleted, so the act that still waits is decided before the test ends.
    await post('reject-proposal', { proposalId });
    await removed(target);
  }
});

// ------------------------------------------------------------- the rules of the record --

const LONG_TYPE = 'x'.repeat(201);

// Each rule lives in the database alone, and the database words its refusal. The act is refused
// whole: the proposal rolls back with it, so the record ends where it began.
test.for([
  [
    'an interval that starts after it ends',
    'create-relation',
    { type: 'owns', validFrom: '2026-02-01', validTo: '2026-01-01' },
    'validFrom: an interval starts on or before the day it ends',
  ],
  [
    'an interval on a type that takes none',
    'create-relation',
    { type: 'berthed_at', validFrom: '2026-01-01' },
    'validFrom: a relation of type berthed_at takes no interval, so it has no first and no' +
      ' last day',
  ],
  [
    'a day that the calendar does not hold',
    'create-relation',
    { type: 'owns', validFrom: '2026-02-30' },
    'validFrom: a new relation has a type and two ends, and each day of its interval is a day' +
      ' of the calendar, written as year, month and day: 2026-01-31',
  ],
  [
    'a relation type longer than 200 characters',
    'create-relation',
    { type: LONG_TYPE },
    'type: the type of a relation is 200 characters at most',
  ],
  [
    'a blank name',
    'create-entity',
    { type: 'vessel', label: ' ' },
    'label: a new entity has a type and a name, and neither one is blank',
  ],
  [
    'a position past the pole',
    'create-entity',
    { type: 'vessel', label: 'Writer test pole', geom: { type: 'Point', coordinates: [4, -91] } },
    'geom: each position of the geometry is a longitude from -180 to 180 and a latitude from' +
      ' -90 to 90, and no third number',
  ],
  [
    'a line of one position',
    'create-entity',
    {
      type: 'vessel',
      label: 'Writer test line',
      geom: { type: 'LineString', coordinates: [[4, 51]] },
    },
    'geom: the geometry is not a valid shape on the globe: a line has two positions or more,' +
      ' and a ring has four or more and ends on the position it starts on',
  ],
  [
    'a blank value',
    'create-entity',
    { type: 'vessel', label: 'Writer test blank', attrs: { flag: { v: ' ' } } },
    'attrs: each attribute key is lower case words of letters and digits, joined by one' +
      ' underscore, with 63 characters at most, and each value is a text that is not blank, a' +
      ' number, a yes or no, or a flat list of them',
  ],
] as const)('the record refuses %s in its own words', async ([, door, body, sentence]) => {
  const source = await signedEntity('Writer test rule source');
  const target = await signedEntity('Writer test rule target');
  try {
    const ends = door === 'create-relation' ? { srcId: source, dstId: target } : {};
    const before = await proposalsNaming(source);
    const [status, reply] = await post(door, { ...body, ...ends });
    expect([status, reply.refusal]).toStrictEqual([422, sentence]);
    expect(await proposalsNaming(source)).toBe(before);
  } finally {
    await removed(source, target);
  }
});

test('an act on the name and the type that names neither is refused in the words of the record', async () => {
  const target = await signedEntity('Writer test names neither');
  try {
    const [status, reply] = await post('update-entity', { targetId: target });
    expect([status, reply.refusal]).toStrictEqual([
      422,
      'label: the act names a new name, a new type, or both, and neither one is blank',
    ]);
  } finally {
    await removed(target);
  }
});

const unitPage = z.object({
  total: z.number(),
  next: z.array(z.string()).nullable(),
  units: z.array(
    z.object({
      unit: z.uuid(),
      acts: z.array(z.object({ id: z.uuid(), dissentReason: z.string().nullable() })),
      passages: z.array(z.object({ act: z.uuid(), text: z.string() })),
    }),
  ),
});

const askUnitsFrom = (body: unknown, origin?: string) =>
  app.request('/private/review-units', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:5177',
      'content-type': 'application/json',
      ...(origin === undefined ? {} : { origin }),
    },
    body: JSON.stringify(body),
  });

const askUnits = async (after: readonly string[] | null, size: number) => {
  const answer = await askUnitsFrom({ after, size });
  expect(answer.status).toBe(200);
  return unitPage.parse(await answer.json());
};

test('the queue reaches the review through the writer one page of units at a time', async () => {
  const pending = await one(
    "SELECT count(*)::int AS acts FROM public.proposals WHERE status = 'pending'",
    [],
  );
  const first = await askUnits(null, 1);
  expect(first.units).toHaveLength(1);

  const units: string[] = [];
  let acts = 0;
  let after: readonly string[] | null = null;
  for (;;) {
    const read = await askUnits(after, 2);
    units.push(...read.units.map((unit) => unit.unit));
    acts += read.units.reduce((sum, unit) => sum + unit.acts.length, 0);
    if (read.next === null) break;
    after = read.next;
  }
  expect(units[0]).toBe(first.units[0]?.unit);
  expect(new Set(units).size).toBe(first.total);
  expect(acts).toBe(pending['acts']);
});

test('the read of the queue refuses a page larger than the writer reads', async () => {
  const answer = await app.request('/private/review-units', {
    method: 'POST',
    headers: { host: '127.0.0.1:5177', 'content-type': 'application/json' },
    body: JSON.stringify({ after: null, size: 201 }),
  });
  expect(answer.status).toBe(422);
});

test('the private read refuses a request from another site', async () => {
  const answer = await askUnitsFrom({ after: null, size: 1 }, 'https://elsewhere.example');
  expect(answer.status).toBe(403);
});

// ------------------------------------------------------------------------- the batch door --

// A research AI proposes a linked batch through its own door, as the MCP server does.
const research = new Pool({
  connectionString:
    `postgresql://gabriel_research:${encodeURIComponent(z.string().parse(process.env['GABRIEL_RESEARCH_PASSWORD']))}` +
    '@127.0.0.1:5432/gabriel_test',
});

afterAll(async () => {
  await research.end();
});

interface Item {
  readonly id: string;
  readonly op: 'create_entity' | 'create_relation';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly names?: readonly string[];
  readonly dissent?: boolean;
  readonly dissent_reason?: string;
}

// The fixture gives each cited document one page of text, so each item cites its first letter.
const proposedBatch = async (items: readonly Item[]): Promise<readonly string[]> => {
  const page = await one(
    'SELECT document_id, extractor FROM public.document_text WHERE page = 1 LIMIT 1',
    [],
  );
  const made = await research.query<{ id: string }>(
    'SELECT proposal_id AS id FROM public.propose_batch($1::jsonb) ORDER BY item',
    [
      JSON.stringify(
        items.map((item) => ({
          ...item,
          names: item.names ?? [],
          src: [page['document_id']],
          originator: 'A batch test',
          modality: 'asserts',
          citations: [
            {
              document: page['document_id'],
              text_extractor: page['extractor'],
              page: 1,
              start: 0,
              end: 1,
            },
          ],
        })),
      ),
    ],
  );
  return made.rows.map((row) => row.id);
};

const batchOf = async (proposalId: string): Promise<string | null> =>
  z
    .string()
    .nullable()
    .parse(
      (await one('SELECT batch_id FROM api.proposal WHERE id = $1::uuid', [proposalId]))[
        'batch_id'
      ],
    );

const statusesOf = async (ids: readonly string[]): Promise<readonly string[]> =>
  (
    await pool.query<{ status: string }>(
      'SELECT status FROM public.proposals WHERE id = ANY($1::uuid[]) ORDER BY status',
      [[...ids]],
    )
  ).rows.map((row) => row.status);

test('the page of the queue gives the reason why a machine act is disputed', async () => {
  const [disputed, plain] = [randomUUID(), randomUUID()];
  const reason = 'the checker says unclear: the page names two tankers';
  await proposedBatch([
    {
      id: disputed,
      op: 'create_entity',
      payload: { type: 'vessel', label: 'Reason test disputed' },
      dissent: true,
      dissent_reason: reason,
    },
    { id: plain, op: 'create_entity', payload: { type: 'vessel', label: 'Reason test plain' } },
  ]);
  try {
    const reasons: (string | null)[] = [];
    let after: readonly string[] | null = null;
    for (;;) {
      const read = await askUnits(after, 200);
      for (const unit of read.units)
        for (const act of unit.acts)
          if (act.id === disputed || act.id === plain) reasons.push(act.dissentReason);
      if (read.next === null) break;
      after = read.next;
    }
    expect(reasons.sort()).toStrictEqual([null, reason].sort());
  } finally {
    await post('reject-proposal', { proposalId: disputed });
    await post('reject-proposal', { proposalId: plain });
  }
});

// A company that owns a vessel, both new. The relation stands first, so the door orders the
// promotion. The name of the test makes each act its own, so no act of an earlier test waits.
const linkedBatch = (test: string, vessel: string, owner: string, link: string): Item[] => [
  {
    id: link,
    op: 'create_relation',
    payload: { type: 'owns', src_id: owner, dst_id: vessel },
    names: [owner, vessel],
  },
  { id: vessel, op: 'create_entity', payload: { type: 'vessel', label: `${test} vessel` } },
  { id: owner, op: 'create_entity', payload: { type: 'company', label: `${test} owner` } },
];

test('a linked batch waits as one batch, and one promotion writes every item', async () => {
  const [vessel, owner, link] = [randomUUID(), randomUUID(), randomUUID()];
  const ids = await proposedBatch(linkedBatch('Batch test promotion', vessel, owner, link));
  try {
    const batchId = await batchOf(link);
    expect(batchId).not.toBeNull();
    expect([await batchOf(vessel), await batchOf(owner)]).toStrictEqual([batchId, batchId]);

    const [status, reply] = await post('decide-batch', { batchId, verdict: 'promote' });
    expect([status, reply.state]).toStrictEqual([200, 'decided']);
    expect(await statusesOf(ids)).toStrictEqual(['accepted', 'accepted', 'accepted']);
    expect([await liveRows(vessel), await liveRows(owner), await liveRows(link)]).toStrictEqual([
      1, 1, 1,
    ]);
  } finally {
    await removed(link, vessel, owner);
  }
});

test('two items that name no other item wait as two single acts', async () => {
  const ids = await proposedBatch([
    { id: randomUUID(), op: 'create_entity', payload: { type: 'vessel', label: 'Batch test one' } },
    { id: randomUUID(), op: 'create_entity', payload: { type: 'vessel', label: 'Batch test two' } },
  ]);
  try {
    expect(await Promise.all(ids.map(batchOf))).toStrictEqual([null, null]);
  } finally {
    for (const proposalId of ids) await post('reject-proposal', { proposalId });
  }
});

test('a batch with one item that cannot be promoted writes nothing, and the refusal names it', async () => {
  const end = await signedEntity('Batch test end that goes');
  const [owner, link] = [randomUUID(), randomUUID()];
  // The relation links the new company to an end of the record, which goes before the promotion.
  const ids = await proposedBatch([
    { id: owner, op: 'create_entity', payload: { type: 'company', label: 'Batch test refused' } },
    {
      id: link,
      op: 'create_relation',
      payload: { type: 'owns', src_id: owner, dst_id: end },
      names: [owner, end],
    },
  ]);
  const batchId = await batchOf(link);
  try {
    await removed(end);
    const [status, reply] = await post('decide-batch', { batchId, verdict: 'promote' });
    expect(status).toBe(422);
    expect(reply.refusal).toBe(
      'nothing of the batch is promoted, because the record refuses its new relation owns: ' +
        `the target ${end} does not exist`,
    );
    expect(await statusesOf(ids)).toStrictEqual(['pending', 'pending']);
    expect(await liveRows(owner)).toBe(0);
  } finally {
    await post('decide-batch', { batchId, verdict: 'reject' });
  }
});

test('one rejection rejects every item of the batch, and writes no row', async () => {
  const [vessel, owner, link] = [randomUUID(), randomUUID(), randomUUID()];
  const ids = await proposedBatch(linkedBatch('Batch test rejection', vessel, owner, link));

  const [status, reply] = await post('decide-batch', {
    batchId: await batchOf(vessel),
    verdict: 'reject',
  });
  expect([status, reply.state]).toStrictEqual([200, 'decided']);
  expect(await statusesOf(ids)).toStrictEqual(['rejected', 'rejected', 'rejected']);
  expect([await liveRows(vessel), await liveRows(owner), await liveRows(link)]).toStrictEqual([
    0, 0, 0,
  ]);
});

test.for(['promote-proposal', 'reject-proposal'])(
  'the door of one act refuses an act of a linked batch, and the batch still waits whole (%s)',
  async (door) => {
    const [vessel, owner, link] = [randomUUID(), randomUUID(), randomUUID()];
    const ids = await proposedBatch(linkedBatch(`Batch test ${door}`, vessel, owner, link));
    const batchId = await batchOf(vessel);
    try {
      const [status, reply] = await post(door, { proposalId: vessel });
      expect([status, reply.refusal]).toStrictEqual([
        422,
        `the act ${vessel} is part of the linked batch ${String(batchId)}, and the operator ` +
          'decides a batch as one unit: decide the batch',
      ]);
      expect(await statusesOf(ids)).toStrictEqual(['pending', 'pending', 'pending']);
      expect(await liveRows(vessel)).toBe(0);
    } finally {
      await post('decide-batch', { batchId, verdict: 'reject' });
    }
  },
);

test('a decision on a batch that the record does not hold is refused', async () => {
  const [status, reply] = await post('decide-batch', {
    batchId: TARGET_OF_NO_ACT,
    verdict: 'promote',
  });
  expect([status, reply.refusal]).toStrictEqual([
    422,
    `the record holds no batch ${TARGET_OF_NO_ACT} that waits`,
  ]);
});
