import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';
import { openVocabulary } from './vocabulary.ts';

const pool = openPool();
let app: ReturnType<typeof writeRoutes>;

beforeAll(async () => {
  app = writeRoutes(pool, await openVocabulary(pool));
});

// The committed fixture holds these two counts, and every gesture below undoes itself. The
// accepted proposals stay: the ledger is append-only, and a trigger refuses a delete.
const FIXTURE = { entities: 27, relations: 17 };

afterAll(async () => {
  const left = await one(
    'SELECT (SELECT count(*) FROM public.entities) AS entities,' +
      ' (SELECT count(*) FROM public.relations) AS relations',
    [],
  );
  await pool.end();
  expect({
    entities: Number(left['entities']),
    relations: Number(left['relations']),
  }).toStrictEqual(FIXTURE);
});

const replyShape = z.object({
  proposalId: z.string().optional(),
  targetId: z.string().optional(),
  state: z.string().optional(),
  refusal: z.string().optional(),
});

type Reply = z.infer<typeof replyShape>;

const post = async (door: string, body: unknown): Promise<[number, Reply]> => {
  const answer = await app.request(`/write/${door}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

const decided = async (proposalId: string | undefined): Promise<Record<string, unknown>> =>
  one('SELECT status, author_role, prior_value FROM public.proposals WHERE id = $1::uuid', [
    proposalId,
  ]);

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
const removed = async (...targets: readonly (string | undefined)[]): Promise<void> => {
  for (const targetId of targets)
    if (targetId !== undefined && targetId !== '') {
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

test('the five gestures reach the evidentiary layer', async () => {
  const [entityStatus, entityReply] = await post('create-entity', {
    type: 'facility',
    label: 'Writer test quay',
    geom: { type: 'Point', coordinates: [4.05, 51.95] },
    attrs: { berth_count: { v: 2 } },
  });

  let other = '';
  let relationId: string | undefined;
  try {
    expect(entityStatus).toBe(200);
    expect(entityReply.state).toBe('signed');

    const madeBy = await one('SELECT promoted_from FROM public.entities WHERE id = $1::uuid', [
      entityReply.targetId,
    ]);
    expect(madeBy['promoted_from']).toBe(entityReply.proposalId);
    expect(await decided(entityReply.proposalId)).toMatchObject({
      status: 'accepted',
      author_role: 'gabriel_app',
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
    expect(await decided(relationReply.proposalId)).toMatchObject({
      status: 'accepted',
      author_role: 'gabriel_app',
    });

    const [updateStatus, updateReply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: entityReply.targetId,
      attrs: { berth_count: { v: 4 } },
    });
    expect(updateStatus).toBe(200);
    expect(updateReply.targetId).toBe(entityReply.targetId);
    expect(await decided(updateReply.proposalId)).toMatchObject({
      status: 'accepted',
      author_role: 'gabriel_app',
    });
    const held = await one('SELECT attrs FROM public.entities WHERE id = $1::uuid', [
      entityReply.targetId,
    ]);
    expect(held['attrs']).toMatchObject({ berth_count: { v: 4, src: ['manual'] } });

    const [relationGone, relationGoneReply] = await post('delete-relation', {
      targetId: relationReply.targetId,
    });
    expect(relationGone).toBe(200);
    expect(await decided(relationGoneReply.proposalId)).toMatchObject({
      status: 'accepted',
      author_role: 'gabriel_app',
    });
    expect(await liveRows(relationId ?? '')).toBe(0);

    const [entityGone, entityGoneReply] = await post('delete-entity', {
      targetId: entityReply.targetId,
    });
    expect(entityGone).toBe(200);
    expect(await decided(entityGoneReply.proposalId)).toMatchObject({
      status: 'accepted',
      author_role: 'gabriel_app',
    });
    expect(await liveRows(entityReply.targetId ?? '')).toBe(0);
  } finally {
    await removed(relationId, other, entityReply.targetId);
  }
});

test('an update re-cites the document the key already holds', async () => {
  const target = await signedEntity('Writer test source rule');
  try {
    // The writer never composes a citation, so the key that already cites a document is written
    // through the same two doors, by hand, before the gesture under test runs.
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

    const [status, reply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: { coal_stock_t: { v: 43500 } },
    });
    expect(status).toBe(200);

    const held = await one('SELECT attrs FROM public.entities WHERE id = $1::uuid', [target]);
    expect(held['attrs']).toMatchObject({
      coal_stock_t: { v: 43500, src: ['doc_8f2a41', 'manual'] },
    });

    const act = await decided(reply.proposalId);
    expect(act['prior_value']).toStrictEqual({
      coal_stock_t: { v: 41200, src: ['doc_8f2a41'] },
    });
  } finally {
    await removed(target);
  }
});

test('a delete of an endpoint is refused and writes no proposal', async () => {
  const source = await signedEntity('Writer test endpoint source');
  const target = await signedEntity('Writer test endpoint target');
  let relationId: string | undefined;
  try {
    const [, relation] = await post('create-relation', {
      type: 'berthed_at',
      srcId: source,
      dstId: target,
    });
    relationId = relation.targetId;

    const before = await proposalsFor(target);
    const [status, reply] = await post('delete-entity', { targetId: target });
    expect(status).toBe(409);
    expect(reply.refusal).toBe('the entity is an endpoint of 1 relation, and it is not deleted');
    expect(await proposalsFor(target)).toBe(before);
  } finally {
    await removed(relationId, source, target);
  }
});

test('an identifier written as a number is refused and writes no proposal', async () => {
  const target = await signedEntity('Writer test declared kind');
  try {
    const before = await proposalsFor(target);
    const [status, reply] = await post('update-attrs', {
      targetKind: 'entity',
      targetId: target,
      attrs: { imo: { v: 9482137 } },
    });
    expect(status).toBe(422);
    // The door refuses `imo` for four separate reasons, and each one answers 422. Only the whole
    // sentence says which rule fired.
    expect(reply.refusal).toBe('the value of imo is not identifier, which the key declares');
    expect(await proposalsFor(target)).toBe(before);
  } finally {
    await removed(target);
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
