// An act gives the end date of an open relation of the record. The operator signs it in one
// transaction, and a machine sends it through the batch door. Each test rolls back.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_relation_close';
const EXTRACTOR = 'relation-close-test@1';
const PAGE = 'The company sold the tanker on 30 November 2023.';

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

const relation = async (ask: Ask, type: string, bounds: object = {}) => {
  const owner = await entity(ask, 'company', 'A seller of the close test');
  const vessel = await entity(ask, 'vessel', 'A tanker of the close test');
  const payload = { type, src_id: owner, dst_id: vessel, sources: ['manual'], ...bounds };
  return (await signed(ask, 'create_relation', payload, null, [owner, vessel])).target_id;
};

const close = (ask: Ask, target: string, day: string, src: readonly string[] = ['manual']) =>
  signed(ask, 'update_relation', { valid_to: day }, target, [], src);

const document = async (ask: Ask) => {
  await ask(
    `SELECT public.put_document($1, 'file', 'A sale of the close test', 'raw/relation-close.pdf',
       NULL, NULL, NULL, 'application/pdf', '2026-10-10'::date)`,
    [DOC],
  );
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    DOC,
    JSON.stringify([PAGE]),
    EXTRACTOR,
  ]);
};

const rowOf = z.array(z.object({ valid_to: z.string().nullable(), sources: z.array(z.string()) }));

const stored = async (ask: Ask, id: string) =>
  rowOf.parse(
    await ask(
      `SELECT valid_to::text AS valid_to, sources::text[] AS sources
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

test('a promoted end date closes an open owns relation and adds the documents of the act', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns', { valid_from: '2019-05-02' });
    const act = await close(ask, owns, '2023-11-30', [DOC]);
    const prior = z
      .array(z.object({ prior_value: z.unknown(), status: z.string() }))
      .parse(
        await ask('SELECT prior_value, status FROM public.proposals WHERE id = $1', [
          act.proposal_id,
        ]),
      )[0];
    return { row: await stored(ask, owns), prior, target: act.target_id === owns };
  });
  expect(seen).toStrictEqual({
    row: { valid_to: '2023-11-30', sources: ['manual', DOC] },
    prior: { prior_value: { valid_to: null, sources: ['manual'] }, status: 'accepted' },
    target: true,
  });
});

test('the record refuses an end date on an undated type, on a closed relation, and before the start', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    const undated = await relation(ask, 'associated_with');
    const closed = await relation(ask, 'owns', { valid_to: '2020-01-01' });
    const late = await relation(ask, 'owns', { valid_from: '2022-06-01' });
    return {
      undated: await refusalOf(ask, () => close(ask, undated, '2023-01-01')),
      closed: await refusalOf(ask, () => close(ask, closed, '2023-01-01')),
      beforeStart: await refusalOf(ask, () => close(ask, late, '2022-05-31')),
      sameDay: await refusalOf(ask, () => close(ask, late, '2022-06-01')),
    };
  });
  expect(refused).toStrictEqual({
    undated: 'rel_dates_scope',
    closed: 'relation_open',
    beforeStart: 'rel_dates_order',
    sameDay: 'written',
  });
});

test('an end date is a day of the calendar, and the act that gives it holds no other value', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    const owns = await relation(ask, 'owns');
    const shaped = (payload: object) =>
      refusalOf(ask, () => signed(ask, 'update_relation', payload, owns));
    return {
      notADay: await shaped({ valid_to: '2023-02-30' }),
      notIso: await shaped({ valid_to: '30/11/2023' }),
      withAttrs: await shaped({
        valid_to: '2023-11-30',
        attrs: { share: { v: '51%', src: ['manual'] } },
      }),
    };
  });
  expect(refused).toStrictEqual({
    notADay: 'proposals_close_relation_shape',
    notIso: 'proposals_close_relation_shape',
    withAttrs: 'proposals_close_relation_shape',
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
  originator: 'The company',
  modality: 'asserts',
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, start: 31, end: 47 }],
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

test('a machine sends the end date of an open relation, and no other change of a relation', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns', { valid_from: '2019-05-02' });
    const closed = await relation(ask, 'flags', { valid_to: '2020-01-01' });
    const attrs = { attrs: { share: { v: '51%', src: [DOC] } } };
    const refused = {
      attrs: await batchCause(ask, itemOf(owns, attrs)),
      both: await batchCause(ask, itemOf(owns, { valid_to: '2023-11-30', ...attrs })),
      closed: await batchCause(ask, itemOf(closed, { valid_to: '2023-11-30' })),
      beforeStart: await batchCause(ask, itemOf(owns, { valid_to: '2019-05-01' })),
    };
    const written = z
      .array(z.object({ written: z.boolean() }))
      .parse(
        await as(ask, 'gabriel_research', () =>
          ask(BATCH, [JSON.stringify([itemOf(owns, { valid_to: '2023-11-30' })])]),
        ),
      );
    return { refused, written };
  });
  expect(seen.refused).toMatchObject({
    attrs: { code: '22023', hint: 'op' },
    both: { code: '22023', hint: 'op' },
    closed: { code: '22023', constraint: 'relation_open', hint: 'validTo' },
    beforeStart: { code: '22023', constraint: 'rel_dates_order', hint: 'validTo' },
  });
  expect(seen.written).toStrictEqual([{ written: true }]);
});

const pendingClose = async (ask: Ask, target: string, day: string) => {
  const [row] = z.array(z.object({ id: z.uuid() })).parse(
    await as(ask, 'gabriel_app', () =>
      ask(
        `SELECT public.propose_change('update_relation', $1::jsonb, ARRAY['manual'],
             'relation', $2::uuid) AS id`,
        [JSON.stringify({ valid_to: day }), target],
      ),
    ),
  );
  if (row === undefined) throw new Error('the act was not written');
  return row.id;
};

// The doors decide no act in the transaction that proposed it, so the test calls the step that
// they call.
const promoted = (ask: Ask, act: string) =>
  ask(`SELECT public.apply_proposal($1::uuid, 'a test', NULL)`, [act]);

const faultsOf = async (ask: Ask, act: string) =>
  z
    .array(z.object({ faults: z.array(z.object({ level: z.string(), kind: z.string() })) }))
    .parse(await ask('SELECT faults FROM public.unit_faults(ARRAY[$1::uuid])', [act]))
    .flatMap((row) => row.faults.map((fault) => [fault.level, fault.kind]));

test('two end dates that wait on one relation are a conflict, and the second is refused at its promotion', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const owns = await relation(ask, 'owns', { valid_from: '2019-05-02' });
    const first = await pendingClose(ask, owns, '2023-11-30');
    const second = await pendingClose(ask, owns, '2023-12-31');
    const waiting = await faultsOf(ask, second);
    await promoted(ask, first);
    return {
      waiting,
      closed: await faultsOf(ask, second),
      refused: await refusalOf(ask, () => promoted(ask, second)),
      row: await stored(ask, owns),
    };
  });
  expect(seen.waiting).toContainEqual(['not_clean', 'contradiction']);
  expect(seen.closed).toContainEqual(['blocks', 'relation_closed']);
  expect(seen.refused).toBe('relation_open');
  expect(seen.row?.valid_to).toBe('2023-11-30');
});

test('an end date on a deleted relation blocks its unit and is refused', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const owns = await relation(ask, 'owns');
    const act = await pendingClose(ask, owns, '2023-11-30');
    await signed(ask, 'delete_relation', {}, owns);
    return {
      faults: await faultsOf(ask, act),
      refused: await refusalOf(ask, () => promoted(ask, act)),
    };
  });
  expect(seen.faults).toContainEqual(['blocks', 'end_missing']);
  expect(seen.refused).toBe('target_exists');
});

test('the batch door refuses an end date that is no day written as year, month and day', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns');
    const causes = [];
    for (const validTo of [null, 20231130, '2023-11-30T00:00:00Z'])
      causes.push(await batchCause(ask, itemOf(owns, { valid_to: validTo })));
    return causes;
  });
  expect(refused).toMatchObject(
    [1, 2, 3].map(() => ({
      code: '22023',
      constraint: 'proposals_close_relation_shape',
      hint: 'validTo',
    })),
  );
});
