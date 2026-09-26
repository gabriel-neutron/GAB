// The promotion alone holds the source rule, so an agent that calls the door directly meets it.
// Each statement runs in its own transaction: an act is not decided by the transaction that
// proposed it. The proposals stay, because the ledger is append-only.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const HELD = 'doc_8f2a41';
const OTHER = 'doc_3c1104';

const made = z.array(z.object({ id: z.uuid() }));
const attributes = z.array(z.object({ attrs: z.record(z.string(), z.unknown()) }));

const idOf = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = made.parse(await ask(text, values));
  if (row === undefined) throw new Error('the door returned no row');
  return row.id;
};

const proposed = idOf;

const promoted = (ask: Ask, id: string): Promise<string> =>
  idOf(ask, 'SELECT public.promote_proposal($1::uuid, $2::text) AS id', [id, 'a test']);

const heldBy = async (ask: Ask, target: string): Promise<Record<string, unknown>> => {
  const [row] = attributes.parse(
    await ask('SELECT attrs FROM public.entities WHERE id = $1::uuid', [target]),
  );
  return row?.attrs ?? {};
};

const CREATE = `SELECT public.propose_change('create_entity',
  jsonb_build_object('type', 'vessel', 'label', 'A source rule test',
    'attrs', jsonb_build_object('coal_stock_t', jsonb_build_object('v', 41200,
      'src', jsonb_build_array($1::text)))),
  ARRAY[$1::text]) AS id`;

const UPDATE = `SELECT public.propose_change('update_attrs',
  jsonb_build_object('attrs', jsonb_build_object('coal_stock_t', jsonb_build_object('v', $2::jsonb,
    'src', jsonb_build_array($3::text)))),
  ARRAY[$3::text], 'entity', $1::uuid) AS id`;

const DELETE = `SELECT public.propose_change('delete_entity', '{}'::jsonb, ARRAY['manual']::text[],
  'entity', $1::uuid) AS id`;

const onCitedEntity = <T>(work: (ask: Ask, target: string) => Promise<T>): Promise<T> =>
  probe('app', async (ask) => {
    const target = await promoted(ask, await proposed(ask, CREATE, [HELD]));
    try {
      return await work(ask, target);
    } finally {
      await promoted(ask, await proposed(ask, DELETE, [target]));
    }
  });

interface Outcome {
  readonly refusal: unknown;
  readonly attrs: Record<string, unknown>;
}

// A refused act stays pending, so the test rejects it and leaves no open act behind.
const outcomeOf = async (ask: Ask, target: string, v: string): Promise<Outcome> => {
  const act = await proposed(ask, UPDATE, [target, v, OTHER]);
  const refusal = await promoted(ask, act).then(
    () => null,
    (cause: unknown) => cause,
  );
  if (refusal !== null)
    await ask('SELECT public.reject_proposal($1::uuid, $2::text)', [act, 'a test']);
  return { refusal, attrs: await heldBy(ask, target) };
};

const KEPT_AND_DROPPED =
  'the write keeps the value of coal_stock_t and drops a document from the sources of that value';

test('a changed value that cites a new document replaces the list', async () => {
  const outcome = await onCitedEntity((ask, target) => outcomeOf(ask, target, '43500'));
  expect(outcome).toStrictEqual({
    refusal: null,
    attrs: { coal_stock_t: { v: 43500, src: [OTHER] } },
  });
});

test('an unchanged value that drops a document is refused, and the key stays', async () => {
  const outcome = await onCitedEntity((ask, target) => outcomeOf(ask, target, '41200'));
  expect(outcome).toMatchObject({
    refusal: { message: KEPT_AND_DROPPED },
    attrs: { coal_stock_t: { v: 41200, src: [HELD] } },
  });
});

// jsonb compares numbers by value, so a second spelling of one number is the same claim.
test('the same number in another spelling is unchanged, and it keeps its document', async () => {
  const outcome = await onCitedEntity((ask, target) => outcomeOf(ask, target, '41200.0'));
  expect(outcome).toMatchObject({
    refusal: { message: KEPT_AND_DROPPED },
    attrs: { coal_stock_t: { v: 41200, src: [HELD] } },
  });
});
