// The one check of the faults of a unit, which the queue, the promotion and the group action read.
// Each case runs inside a transaction that rolls back, so the census tests count the same rows
// before and after.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { ORIGINATOR, TITLE } from './import-v1.ts';
import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_unit_faults';
const EXTRACTOR = 'unit-faults-test@1';
const OWN = 'v1 unit u2 | 57th Brigade | parent: 5th Army (v1 u1) | sources: https://a.example';
const INHERITED =
  'v1 unit u3 | 58th Brigade | parent: 5th Army (v1 u1) | sources of 5th Army (v1 u1): ' +
  'https://b.example';
const PAGE = ['line one', 'line two', OWN, INHERITED, 'line five', 'line six'].join('\n');
const spanOf = (line: string) => ({
  start: PAGE.indexOf(line),
  end: PAGE.indexOf(line) + line.length,
});

const PUT = `SELECT public.put_document($1, 'file', $3, $2, NULL, NULL, NULL, 'text/plain',
  '2026-10-07'::date)`;
const TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';
const BATCH = 'SELECT item, proposal_id FROM public.propose_batch($1::jsonb) ORDER BY item';
const FAULTS = 'SELECT unit_id, state, faults FROM public.unit_faults($1::uuid[])';

const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

const seed = async (ask: Ask): Promise<void> => {
  await ask(PUT, [DOC, 'raw/unit-faults.txt', TITLE]);
  await ask(TEXT, [DOC, JSON.stringify([PAGE]), EXTRACTOR]);
};

type Item = Record<string, unknown>;

const cited = (change: Item, line = OWN): Item => ({
  src: [DOC],
  names: [],
  model_call_id: null,
  originator: ORIGINATOR,
  modality: 'asserts',
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, ...spanOf(line) }],
  ...change,
});

const entity = (id: string, label: string, extra: Item = {}): Item =>
  cited({
    id,
    op: 'create_entity',
    payload: { type: 'military_unit', label, sources: [DOC] },
    ...extra,
  });

const attribute = (value: string) => ({ v: value, src: [DOC] });

const relation = (id: string, type: string, src: string, dst: string, extra: Item = {}): Item =>
  cited({
    id,
    op: 'create_relation',
    payload: { type, src_id: src, dst_id: dst, sources: [DOC] },
    names: [src, dst],
    ...extra,
  });

const batch = (ask: Ask, items: readonly Item[]) =>
  as(ask, 'gabriel_research', () => ask(BATCH, [JSON.stringify(items)]));

const fault = z.object({
  kind: z.string(),
  level: z.enum(['blocks', 'not_clean', 'information']),
  act: z.uuid().nullable(),
  said: z.string(),
});
const checked = z.array(
  z.object({
    unit_id: z.uuid(),
    state: z.enum(['clean', 'not_clean', 'blocked']),
    faults: z.array(fault),
  }),
);
type Checked = z.output<typeof checked>[number];

const faultsOf = async (ask: Ask, units: readonly string[]): Promise<Map<string, Checked>> =>
  new Map(checked.parse(await ask(FAULTS, [units])).map((row) => [row.unit_id, row] as const));

const said = (row: Checked | undefined) =>
  row?.faults.map((one) => [one.level, one.kind, one.said]);

const TODAY = new Date().toISOString().slice(0, 10);

test('a unit with no fault is clean, also when it waits for its parent in its own group', async () => {
  const [top, army, brigade, armyToTop, brigadeToArmy] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [entity(top, 'Eastern Military District')]);
    await batch(ask, [
      entity(army, '5th Army'),
      relation(armyToTop, 'subordinate_to', army, top),
      entity(brigade, '57th Brigade'),
      relation(brigadeToArmy, 'subordinate_to', brigade, army),
    ]);
    return faultsOf(ask, [top, army, brigade, armyToTop]);
  });
  expect(read.get(brigade)).toMatchObject({ state: 'clean', faults: [] });
  expect(read.get(army)).toMatchObject({ state: 'clean', faults: [] });
  // The relation that crosses two groups waits until each end is in the record.
  expect(read.get(armyToTop)?.state).toBe('blocked');
  expect(said(read.get(armyToTop))).toStrictEqual([
    ['blocks', 'end_waits', 'Waits for 5th Army (group 5th Army)'],
    // An entity that names no other act is a single act, with no group.
    ['blocks', 'end_waits', 'Waits for Eastern Military District (no group)'],
  ]);
});

test('a dispute, a reported claim and an unknown type make a unit not clean', async () => {
  const [disputed, alleged, unknown, foreign] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(disputed, 'Disputed unit', {
        dissent: true,
        dissent_reason: 'the checker says unclear',
      }),
    ]);
    await batch(ask, [entity(alleged, 'Alleged unit', { modality: 'alleges' })]);
    await batch(ask, [
      cited({
        id: unknown,
        op: 'create_entity',
        payload: { type: 'unknown', label: 'A body', sources: [DOC] },
      }),
    ]);
    await batch(ask, [
      cited({
        id: foreign,
        op: 'create_entity',
        payload: { type: 'spaceship', label: 'A ship', sources: [DOC] },
      }),
    ]);
    return faultsOf(ask, [disputed, alleged, unknown, foreign]);
  });
  expect(read.get(disputed)?.state).toBe('not_clean');
  expect(said(read.get(disputed))).toStrictEqual([
    ['not_clean', 'dispute', 'Disputed: the checker says unclear'],
  ]);
  expect(said(read.get(alleged))).toStrictEqual([
    [
      'not_clean',
      'reported_claim',
      'The source reports a claim (alleges) and does not state a fact',
    ],
  ]);
  expect(said(read.get(unknown))).toStrictEqual([
    ['not_clean', 'unknown_type', 'The entity type is unknown'],
  ]);
  expect(said(read.get(foreign))).toStrictEqual([
    ['not_clean', 'unknown_type', 'The entity type spaceship is not a type of the record'],
  ]);
});

test('two acts of a unit that set one key differently make it not clean', async () => {
  const [child, parent, first, second] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(parent, 'Contradiction parent'),
      entity(child, 'Contradiction child'),
      relation(first, 'subordinate_to', child, parent, {
        payload: {
          type: 'subordinate_to',
          src_id: child,
          dst_id: parent,
          sources: [DOC],
          attrs: { role: attribute('reserve') },
        },
      }),
      relation(second, 'subordinate_to', child, parent, {
        payload: {
          type: 'subordinate_to',
          src_id: child,
          dst_id: parent,
          sources: [DOC],
          attrs: { role: attribute('line') },
        },
      }),
    ]);
    return faultsOf(ask, [child]);
  });
  expect(read.get(child)?.state).toBe('not_clean');
  expect(said(read.get(child))).toStrictEqual([
    ['not_clean', 'contradiction', 'Two acts set role differently: line and reserve'],
  ]);
});

test('the same name and type under the same parent is a duplicate, under another parent a note', async () => {
  const [north, south, one, two, three, a, b, c] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(north, 'Northern Army'),
      entity(one, '1st Battalion'),
      relation(a, 'subordinate_to', one, north),
      entity(two, ' 1st  battalion'),
      relation(b, 'subordinate_to', two, north),
    ]);
    await batch(ask, [
      entity(south, 'Southern Army'),
      entity(three, '1ST BATTALION'),
      relation(c, 'subordinate_to', three, south),
    ]);
    return faultsOf(ask, [one, three]);
  });
  expect(read.get(one)?.state).toBe('not_clean');
  expect(said(read.get(one))).toStrictEqual([
    [
      'not_clean',
      'duplicate',
      'Same name and type under the same parent:  1st  battalion waits in the queue (group ' +
        'Northern Army)',
    ],
    ['information', 'same_name', 'Same name under Southern Army'],
  ]);
  expect(read.get(three)?.state).toBe('clean');
  expect(said(read.get(three))).toStrictEqual([
    ['information', 'same_name', 'Same name under Northern Army'],
  ]);
});

test('an entity with no parent and the name and type of an entity of the record is a duplicate', async () => {
  const fresh = randomUUID();
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const [held] = z.array(z.object({ label: z.string(), type: z.string() })).parse(
      await ask(`SELECT e.label, e.type FROM public.entities e
                    WHERE e.type <> 'unknown' AND NOT EXISTS (
                      SELECT 1 FROM public.relations r
                       WHERE r.src_id = e.id AND r.type = 'subordinate_to')
                    ORDER BY e.id LIMIT 1`),
    );
    if (held === undefined) throw new Error('the fixture holds no entity with no parent');
    await batch(ask, [
      cited({
        id: fresh,
        op: 'create_entity',
        payload: { type: held.type, label: held.label.toUpperCase(), sources: [DOC] },
      }),
    ]);
    return { held, read: await faultsOf(ask, [fresh]) };
  });
  expect(said(read.read.get(fresh))).toContainEqual([
    'not_clean',
    'duplicate',
    `Same name and type under the same parent: ${read.held.label} is in the record`,
  ]);
});

test('an end that was rejected blocks the unit and is named with the day', async () => {
  const [parent, child, link] = [randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(parent, 'Rejected parent'),
      entity(child, 'Child of a rejected parent'),
      relation(link, 'subordinate_to', child, parent),
    ]);
    await ask("SELECT public.reject_unit($1::uuid, 'duplicate', NULL, 'a test')", [parent]);
    const page = z
      .array(z.object({ page: z.object({ units: z.array(z.unknown()) }) }))
      .parse(await ask('SELECT public.review_units(NULL, 200) AS page'));
    return { faults: await faultsOf(ask, [child]), units: page[0]?.page.units ?? [] };
  });
  expect(read.faults.get(child)?.state).toBe('blocked');
  expect(said(read.faults.get(child))).toStrictEqual([
    ['blocks', 'end_rejected', `The other end Rejected parent was rejected on ${TODAY}`],
  ]);
  // The queue names the end that was rejected, and no longer says "an element".
  expect(read.units).toContainEqual(
    expect.objectContaining({
      unit: child,
      state: 'blocked',
      acts: expect.arrayContaining([
        expect.objectContaining({
          id: link,
          dst: { name: 'Rejected parent', state: 'rejected', group: null, rejectedOn: TODAY },
        }),
      ]) as unknown,
    }),
  );
});

test('an end that does not exist, a relation to itself and an act with no passage block a unit', async () => {
  const [lost, self] = [randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const [kept, gone] = z.array(z.object({ id: z.uuid(), label: z.string() })).parse(
      await ask(`SELECT e.id, e.label FROM public.entities e
                    WHERE NOT EXISTS (SELECT 1 FROM public.relations r
                                       WHERE e.id IN (r.src_id, r.dst_id))
                    ORDER BY e.id LIMIT 2`),
    );
    if (kept === undefined || gone === undefined)
      throw new Error('the fixture holds no two entities with no relation');
    await batch(ask, [relation(lost, 'operates', kept.id, gone.id)]);
    await batch(ask, [relation(self, 'operates', kept.id, kept.id)]);
    // The entity goes from the record after the proposal, as a deleted entity does.
    await ask('SET LOCAL session_replication_role = replica');
    await ask('DELETE FROM public.entities WHERE id = $1::uuid', [gone.id]);
    await ask('SET LOCAL session_replication_role = origin');
    // No door of a machine writes an act with no passage today, and older acts can hold none.
    await ask(
      'GRANT EXECUTE ON FUNCTION public.propose_change(text,jsonb,text[],text,uuid,uuid[],boolean,uuid) TO gabriel_research',
    );
    const [row] = z.array(z.object({ id: z.uuid() })).parse(
      await as(ask, 'gabriel_research', () =>
        ask(
          `SELECT public.propose_change('create_entity',
               jsonb_build_object('type', 'military_unit', 'label', 'Unsourced unit'),
               ARRAY[$1]) AS id`,
          [DOC],
        ),
      ),
    );
    if (row === undefined) throw new Error('the door wrote no act');
    return { gone, unsourced: row.id, read: await faultsOf(ask, [lost, self, row.id]) };
  });
  expect(read.read.get(lost)?.state).toBe('blocked');
  expect(said(read.read.get(lost))).toStrictEqual([
    [
      'blocks',
      'end_missing',
      `The end ${read.gone.label} is not in the record and not in the queue`,
    ],
  ]);
  expect(read.read.get(self)?.faults.map((one) => one.kind)).toStrictEqual(['self']);
  expect(said(read.read.get(read.unsourced))).toStrictEqual([
    ['blocks', 'no_source', 'The act Unsourced unit cites no passage of a source'],
  ]);
});

test('a relation to a relation that waits, and two units in a circle, are blocked', async () => {
  const [first, second, there, back, pointer] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(first, 'Circle first'),
      entity(second, 'Circle second'),
      relation(there, 'operates', first, second),
      relation(back, 'operates', second, first),
    ]);
    await batch(ask, [
      relation(pointer, 'contradicts', first, there, {
        payload: {
          type: 'contradicts',
          src_id: first,
          dst_id: there,
          dst_kind: 'relation',
          sources: [DOC],
        },
      }),
    ]);
    return faultsOf(ask, [first, second, pointer]);
  });
  expect(said(read.get(first))).toStrictEqual([
    [
      'blocks',
      'circle',
      'Waits in a circle with Circle second, which waits for this unit: reject one relation of ' +
        'the circle',
    ],
  ]);
  expect(read.get(second)?.state).toBe('blocked');
  expect(read.get(pointer)?.faults.map((one) => one.kind)).toContain('end_relation_waits');
});

test('sources from the parent, an approximate position and a note are information only', async () => {
  const [parent, child, link, flagged] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(parent, '5th Army'),
      cited(
        {
          id: child,
          op: 'create_entity',
          payload: {
            type: 'military_unit',
            label: '58th Brigade',
            sources: [DOC],
            attrs: {
              note: attribute('no clear location'),
              position_precision: attribute('approximate'),
            },
          },
        },
        INHERITED,
      ),
      relation(link, 'subordinate_to', child, parent),
    ]);
    // A new import keeps the parent that gave the sources in an attribute.
    await batch(ask, [
      cited({
        id: flagged,
        op: 'create_entity',
        payload: {
          type: 'military_unit',
          label: '59th Brigade',
          sources: [DOC],
          attrs: { sources_from: attribute('6th Army (v1 u9)') },
        },
      }),
    ]);
    return faultsOf(ask, [child, flagged, parent]);
  });
  expect(read.get(child)?.state).toBe('clean');
  expect(said(read.get(child))).toStrictEqual([
    ['information', 'approximate_position', 'The position is approximate'],
    ['information', 'note', 'Note: no clear location'],
    ['information', 'sources_from_parent', 'Sources from the parent 5th Army'],
  ]);
  expect(said(read.get(flagged))).toStrictEqual([
    ['information', 'sources_from_parent', 'Sources from the parent 6th Army'],
  ]);
  expect(read.get(parent)).toMatchObject({ state: 'clean', faults: [] });
});
