// An act adds a cited source to a relation of the record. The operator signs it in one transaction,
// and a machine sends it through the batch door. Each test rolls back.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_relation_add_source';
const EXTRACTOR = 'relation-add-source-test@1';
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
  const owner = await entity(ask, 'company', 'A buyer of the source test');
  const vessel = await entity(ask, 'vessel', 'A tanker of the source test');
  const payload = { type, src_id: owner, dst_id: vessel, sources: ['manual'], ...bounds };
  return (await signed(ask, 'create_relation', payload, null, [owner, vessel])).target_id;
};

const addSource = (ask: Ask, target: string, src: readonly string[] = [DOC]) =>
  signed(ask, 'update_relation', { add_source: true }, target, [], src);

const document = async (ask: Ask) => {
  await ask(
    `SELECT public.put_document($1, 'file', 'A listing of the source test', 'raw/relation-add-source.pdf',
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
  z.object({
    valid_from: z.string().nullable(),
    valid_to: z.string().nullable(),
    type: z.string(),
    sources: z.array(z.string()),
  }),
);

const stored = async (ask: Ask, id: string) =>
  rowOf.parse(
    await ask(
      `SELECT valid_from::text AS valid_from, valid_to::text AS valid_to, type,
         sources::text[] AS sources FROM public.relations WHERE id = $1`,
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

test('a promoted source joins the documents of a dated relation and changes nothing else', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns', { valid_from: '2019-05-02', valid_to: '2023-11-30' });
    const act = await addSource(ask, owns);
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
    row: {
      valid_from: '2019-05-02',
      valid_to: '2023-11-30',
      type: 'owns',
      sources: ['manual', DOC],
    },
    prior: { prior_value: { sources: ['manual'] }, status: 'accepted' },
    target: true,
  });
});

test('the record refuses a source that the relation cites already, and a source act with another value', async () => {
  const refused = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns');
    const shaped = (payload: object) =>
      refusalOf(ask, () => signed(ask, 'update_relation', payload, owns, [], [DOC]));
    await addSource(ask, owns);
    return {
      again: await refusalOf(ask, () => addSource(ask, owns)),
      withStart: await shaped({ add_source: true, valid_from: '2019-05-02' }),
      notTrue: await shaped({ add_source: false }),
    };
  });
  expect(refused).toStrictEqual({
    again: 'relation_has_sources',
    withStart: 'proposals_add_source_shape',
    notTrue: 'proposals_add_source_shape',
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
  originator: 'The FCDO',
  modality: 'asserts',
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, start: 4, end: 20 }],
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

test('a machine sends a source for a relation, and the door refuses an act that adds neither a document nor a page', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await document(ask);
    const owns = await relation(ask, 'owns');
    const cited = await relation(ask, 'owns');
    await addSource(ask, cited);
    const refused = {
      both: await batchCause(ask, itemOf(owns, { add_source: true, valid_to: '2023-11-30' })),
      cited: await batchCause(ask, itemOf(cited, { add_source: true })),
    };
    const written = z
      .array(z.object({ written: z.boolean() }))
      .parse(
        await as(ask, 'gabriel_research', () =>
          ask(BATCH, [JSON.stringify([itemOf(owns, { add_source: true })])]),
        ),
      );
    return { refused, written };
  });
  expect(seen.refused).toMatchObject({
    both: { code: '22023', hint: 'op' },
    // A page that no accepted act holds is a new citation, so the door writes it.
    cited: null,
  });
  expect(seen.written).toStrictEqual([{ written: true }]);
});
