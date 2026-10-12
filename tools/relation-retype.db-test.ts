// An act changes the type of a relation from designated_by to restricted_by. The operator signs it
// in one transaction, and a machine sends it through the batch door. Each test rolls back.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';
import { READ } from './retype-relations.ts';

const DOC = 'doc_relation_retype';
const EXTRACTOR = 'relation-retype-test@1';
const PAGE = 'Directive 4 under Executive Order 14024 restricts the bank.';

const made = z.array(z.object({ target_id: z.uuid(), proposal_id: z.uuid() }));

// A refusal aborts the transaction, and the rollback to the savepoint also undoes the role.
const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

const signed = async (
  ask: Ask,
  op: string,
  payload: object,
  target: string | null = null,
  names: readonly string[] = [],
  src: readonly string[] = ['manual'],
) => {
  const [row] = made.parse(
    await as(ask, 'gabriel_app', () =>
      ask(
        `SELECT * FROM public.sign_change('a test', $1, $2::jsonb, $3::text[], $4, $5::uuid,
           $6::uuid[])`,
        [op, JSON.stringify(payload), src, target === null ? null : 'relation', target, names],
      ),
    ),
  );
  if (row === undefined) throw new Error('the act was not signed');
  return row;
};

const entity = async (ask: Ask, type: string, label: string) =>
  (await signed(ask, 'create_entity', { type, label, sources: ['manual'] })).target_id;

const ends = async (ask: Ask) => ({
  bank: await entity(ask, 'company', 'A bank of the retype test'),
  regime: await entity(ask, 'state_body', 'A treasury of the retype test'),
});

const relationOf = async (
  ask: Ask,
  ends: { bank: string; regime: string },
  type: string,
  bounds: object = {},
) =>
  (
    await signed(
      ask,
      'create_relation',
      { type, src_id: ends.bank, dst_id: ends.regime, sources: ['manual'], ...bounds },
      null,
      [ends.bank, ends.regime],
    )
  ).target_id;

const designated = async (ask: Ask, bounds: object = { valid_from: '2022-02-24' }) =>
  relationOf(ask, await ends(ask), 'designated_by', bounds);

const retype = (ask: Ask, target: string, src: readonly string[] = ['manual']) =>
  signed(ask, 'update_relation', { type: 'restricted_by' }, target, [], src);

const document = async (ask: Ask) => {
  await ask(
    `SELECT public.put_document($1, 'file', 'A directive of the retype test',
       'raw/relation-retype.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-12'::date)`,
    [DOC],
  );
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    DOC,
    JSON.stringify([PAGE]),
    EXTRACTOR,
  ]);
};

const rowOf = z.array(
  z.object({
    type: z.string(),
    valid_from: z.string().nullable(),
    valid_to: z.string().nullable(),
    sources: z.array(z.string()),
  }),
);

const stored = async (ask: Ask, id: string) =>
  rowOf.parse(
    await ask(
      `SELECT type, valid_from::text AS valid_from, valid_to::text AS valid_to,
              sources::text[] AS sources
         FROM public.relations WHERE id = $1`,
      [id],
    ),
  )[0];

const refusalOf = async (ask: Ask, work: () => Promise<unknown>) => {
  await ask('SAVEPOINT refused');
  try {
    await work();
    return 'written';
  } catch (cause) {
    return z.object({ constraint: z.string() }).parse(cause).constraint;
  } finally {
    await ask('ROLLBACK TO SAVEPOINT refused');
  }
};

test('a promoted type change keeps the id and the dates, adds the documents, and copies the old type', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const relation = await designated(ask, { valid_from: '2022-02-24', valid_to: '2024-01-01' });
    const act = await retype(ask, relation, [DOC]);
    const prior = z
      .array(z.object({ prior_value: z.unknown(), status: z.string() }))
      .parse(
        await ask('SELECT prior_value, status FROM public.proposals WHERE id = $1', [
          act.proposal_id,
        ]),
      )[0];
    return { row: await stored(ask, relation), prior, target: act.target_id === relation };
  });
  expect(seen).toStrictEqual({
    row: {
      type: 'restricted_by',
      valid_from: '2022-02-24',
      valid_to: '2024-01-01',
      sources: ['manual', DOC],
    },
    prior: { prior_value: { type: 'designated_by', sources: ['manual'] }, status: 'accepted' },
    target: true,
  });
});

test('the record refuses a type change of a missing relation, of another type, and to another type', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    const all = await ends(ask);
    const owns = await relationOf(ask, all, 'owns');
    const already = await relationOf(ask, all, 'restricted_by');
    return {
      missing: await refusalOf(ask, () => retype(ask, randomUUID())),
      notDesignated: await refusalOf(ask, () => retype(ask, owns)),
      alreadyRestricted: await refusalOf(ask, () => retype(ask, already)),
      otherPair: await refusalOf(ask, () => signed(ask, 'update_relation', { type: 'owns' }, owns)),
    };
  });
  expect(refused).toStrictEqual({
    missing: 'target_exists',
    notDesignated: 'relation_retype_from',
    alreadyRestricted: 'relation_retype_from',
    otherPair: 'proposals_retype_relation_shape',
  });
});

test('the record refuses a type change when an open restricted_by relation links the same ends', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const all = await ends(ask);
    const relation = await relationOf(ask, all, 'designated_by', { valid_from: '2022-02-24' });
    await relationOf(ask, all, 'restricted_by', { valid_from: '2023-01-01' });
    const collision = await refusalOf(ask, () => retype(ask, relation));
    const closed = await relationOf(ask, all, 'designated_by', {
      valid_from: '2020-01-01',
      valid_to: '2021-01-01',
    });
    return {
      collision,
      relation: await stored(ask, relation),
      closed: await refusalOf(ask, () => retype(ask, closed)),
    };
  });
  expect(seen.collision).toBe('relation_retype_collision');
  expect(seen.relation?.type).toBe('designated_by');
  expect(seen.closed).toBe('relation_retype_collision');
});

test('a type change holds no other value', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    const relation = await designated(ask);
    const shaped = (payload: object) =>
      refusalOf(ask, () => signed(ask, 'update_relation', payload, relation));
    return {
      withEnd: await shaped({ type: 'restricted_by', valid_to: '2024-01-01' }),
      withAttrs: await shaped({
        type: 'restricted_by',
        attrs: { note: { v: 'x', src: ['manual'] } },
      }),
      notText: await shaped({ type: 7 }),
    };
  });
  expect(refused).toStrictEqual({
    withEnd: 'proposals_close_relation_shape',
    withAttrs: 'proposals_retype_relation_shape',
    notText: 'proposals_retype_relation_shape',
  });
});

const BATCH = 'SELECT item, proposal_id, written FROM public.propose_batch($1::jsonb)';

const itemOf = (target: string, payload: object) => ({
  id: randomUUID(),
  op: 'update_relation',
  target_kind: 'relation',
  target_id: target,
  payload,
  src: [DOC],
  names: [],
  model_call_id: null,
  originator: 'The Treasury',
  modality: 'enacts',
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, start: 0, end: 11 }],
});

const batchCause = async (ask: Ask, item: object) => {
  await ask('SAVEPOINT batch');
  try {
    await as(ask, 'gabriel_research', () => ask(BATCH, [JSON.stringify([item])]));
    return null;
  } catch (cause) {
    return cause;
  } finally {
    await ask('ROLLBACK TO SAVEPOINT batch');
  }
};

test('a machine sends the type change, and the door reads the rules before the write', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const all = await ends(ask);
    const relation = await relationOf(ask, all, 'designated_by', { valid_from: '2022-02-24' });
    const owns = await relationOf(ask, all, 'owns');
    const retyped = { type: 'restricted_by' };
    const refused = {
      mixed: await batchCause(ask, itemOf(relation, { ...retyped, valid_to: '2024-01-01' })),
      notDesignated: await batchCause(ask, itemOf(owns, retyped)),
      missing: await batchCause(ask, itemOf(randomUUID(), retyped)),
    };
    await relationOf(ask, all, 'restricted_by', { valid_from: '2023-01-01' });
    const collision = await batchCause(ask, itemOf(relation, retyped));
    return { refused, collision };
  });
  expect(seen.refused).toMatchObject({
    mixed: { code: '22023', hint: 'op' },
    notDesignated: { code: '22023', constraint: 'relation_retype_from', hint: 'type' },
    missing: { code: '22023', constraint: 'target_exists' },
  });
  expect(seen.collision).toMatchObject({
    code: '22023',
    constraint: 'relation_retype_collision',
    hint: 'type',
  });
});

test('a machine type change is written, and a second act on the relation is refused at its promotion', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const relation = await designated(ask);
    const written = z
      .array(z.object({ written: z.boolean(), proposal_id: z.uuid() }))
      .parse(
        await as(ask, 'gabriel_research', () =>
          ask(BATCH, [JSON.stringify([itemOf(relation, { type: 'restricted_by' })])]),
        ),
      );
    const second = await as(ask, 'gabriel_app', () =>
      ask(
        `SELECT public.propose_change('update_relation', '{"type":"restricted_by"}'::jsonb,
           ARRAY['manual'], 'relation', $1::uuid) AS id`,
        [relation],
      ),
    );
    const ids = [written[0]?.proposal_id, z.array(z.object({ id: z.uuid() })).parse(second)[0]?.id];
    const promote = (act: string | undefined) =>
      ask(`SELECT public.apply_proposal($1::uuid, 'a test', NULL)`, [act]);
    await promote(ids[0]);
    return {
      written: written.map((row) => row.written),
      refused: await refusalOf(ask, () => promote(ids[1])),
      row: await stored(ask, relation),
    };
  });
  expect(seen.written).toStrictEqual([true]);
  expect(seen.refused).toBe('relation_retype_from');
  expect(seen.row?.type).toBe('restricted_by');
});

test('the review reads give the old type of a waiting type change and of a decided one', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const relation = await designated(ask);
    const [proposed] = z.array(z.object({ id: z.uuid() })).parse(
      await as(ask, 'gabriel_app', () =>
        ask(
          `SELECT public.propose_change('update_relation', '{"type":"restricted_by"}'::jsonb,
             ARRAY['manual'], 'relation', $1::uuid) AS id`,
          [relation],
        ),
      ),
    );
    const act = proposed?.id ?? '';
    const waiting = JSON.stringify(
      z
        .array(z.object({ page: z.object({ units: z.array(z.unknown()) }) }))
        .parse(await ask('SELECT public.review_units(NULL, 200) AS page'))[0]?.page.units,
    );
    await ask(`SELECT public.apply_proposal($1::uuid, 'a test', NULL)`, [act]);
    const history = z
      .array(z.object({ history: z.object({ acts: z.array(z.unknown()) }) }))
      .parse(await ask('SELECT public.review_decided(NULL, NULL, 500) AS history'));
    const decided = (history[0]?.history.acts ?? []).find(
      (held) => z.object({ id: z.string() }).safeParse(held).data?.id === act,
    );
    return { waiting: waiting.includes('"targetType":"designated_by"'), decided };
  });
  expect(seen.waiting).toBe(true);
  expect(seen.decided).toMatchObject({ priorType: 'designated_by' });
});

test('the read of the retype script shows a relation with no citation, with no cite', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const relation = await designated(ask);
    const rows = z
      .array(
        z.object({
          relation_id: z.string(),
          waiting: z.string(),
          collides: z.boolean(),
          cites: z.array(z.unknown()),
        }),
      )
      .parse(await ask(READ));
    return rows.find((row) => row.relation_id === relation);
  });
  expect(found).toMatchObject({ waiting: 'none', collides: false, cites: [] });
});
