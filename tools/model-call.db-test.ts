// A machine proposal names the call that made it. Each gesture below runs inside a transaction
// that rolls back, so the census tests count the same rows before and after.

import { REASON } from '@gab/model';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const SHA = 'a'.repeat(64);

const made = z.array(z.object({ id: z.uuid() }));

const RECORD = `SELECT public.record_model_call('extractor', 'v1', 'freellmapi', 'a-model', $1,
  120, $2, $3::uuid, 'a-served-model', 10, 5) AS id`;

const PROPOSE = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A model call test"}'::jsonb, ARRAY['doc_8f2a41']::text[],
  NULL, NULL, '{}', NULL, false, $1::uuid) AS id`;

const NO_CALL = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A model call test"}'::jsonb, ARRAY['doc_8f2a41']::text[]) AS id`;

const as = async (
  ask: Ask,
  role: string,
  text: string,
  values: unknown[] = [],
): Promise<string> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  // A refusal aborts the transaction, so the reset runs on success alone and the rollback does
  // the rest.
  const [row] = made.parse(await ask(text, values));
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('no row came back');
  return row.id;
};

const rolledBack = async <T>(work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

const recorded = (ask: Ask, outcome = 'ok'): Promise<string> =>
  as(ask, 'gabriel_agent', RECORD, [SHA, outcome, null]);

test('a proposal of gabriel_agent with no call id is refused', async () => {
  await expect(rolledBack((ask) => as(ask, 'gabriel_agent', NO_CALL))).rejects.toMatchObject({
    code: '23514',
    message: 'a proposal of gabriel_agent names the model call that made it',
  });
});

test('a proposal of gabriel_agent with a call id is stored with it', async () => {
  const found = await rolledBack(async (ask) => {
    const call = await recorded(ask);
    const proposal = await as(ask, 'gabriel_agent', PROPOSE, [call]);
    const rows = await ask('SELECT model_call_id FROM public.proposals WHERE id = $1', [proposal]);
    return { call, rows };
  });
  expect(found.rows).toStrictEqual([{ model_call_id: found.call }]);
});

test('a proposal of gabriel_app with a call id is refused', async () => {
  await expect(
    rolledBack(async (ask) => {
      const call = await recorded(ask);
      return as(ask, 'gabriel_app', PROPOSE, [call]);
    }),
  ).rejects.toMatchObject({ code: '23514', message: /proposals_app_carries_no_call/ });
});

test('a proposal of gabriel_app with no call id is stored', async () => {
  const id = await rolledBack((ask) => as(ask, 'gabriel_app', NO_CALL));
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
});

test('a proposal that has no call and was written before the door can still be decided', async () => {
  const rows = await rolledBack(async (ask) => {
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_stamp_author');
    const [row] = made.parse(
      await ask(
        `INSERT INTO public.proposals (op, payload, src, author_role)
           VALUES ('create_entity', '{"type":"vessel","label":"A legacy act"}'::jsonb,
                   ARRAY['doc_8f2a41']::doc_id[], 'gabriel_agent') RETURNING id`,
      ),
    );
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_stamp_author');
    if (row === undefined) throw new Error('the legacy act was not written');
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await ask("SELECT public.reject_proposal($1, 'a test')", [row.id]);
    await ask('RESET SESSION AUTHORIZATION');
    return ask('SELECT status FROM public.proposals WHERE id = $1', [row.id]);
  });
  expect(rows).toStrictEqual([{ status: 'rejected' }]);
});

test('a call row is never updated and never deleted', async () => {
  for (const [text, message] of [
    ["UPDATE public.model_call SET outcome = 'network' WHERE id = $1", /never updated/],
    ['DELETE FROM public.model_call WHERE id = $1', /never deleted/],
  ] as const)
    await expect(rolledBack(async (ask) => ask(text, [await recorded(ask)]))).rejects.toThrow(
      message,
    );
});

test('record_model_call refuses an outcome outside its closed list', async () => {
  await expect(
    rolledBack((ask) => as(ask, 'gabriel_agent', RECORD, [SHA, 'a-new-kind', null])),
  ).rejects.toMatchObject({ code: '23514' });
});

test('record_model_call refuses a prompt that is not a digest', async () => {
  await expect(
    rolledBack((ask) => as(ask, 'gabriel_agent', RECORD, ['the whole prompt', 'ok', null])),
  ).rejects.toMatchObject({ code: '23514' });
});

const OUTCOME_CHECK = `SELECT pg_catalog.pg_get_constraintdef(c.oid) AS definition
  FROM pg_catalog.pg_constraint c
 WHERE c.conrelid = 'public.model_call'::regclass AND c.contype = 'c'
   AND c.conname = 'model_call_outcome_check'`;

// Both ways: a failure kind the client gained and the table lacks, and a word the table keeps
// that the client no longer says, each fail here.
test('the outcome list is "ok" and the failure kinds of packages/model, no more and no fewer', async () => {
  const [row] = z
    .array(z.object({ definition: z.string() }))
    .parse(await probe('superuser', (ask) => ask(OUTCOME_CHECK)));
  const held = [...(row?.definition.matchAll(/'([^']+)'/g) ?? [])].map((m) => m[1]).sort();
  expect(held).toStrictEqual(['ok', ...Object.values(REASON)].sort());
});

test('every failure kind of packages/model is recorded', async () => {
  const ids = await rolledBack(async (ask) => {
    const found: string[] = [];
    for (const outcome of ['ok', ...Object.values(REASON)])
      found.push(await recorded(ask, outcome));
    return found;
  });
  expect(ids).toHaveLength(Object.values(REASON).length + 1);
});
