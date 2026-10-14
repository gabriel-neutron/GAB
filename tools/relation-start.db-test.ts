// An act gives the start date of a relation of the record that has none. The operator signs it in
// one transaction, and a machine sends it through the batch door. Each test rolls back.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_relation_start';
const EXTRACTOR = 'relation-start-test@1';
const PAGE = 'The company bought the tanker on 2 May 2019.';

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
  const owner = await entity(ask, 'company', 'A buyer of the start test');
  const vessel = await entity(ask, 'vessel', 'A tanker of the start test');
  const payload = { type, src_id: owner, dst_id: vessel, sources: ['manual'], ...bounds };
  return (await signed(ask, 'create_relation', payload, null, [owner, vessel])).target_id;
};

const start = (ask: Ask, target: string, day: string, src: readonly string[] = ['manual']) =>
  signed(ask, 'update_relation', { valid_from: day }, target, [], src);

const document = async (ask: Ask) => {
  await ask(
    `SELECT public.put_document($1, 'file', 'A sale of the start test', 'raw/relation-start.pdf',
       NULL, NULL, NULL, 'application/pdf', '2026-10-14'::date)`,
    [DOC],
  );
  await ask('SELECT public.put_document_text($1, $2::jsonb, $3)', [
    DOC,
    JSON.stringify([PAGE]),
    EXTRACTOR,
  ]);
};

const rowOf = z.array(
  z.object({ valid_from: z.string().nullable(), sources: z.array(z.string()) }),
);

const stored = async (ask: Ask, id: string) =>
  rowOf.parse(
    await ask(
      `SELECT valid_from::text AS valid_from, sources::text[] AS sources
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

test('a promoted start date dates an owns relation with no start and adds the documents of the act', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns');
    const act = await start(ask, owns, '2019-05-02', [DOC]);
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
    row: { valid_from: '2019-05-02', sources: ['manual', DOC] },
    prior: { prior_value: { valid_from: null, sources: ['manual'] }, status: 'accepted' },
    target: true,
  });
});

test('the record refuses a start date on an undated type, on a relation with a start, and after the end', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    const undated = await relation(ask, 'associated_with');
    const started = await relation(ask, 'owns', { valid_from: '2018-01-01' });
    const ended = await relation(ask, 'owns', { valid_to: '2022-06-01' });
    return {
      undated: await refusalOf(ask, () => start(ask, undated, '2019-01-01')),
      started: await refusalOf(ask, () => start(ask, started, '2019-01-01')),
      afterEnd: await refusalOf(ask, () => start(ask, ended, '2022-06-02')),
      sameDay: await refusalOf(ask, () => start(ask, ended, '2022-06-01')),
    };
  });
  expect(refused).toStrictEqual({
    undated: 'rel_dates_scope',
    started: 'relation_has_start',
    afterEnd: 'rel_dates_order',
    sameDay: 'written',
  });
});

test('a start date is a day of the calendar, and the act that gives it holds no other value', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    const owns = await relation(ask, 'owns');
    const shaped = (payload: object) =>
      refusalOf(ask, () => signed(ask, 'update_relation', payload, owns));
    return {
      notADay: await shaped({ valid_from: '2019-02-30' }),
      notIso: await shaped({ valid_from: '02/05/2019' }),
      withEnd: await shaped({ valid_from: '2019-05-02', valid_to: '2023-11-30' }),
      withAttrs: await shaped({
        valid_from: '2019-05-02',
        attrs: { share: { v: '51%', src: ['manual'] } },
      }),
    };
  });
  expect(refused).toStrictEqual({
    notADay: 'proposals_start_relation_shape',
    notIso: 'proposals_start_relation_shape',
    // The two date forms refuse it, and the database reads the checks in the order of their names.
    withEnd: 'proposals_close_relation_shape',
    withAttrs: 'proposals_start_relation_shape',
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
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, start: 30, end: 44 }],
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

test('a machine sends the start date of a relation with no start', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns', { valid_to: '2023-11-30' });
    const started = await relation(ask, 'flags', { valid_from: '2018-01-01' });
    const refused = {
      both: await batchCause(
        ask,
        itemOf(owns, { valid_from: '2019-05-02', valid_to: '2023-11-30' }),
      ),
      started: await batchCause(ask, itemOf(started, { valid_from: '2019-05-02' })),
      afterEnd: await batchCause(ask, itemOf(owns, { valid_from: '2023-12-01' })),
      notIso: await batchCause(ask, itemOf(owns, { valid_from: '2019-05-02T00:00:00Z' })),
    };
    const written = z
      .array(z.object({ written: z.boolean() }))
      .parse(
        await as(ask, 'gabriel_research', () =>
          ask(BATCH, [JSON.stringify([itemOf(owns, { valid_from: '2019-05-02' })])]),
        ),
      );
    return { refused, written };
  });
  expect(seen.refused).toMatchObject({
    both: { code: '22023', hint: 'op' },
    started: { code: '22023', constraint: 'relation_has_start', hint: 'validFrom' },
    afterEnd: { code: '22023', constraint: 'rel_dates_order', hint: 'validFrom' },
    notIso: { code: '22023', constraint: 'proposals_start_relation_shape', hint: 'validFrom' },
  });
  expect(seen.written).toStrictEqual([{ written: true }]);
});

const pendingStart = async (ask: Ask, target: string, day: string) => {
  const [row] = z.array(z.object({ id: z.uuid() })).parse(
    await as(ask, 'gabriel_app', () =>
      ask(
        `SELECT public.propose_change('update_relation', $1::jsonb, ARRAY['manual'],
             'relation', $2::uuid) AS id`,
        [JSON.stringify({ valid_from: day }), target],
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

test('two start dates that wait on one relation are a conflict, and the second is refused at its promotion', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const owns = await relation(ask, 'owns');
    const first = await pendingStart(ask, owns, '2019-05-02');
    const second = await pendingStart(ask, owns, '2019-06-01');
    const waiting = await faultsOf(ask, second);
    await promoted(ask, first);
    return {
      waiting,
      started: await faultsOf(ask, second),
      refused: await refusalOf(ask, () => promoted(ask, second)),
      row: await stored(ask, owns),
    };
  });
  expect(seen.waiting).toContainEqual(['not_clean', 'contradiction']);
  expect(seen.started).toContainEqual(['blocks', 'relation_started']);
  expect(seen.refused).toBe('relation_has_start');
  expect(seen.row?.valid_from).toBe('2019-05-02');
});

const pendingEnd = async (ask: Ask, target: string, day: string) => {
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

test('a start that waits after an end that waits on one relation is a conflict on each act', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    const owns = await relation(ask, 'owns');
    const end = await pendingEnd(ask, owns, '2018-01-01');
    const begin = await pendingStart(ask, owns, '2019-05-02');
    const inOrder = await relation(ask, 'owns');
    const laterEnd = await pendingEnd(ask, inOrder, '2023-11-30');
    const earlierStart = await pendingStart(ask, inOrder, '2019-05-02');
    return {
      end: await faultsOf(ask, end),
      begin: await faultsOf(ask, begin),
      inOrder: [...(await faultsOf(ask, laterEnd)), ...(await faultsOf(ask, earlierStart))],
    };
  });
  expect(seen.end).toContainEqual(['not_clean', 'contradiction']);
  expect(seen.begin).toContainEqual(['not_clean', 'contradiction']);
  expect(seen.inOrder).not.toContainEqual(['not_clean', 'contradiction']);
});
