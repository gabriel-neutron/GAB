// The one check of the faults of a unit, which the queue, the promotion and the group action read.
// Each case runs inside a transaction that rolls back, so the census tests count the same rows
// before and after.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { ORIGINATOR, TITLE } from './import-v1.ts';
import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_unit_faults';
const OTHER = 'doc_unit_faults_other';
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
  await ask(PUT, [OTHER, 'raw/unit-faults-other.txt', 'A page that a session found']);
  await ask(TEXT, [OTHER, JSON.stringify([PAGE]), EXTRACTOR]);
};

// An act of the research AI that cites the same words from another document.
const researched = (id: string, label: string, payload: Item = {}): Item => ({
  id,
  op: 'create_entity',
  payload: { type: 'military_unit', label, sources: [OTHER], ...payload },
  src: [OTHER],
  names: [],
  model_call_id: null,
  originator: 'A ministry',
  modality: 'asserts',
  citations: [{ document: OTHER, text_extractor: EXTRACTOR, page: 1, ...spanOf(INHERITED) }],
});

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
  level: z.enum(['blocks', 'waits', 'not_clean', 'information']),
  act: z.uuid().nullable(),
  said: z.string(),
  reason: z.string().optional(),
  note: z.string().nullable().optional(),
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

// The wait for a parent of the same group is on most units, so each case that is about another
// fault leaves it out. The first case reads it.
// A rejection gives its reason as a key, and the page holds the words of the key.
const said = (row: Checked | undefined) =>
  row?.faults
    .filter((one) => one.level !== 'waits')
    .map((one) => [
      one.level,
      one.kind,
      one.said,
      ...(one.reason === undefined ? [] : [one.reason, one.note ?? null]),
    ]);

const TODAY = new Date().toISOString().slice(0, 10);

test('a unit that waits for its parent in its own group is clean, and Promote alone waits', async () => {
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
  expect(read.get(brigade)).toMatchObject({
    state: 'clean',
    faults: [
      {
        level: 'waits',
        kind: 'end_waits_in_group',
        act: brigadeToArmy,
        said: 'Waits for 5th Army in this group: promote it first',
      },
    ],
  });
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
  const [disputed, alleged, unknown, foreign, link] = [
    randomUUID(),
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
    const [held, other] = z
      .array(z.object({ id: z.uuid() }))
      .parse(await ask('SELECT id FROM public.entities ORDER BY id LIMIT 2'));
    if (held === undefined || other === undefined) throw new Error('the fixture holds no entity');
    await batch(ask, [relation(link, 'unknown', held.id, other.id)]);
    return faultsOf(ask, [disputed, alleged, unknown, foreign, link]);
  });
  expect(said(read.get(link))).toStrictEqual([
    ['not_clean', 'unknown_type', 'The relation type is unknown'],
  ]);
  expect(read.get(disputed)?.state).toBe('not_clean');
  expect(said(read.get(disputed))).toStrictEqual([
    ['not_clean', 'dispute', 'Disputed: the checker finds the passage unclear'],
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
    // A new import names the parent that gave the sources in the payload.
    await batch(ask, [
      cited({
        id: flagged,
        op: 'create_entity',
        payload: {
          type: 'military_unit',
          label: '59th Brigade',
          sources: [DOC],
          sources_from: '6th Army',
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

test('an act that is not of the v1 import gets no label from the line, and cannot hold the marker', async () => {
  const [plain, marked] = [randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [researched(plain, 'A brigade that a session found')]);
    const refusal = await ask('SAVEPOINT marker')
      .then(() => batch(ask, [researched(marked, 'A marked brigade', { sources_from: 'X' })]))
      .then(
        () => null,
        (error: unknown) => error,
      );
    await ask('ROLLBACK TO SAVEPOINT marker');
    return { faults: await faultsOf(ask, [plain]), refusal };
  });
  expect(read.faults.get(plain)).toMatchObject({ state: 'clean', faults: [] });
  // The door words the rule of the shape of a new entity.
  expect(read.refusal).toMatchObject({ code: '22023' });
});

test('an entity under a parent of the record, with the name and type of its child, is a duplicate', async () => {
  const [fresh, link] = [randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const [held] = z
      .array(z.object({ label: z.string(), type: z.string(), parent: z.uuid() }))
      .parse(
        await ask(`SELECT e.label, e.type, r.dst_id AS parent FROM public.entities e
                     JOIN public.relations r ON r.src_id = e.id AND r.type = 'subordinate_to'
                    WHERE e.type <> 'unknown'
                    ORDER BY e.id LIMIT 1`),
      );
    if (held === undefined) throw new Error('the fixture holds no entity with a parent');
    await batch(ask, [
      cited({
        id: fresh,
        op: 'create_entity',
        payload: { type: held.type, label: ` ${held.label.toLowerCase()} `, sources: [DOC] },
      }),
      relation(link, 'subordinate_to', fresh, held.parent),
    ]);
    return { held, read: await faultsOf(ask, [fresh]) };
  });
  expect(read.read.get(fresh)?.state).toBe('not_clean');
  expect(said(read.read.get(fresh))).toContainEqual([
    'not_clean',
    'duplicate',
    `Same name and type under the same parent: ${read.held.label} is in the record`,
  ]);
});

test('a claim that was rejected, then proposed again with new identities, is rejected before', async () => {
  const [army, brigade, link] = [randomUUID(), randomUUID(), randomUUID()];
  const [againArmy, againBrigade, againLink] = [randomUUID(), randomUUID(), randomUUID()];
  const [changed, changedAgain, otherValue] = [randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const [record] = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        await ask("SELECT id FROM public.entities WHERE type <> 'unknown' ORDER BY id LIMIT 1"),
      );
    if (record === undefined) throw new Error('the fixture holds no entity');
    const strength = (id: string, value: string) =>
      cited({
        id,
        op: 'update_attrs',
        target_kind: 'entity',
        target_id: record.id,
        payload: { attrs: { strength: attribute(value) } },
        names: [record.id],
      });
    await batch(ask, [
      entity(army, 'Rejected Army'),
      entity(brigade, 'Rejected Brigade'),
      relation(link, 'subordinate_to', brigade, army),
    ]);
    await batch(ask, [strength(changed, '4000')]);
    await ask("SELECT public.reject_unit($1::uuid, 'other', 'The page names a ferry.', 'a test')", [
      brigade,
    ]);
    await ask("SELECT public.reject_unit($1::uuid, 'wrong_value', NULL, 'a test')", [army]);
    await ask("SELECT public.reject_unit($1::uuid, 'not_in_source', NULL, 'a test')", [changed]);
    await batch(ask, [
      entity(againArmy, '  rejected   ARMY '),
      entity(againBrigade, 'Rejected Brigade'),
      relation(againLink, 'subordinate_to', againBrigade, againArmy),
    ]);
    await batch(ask, [strength(changedAgain, '4000')]);
    // Another value is another claim.
    await batch(ask, [strength(otherValue, '5000')]);
    return faultsOf(ask, [againArmy, againBrigade, changedAgain, otherValue]);
  });
  expect(read.get(againArmy)?.state).toBe('not_clean');
  expect(said(read.get(againArmy))).toStrictEqual([
    ['not_clean', 'rejected_before', `Rejected before on ${TODAY}`, 'wrong_value', null],
  ]);
  expect(said(read.get(againBrigade))).toStrictEqual([
    [
      'not_clean',
      'rejected_before',
      `Rejected before on ${TODAY}`,
      'other',
      'The page names a ferry.',
    ],
  ]);
  expect(said(read.get(changedAgain))).toStrictEqual([
    ['not_clean', 'rejected_before', `Rejected before on ${TODAY}`, 'not_in_source', null],
  ]);
  expect(said(read.get(otherValue))).toStrictEqual([]);
});

test('an entity rejected under one parent does not mark the same name under another parent', async () => {
  const [north, south, first, second, firstUp, secondUp] = [
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
      entity(north, 'Northern Brigade'),
      entity(first, '1st Battalion'),
      relation(firstUp, 'subordinate_to', first, north),
    ]);
    await batch(ask, [
      entity(south, 'Southern Brigade'),
      // Another wording of the same name, so the door does not return the first act.
      entity(second, '1st battalion'),
      relation(secondUp, 'subordinate_to', second, south),
    ]);
    await ask("SELECT public.reject_unit($1::uuid, 'wrong_value', NULL, 'a test')", [first]);
    return faultsOf(ask, [second]);
  });
  expect(read.get(second)?.state).toBe('clean');
  expect(said(read.get(second))).toStrictEqual([]);
});

test('a relation rejected while its end waited is rejected before after that end is promoted', async () => {
  const [army, brigade, link, again] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(army, 'Promoted Army'),
      entity(brigade, 'Waiting Brigade'),
      relation(link, 'subordinate_to', brigade, army),
    ]);
    await ask("SELECT public.reject_relation($1::uuid, 'wrong_type', NULL, 'a test')", [link]);
    // An act is never decided by the transaction that proposed it, so the test dates it back.
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id = $1", [army]);
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    await ask("SELECT public.promote_unit($1::uuid, 'a test')", [army]);
    await batch(ask, [relation(again, 'subordinate_to', brigade, army)]);
    return faultsOf(ask, [again]);
  });
  expect(said(read.get(again))).toContainEqual([
    'not_clean',
    'rejected_before',
    `Rejected before on ${TODAY}`,
    'wrong_type',
    null,
  ]);
});

test('a link unit that was rejected, then proposed again with new identities, is rejected before', async () => {
  const [army, brigade, link, againBrigade, againLink] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [entity(army, 'Linked Army')]);
    await batch(ask, [
      entity(brigade, 'Linked Brigade'),
      relation(link, 'subordinate_to', brigade, army),
    ]);
    await ask("SELECT public.reject_unit($1::uuid, 'out_of_scope', NULL, 'a test')", [link]);
    await batch(ask, [
      entity(againBrigade, 'Linked Brigade'),
      relation(againLink, 'subordinate_to', againBrigade, army),
    ]);
    return faultsOf(ask, [againLink]);
  });
  expect(said(read.get(againLink))).toContainEqual([
    'not_clean',
    'rejected_before',
    `Rejected before on ${TODAY}`,
    'out_of_scope',
    null,
  ]);
});

test('a value that an import broke into "[object Object]" makes a unit not clean', async () => {
  const [list, text, sound] = [randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const withAttrs = (id: string, label: string, attrs: Item) =>
      entity(id, label, {
        payload: { type: 'military_unit', label, sources: [DOC], attrs },
      });
    await batch(ask, [
      withAttrs(list, 'Broken list', {
        source_urls: { v: ['[object', 'Object]'], src: [DOC] },
      }),
    ]);
    await batch(ask, [withAttrs(text, 'Broken text', { branch: attribute('[object Object]') })]);
    await batch(ask, [
      withAttrs(sound, 'Sound list', {
        source_urls: { v: ['https://a.example/object'], src: [DOC] },
      }),
    ]);
    return faultsOf(ask, [list, text, sound]);
  });
  expect(read.get(list)?.state).toBe('not_clean');
  expect(said(read.get(list))).toStrictEqual([
    ['not_clean', 'broken_value', 'A value is broken: source_urls'],
  ]);
  expect(said(read.get(text))).toStrictEqual([
    ['not_clean', 'broken_value', 'A value is broken: branch'],
  ]);
  expect(read.get(sound)).toMatchObject({ state: 'clean', faults: [] });
});

test('the words of a dispute name what the checker found, and not its codes', async () => {
  const [unsupported, unstated] = [randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(unsupported, 'Unsupported unit', {
        dissent: true,
        dissent_reason: 'the checker says not_supported: The passage names another unit.',
      }),
    ]);
    await batch(ask, [
      entity(unstated, 'Unstated unit', {
        dissent: true,
        dissent_reason:
          'no cited passage states label "Unstated unit", attrs.flag "Panama"; the checker did ' +
          'not answer',
      }),
    ]);
    return faultsOf(ask, [unsupported, unstated]);
  });
  expect(said(read.get(unsupported))).toStrictEqual([
    [
      'not_clean',
      'dispute',
      'Disputed: the checker finds that the passage does not support the act: The passage ' +
        'names another unit.',
    ],
  ]);
  expect(said(read.get(unstated))).toStrictEqual([
    [
      'not_clean',
      'dispute',
      'Disputed: no cited passage states the name "Unstated unit", flag "Panama"; the checker ' +
        'did not answer',
    ],
  ]);
});

const REJECT_RELATION = "SELECT public.reject_relation($1::uuid, $2, NULL, 'a test')";
const REJECT_UNIT = "SELECT public.reject_unit($1::uuid, $2, NULL, 'a test')";

// The refusal of a door in a savepoint, so the case goes on after it.
const refusalOf = async (ask: Ask, text: string, values: readonly unknown[]) => {
  await ask('SAVEPOINT refusal');
  const refusal = await ask(text, values).then(
    () => null,
    (error: unknown) => z.object({ constraint: z.string() }).parse(error).constraint,
  );
  await ask('ROLLBACK TO SAVEPOINT refusal');
  return refusal;
};

test('"end rejected" is a reason only for a relation whose other end was rejected', async () => {
  const [parent, child, link] = [randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(parent, 'End parent'),
      entity(child, 'End child'),
      relation(link, 'subordinate_to', child, parent),
    ]);
    const early = await refusalOf(ask, REJECT_RELATION, [link, 'end_rejected']);
    await ask(REJECT_UNIT, [parent, 'duplicate']);
    const ofEntity = await refusalOf(ask, REJECT_UNIT, [child, 'end_rejected']);
    const page = z
      .array(z.object({ page: z.object({ units: z.array(z.unknown()) }) }))
      .parse(await ask('SELECT public.review_units(NULL, 200) AS page'));
    const late = await refusalOf(ask, REJECT_RELATION, [link, 'end_rejected']);
    return { early, ofEntity, late, units: page[0]?.page.units ?? [] };
  });
  expect(read).toMatchObject({ early: 'rejection_end', ofEntity: 'rejection_end', late: null });
  // The page offers the reason only to a unit that has the fault.
  expect(read.units).toContainEqual(expect.objectContaining({ unit: child, endRejected: true }));
});

test('a child whose link to a rejected parent was rejected is not clean, and names its parent', async () => {
  const [parent, child, link] = [randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(parent, 'Gone parent'),
      entity(child, 'Child of a gone parent'),
      relation(link, 'subordinate_to', child, parent),
    ]);
    await ask(REJECT_UNIT, [parent, 'duplicate']);
    await ask(REJECT_RELATION, [link, 'end_rejected']);
    return faultsOf(ask, [child]);
  });
  expect(read.get(child)?.state).toBe('not_clean');
  expect(said(read.get(child))).toStrictEqual([
    ['not_clean', 'parent_rejected', `Its parent Gone parent was rejected on ${TODAY}`],
  ]);
});
