// The merge doors of the operator, each run in one transaction that rolls back. The doors write
// their act and promote it in the same transaction, as the signed act does.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const made = z.array(z.object({ target_id: z.uuid(), proposal_id: z.uuid() }));
const rowOf = z.array(z.object({ row: z.record(z.string(), z.unknown()) }));

// A document of the committed fixture, which each test database holds.
const FIXTURE_DOCUMENT = 'doc_3c1104';

const signed = async (
  ask: Ask,
  op: string,
  payload: object,
  names: readonly string[] = [],
  src: readonly string[] = ['manual'],
) => {
  const [row] = made.parse(
    await ask(
      `SELECT * FROM public.sign_change('a test', $1, $2::jsonb, $4::text[], NULL, NULL,
         $3::uuid[])`,
      [op, JSON.stringify(payload), names, src],
    ),
  );
  if (row === undefined) throw new Error('the act was not signed');
  return row.target_id;
};

const manual = (v: string) => ({ v, src: ['manual'] });

const entity = (ask: Ask, type: string, label: string, attrs: object = {}) =>
  signed(ask, 'create_entity', { type, label, attrs, sources: ['manual'] });

const relation = (
  ask: Ask,
  type: string,
  from: string,
  to: string,
  more: { readonly validFrom?: string; readonly sources?: readonly string[] } = {},
) =>
  signed(
    ask,
    'create_relation',
    {
      type,
      src_id: from,
      dst_id: to,
      src_kind: 'entity',
      dst_kind: 'entity',
      sources: more.sources ?? ['manual'],
      ...(more.validFrom === undefined ? {} : { valid_from: more.validFrom }),
    },
    [from, to],
    more.sources ?? ['manual'],
  );

const merge = async (
  ask: Ask,
  survivor: string,
  absorbed: string,
  keepName = false,
): Promise<string> => {
  const [row] = made.parse(
    await ask(`SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid, $3)`, [
      survivor,
      absorbed,
      keepName,
    ]),
  );
  if (row === undefined) throw new Error('the merge was not written');
  return row.proposal_id;
};

const undo = async (ask: Ask, absorbed: string): Promise<string> => {
  const [row] = made.parse(
    await ask(`SELECT * FROM public.undo_merge('a test', $1::uuid)`, [absorbed]),
  );
  if (row === undefined) throw new Error('the undo was not written');
  return row.proposal_id;
};

const entityRow = async (ask: Ask, id: string) =>
  rowOf.parse(
    await ask('SELECT to_jsonb(e) AS row FROM public.entities e WHERE e.id = $1', [id]),
  )[0]?.row;

const relationsOf = async (ask: Ask, id: string) =>
  rowOf
    .parse(
      await ask(
        `SELECT to_jsonb(r) AS row FROM public.relations r
          WHERE r.src_id = $1 OR r.dst_id = $1 ORDER BY r.id`,
        [id],
      ),
    )
    .map(({ row }) => row);

const resolved = async (ask: Ask, id: string) =>
  z
    .array(z.object({ survivor_id: z.uuid() }))
    .parse(await ask('SELECT survivor_id FROM api.entity_alias WHERE absorbed_id = $1', [id]))[0]
    ?.survivor_id;

const refusalOf = async (ask: Ask, text: string, values: readonly unknown[]) => {
  await ask('SAVEPOINT refused');
  try {
    await ask(text, values);
    return 'written';
  } catch (cause) {
    return z.object({ constraint: z.string() }).parse(cause).constraint;
  } finally {
    await ask('ROLLBACK TO SAVEPOINT refused');
  }
};

test('a merge moves the relations and the values to the survivor, and keeps the full copy', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const keep = await entity(ask, 'vessel', 'MERGE TEST KEEP', {
      imo: manual('9000001'),
      flag: manual('Panama'),
    });
    const gone = await entity(ask, 'vessel', 'MERGE TEST GONE', {
      imo: manual('9000001'),
      flag: manual('Liberia'),
      call_sign: manual('ABCD'),
    });
    const owner = await entity(ask, 'company', 'MERGE TEST OWNER');
    const owns = await relation(ask, 'owns', owner, gone);
    await relation(ask, 'operates', owner, keep);
    const twice = await relation(ask, 'operates', owner, gone);
    const between = await relation(ask, 'associated_with', gone, keep);
    const before = await entityRow(ask, gone);

    const act = await merge(ask, keep, gone);
    const ledger = z.array(z.record(z.string(), z.unknown())).parse(
      await ask(
        `SELECT op, status, target_id, names, decision_origin, prior_value->'entity' AS copy,
                  prior_value->'dropped' AS dropped
             FROM public.proposals WHERE id = $1`,
        [act],
      ),
    )[0];
    return {
      keep,
      gone,
      owner,
      owns,
      twice,
      between,
      before,
      ledger,
      survivor: await entityRow(ask, keep),
      absorbed: await entityRow(ask, gone),
      ownsNow: await relationsOf(ask, owner),
      alias: await resolved(ask, gone),
    };
  });

  expect(seen.absorbed).toBeUndefined();
  expect(seen.alias).toBe(seen.keep);
  // The survivor keeps its own flag, and takes the call sign that it did not hold.
  expect(seen.survivor?.['attrs']).toStrictEqual({
    imo: manual('9000001'),
    flag: manual('Panama'),
    call_sign: manual('ABCD'),
  });
  // The owner owns the survivor through the same relation. The second "operates" and the relation
  // between the two entities would stand twice or on one entity, so they left the graph.
  expect(seen.ownsNow.map((row) => [row['id'], row['type'], row['dst_id']])).toStrictEqual(
    expect.arrayContaining([[seen.owns, 'owns', seen.keep]]),
  );
  expect(seen.ownsNow.map((row) => row['id'])).not.toContain(seen.twice);
  expect(seen.ledger).toMatchObject({
    op: 'merge_entities',
    status: 'accepted',
    target_id: seen.keep,
    names: [seen.gone],
    decision_origin: 'validated manually by the operator',
    dropped: [seen.twice, seen.between].sort(),
  });
  expect(seen.ledger?.['copy']).toMatchObject({
    id: seen.gone,
    label: 'MERGE TEST GONE',
    attrs: seen.before?.['attrs'],
  });
});

test('an undo restores the absorbed entity, its relations and the values of the survivor', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const keep = await entity(ask, 'vessel', 'UNDO TEST KEEP', { flag: manual('Panama') });
    const gone = await entity(ask, 'vessel', 'UNDO TEST GONE', { call_sign: manual('WXYZ') });
    const owner = await entity(ask, 'company', 'UNDO TEST OWNER');
    await relation(ask, 'owns', owner, gone);
    await relation(ask, 'operates', owner, keep);
    await relation(ask, 'operates', owner, gone);
    await relation(ask, 'associated_with', gone, keep);
    const before = {
      gone: await entityRow(ask, gone),
      keep: (await entityRow(ask, keep))?.['attrs'],
      relations: await relationsOf(ask, gone),
    };
    await merge(ask, keep, gone);
    const act = await undo(ask, gone);
    const ledger = await ask(
      'SELECT op, target_id, names, decision_origin FROM public.proposals WHERE id = $1',
      [act],
    );
    return {
      keep,
      gone,
      before,
      ledger,
      after: {
        gone: await entityRow(ask, gone),
        keep: (await entityRow(ask, keep))?.['attrs'],
        relations: await relationsOf(ask, gone),
      },
      alias: await resolved(ask, gone),
    };
  });
  expect(seen.after).toStrictEqual(seen.before);
  expect(seen.alias).toBeUndefined();
  expect(seen.ledger).toStrictEqual([
    {
      op: 'undo_merge',
      target_id: seen.gone,
      names: [seen.keep],
      decision_origin: 'validated manually by the operator',
    },
  ]);
});

test('an old identifier resolves to the survivor of the last merge, and an undo goes in order', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const first = await entity(ask, 'company', 'CHAIN TEST FIRST');
    const second = await entity(ask, 'company', 'CHAIN TEST SECOND');
    const third = await entity(ask, 'company', 'CHAIN TEST THIRD');
    await merge(ask, second, first);
    await merge(ask, third, second);
    const chained = await resolved(ask, first);
    const outOfOrder = await refusalOf(ask, `SELECT * FROM public.undo_merge('a test', $1)`, [
      first,
    ]);
    const kept = await refusalOf(
      ask,
      `SELECT * FROM public.sign_change('a test', 'delete_entity', '{}'::jsonb, ARRAY['manual'],
         'entity', $1, '{}')`,
      [third],
    );
    await undo(ask, second);
    return { second, third, chained, outOfOrder, kept, back: await resolved(ask, first) };
  });
  expect(seen.chained).toBe(seen.third);
  expect(seen.outOfOrder).toBe('merge_last');
  expect(seen.kept).toBe('survivor_kept');
  expect(seen.back).toBe(seen.second);
});

test('a merge of two types, of one entity with itself, or of a missing entity is refused', async () => {
  const refusals = await rolledBack('app', async (ask) => {
    const vessel = await entity(ask, 'vessel', 'REFUSAL TEST VESSEL');
    const company = await entity(ask, 'company', 'REFUSAL TEST COMPANY');
    const door = `SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid)`;
    return [
      await refusalOf(ask, door, [vessel, company]),
      await refusalOf(ask, door, [vessel, vessel]),
      await refusalOf(ask, door, [vessel, '00000000-0000-4000-8000-0000000000aa']),
      await refusalOf(ask, `SELECT * FROM public.undo_merge('a test', $1::uuid)`, [vessel]),
    ];
  });
  expect(refusals).toStrictEqual([
    'merge_one_type',
    'proposals_merge_shape',
    'target_exists',
    'merge_stands',
  ]);
});

const relationRow = async (ask: Ask, id: string) =>
  rowOf.parse(
    await ask('SELECT to_jsonb(r) AS row FROM public.relations r WHERE r.id = $1', [id]),
  )[0]?.row;

test('a removed twin gives its documents and its earlier first day to the relation that stays, and an undo takes them back', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const keep = await entity(ask, 'vessel', 'TWIN TEST KEEP');
    const gone = await entity(ask, 'vessel', 'TWIN TEST GONE');
    const owner = await entity(ask, 'company', 'TWIN TEST OWNER');
    const stays = await relation(ask, 'operates', owner, keep, { validFrom: '2020-01-01' });
    await relation(ask, 'operates', owner, gone, {
      validFrom: '2019-01-01',
      sources: [FIXTURE_DOCUMENT],
    });
    const before = await relationRow(ask, stays);
    await merge(ask, keep, gone);
    const merged = await relationRow(ask, stays);
    await undo(ask, gone);
    return { before, merged, after: await relationRow(ask, stays) };
  });
  expect(seen.merged).toMatchObject({
    sources: ['manual', FIXTURE_DOCUMENT],
    valid_from: '2019-01-01',
  });
  expect(seen.after).toMatchObject({ sources: ['manual'], valid_from: '2020-01-01' });
  expect(seen.before).toMatchObject({ sources: ['manual'], valid_from: '2020-01-01' });
});

test('only the last merge into a survivor is undone, so the survivor gets back what it held', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const lei = (src: string) => ({ lei: { v: 'LEI-TEST-1', src: [src] } });
    const first = await entity(ask, 'company', 'LAST TEST FIRST', lei('manual'));
    const second = await signed(
      ask,
      'create_entity',
      {
        type: 'company',
        label: 'LAST TEST SECOND',
        attrs: lei(FIXTURE_DOCUMENT),
        sources: [FIXTURE_DOCUMENT],
      },
      [],
      [FIXTURE_DOCUMENT],
    );
    const survivor = await entity(ask, 'company', 'LAST TEST SURVIVOR');
    const before = (await entityRow(ask, survivor))?.['attrs'];
    await merge(ask, survivor, first);
    await merge(ask, survivor, second);
    const refused = await refusalOf(ask, `SELECT * FROM public.undo_merge('a test', $1)`, [first]);
    await undo(ask, second);
    await undo(ask, first);
    return { before, refused, after: (await entityRow(ask, survivor))?.['attrs'] };
  });
  expect(seen.refused).toBe('merge_last');
  expect(seen.after).toStrictEqual(seen.before);
});

test('a merge can keep the absorbed name as a former name, and the undo takes it away', async () => {
  const seen = await rolledBack('app', async (ask) => {
    const keep = await entity(ask, 'vessel', 'NAME TEST KEEP');
    const gone = await entity(ask, 'vessel', 'NAME TEST OLD NAME');
    await merge(ask, keep, gone, true);
    const merged = (await entityRow(ask, keep))?.['attrs'];
    await undo(ask, gone);
    return { merged, after: (await entityRow(ask, keep))?.['attrs'] };
  });
  expect(seen.merged).toStrictEqual({
    former_names: { v: ['NAME TEST OLD NAME'], src: ['manual'] },
  });
  expect(seen.after).toStrictEqual({});
});

test('a merge is refused while an act waits on the absorbed entity or on a relation that it removes, or while a removed relation is an end', async () => {
  const refusals = await rolledBack('app', async (ask) => {
    const keep = await entity(ask, 'vessel', 'WAIT TEST KEEP');
    const gone = await entity(ask, 'vessel', 'WAIT TEST GONE');
    const owner = await entity(ask, 'company', 'WAIT TEST OWNER');
    await relation(ask, 'operates', owner, keep);
    const twin = await relation(ask, 'operates', owner, gone);
    const door = `SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid)`;

    await ask('SAVEPOINT waiting');
    await ask(
      `SELECT public.propose_change('update_relation',
         '{"attrs":{"note":{"v":"a test","src":["manual"]}}}'::jsonb, ARRAY['manual'],
         'relation', $1::uuid)`,
      [twin],
    );
    const onRelation = await refusalOf(ask, door, [keep, gone]);
    await ask('ROLLBACK TO SAVEPOINT waiting');

    await ask(
      `SELECT public.propose_change('update_attrs',
         '{"attrs":{"note":{"v":"a test","src":["manual"]}}}'::jsonb, ARRAY['manual'],
         'entity', $1::uuid)`,
      [gone],
    );
    const onEntity = await refusalOf(ask, door, [keep, gone]);
    await ask('ROLLBACK TO SAVEPOINT waiting');

    const between = await relation(ask, 'associated_with', gone, keep);
    await signed(
      ask,
      'create_relation',
      {
        type: 'contradicts',
        src_kind: 'relation',
        src_id: between,
        dst_kind: 'entity',
        dst_id: owner,
        sources: ['manual'],
      },
      [between, owner],
    );
    const anEnd = await refusalOf(ask, door, [keep, gone]);
    return [onRelation, onEntity, anEnd];
  });
  expect(refusals).toStrictEqual(['merge_absorbed_free', 'merge_absorbed_free', 'endpoint_free']);
});
