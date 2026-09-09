// The walk that places an entity nobody located. Each gesture builds its own tree inside a
// transaction that rolls back, because the proposals ledger is append-only and a trigger refuses
// a delete. Nothing here reads the committed fixture.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { corpus } from '../src/shared/committed-fixture/corpus.ts';

import { probe, type Ask } from './probe.ts';

const DOCUMENT = 'manual';
const TYPE = 'vessel';

const made = z.array(z.object({ id: z.uuid() }));

const placed = z.array(
  z.object({
    label: z.string(),
    parent: z.string().nullable(),
    lon: z.number().nullable(),
    precision: z.string().nullable(),
  }),
);

/** Runs one gesture inside a transaction that always rolls back. */
const gesture = <T>(work: (ask: Ask) => Promise<T>) =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

const PROPOSE = `SELECT public.propose_change($1, '{}'::jsonb, ARRAY['${DOCUMENT}']::text[]) AS id`;

const oneProposal = async (ask: Ask, op: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(await ask(PROPOSE, [op]));
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('the proposal was not written');
  return row.id;
};

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, geom, attrs, sources, promoted_from)
  VALUES ($1, $2, public.ST_SetSRID(public.ST_GeomFromGeoJSON($3), 4326), $4::jsonb,
          ARRAY['${DOCUMENT}']::text[]::doc_id[], $5) RETURNING id`;

const INSERT_RELATION = `INSERT INTO public.relations
  (type, src_id, dst_id, attrs, sources, promoted_from)
  VALUES ('subordinate_to', $1, $2, '{}'::jsonb, ARRAY['${DOCUMENT}']::text[]::doc_id[], $3)
  RETURNING id`;

const point = (lon: number): string => `{"type":"Point","coordinates":[${String(lon)},51]}`;

const AREA = '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}';

const INHERITED = `{"position_precision":{"v":"inherited","src":["${DOCUMENT}"]}}`;

const NOTHING_SAID = '{}';

/** One entity, with the geometry it carries and the word it states about that geometry. */
const anEntity = async (
  ask: Ask,
  label: string,
  geom: string | null,
  attrs: string,
): Promise<string> => {
  const from = await oneProposal(ask, 'create_entity');
  const [row] = made.parse(await ask(INSERT_ENTITY, [TYPE, label, geom, attrs, from]));
  if (row === undefined) throw new Error(`the entity ${label} was not written`);
  return row.id;
};

const subordinate = async (ask: Ask, child: string, parent: string): Promise<void> => {
  const from = await oneProposal(ask, 'create_relation');
  await ask(INSERT_RELATION, [child, parent, from]);
};

// The view answers for every entity, so each gesture reads back the labels it wrote.
const DRAWN = `
  SELECT m.label,
         (SELECT p.label FROM api.full_map p WHERE p.id = m.parent_id) AS parent,
         CASE WHEN m.geom->>'type' = 'Point'
              THEN (m.geom->'coordinates'->>0)::float8 END AS lon,
         m.position_precision AS precision
    FROM api.full_map m
   WHERE m.label LIKE 'Walk %'
   ORDER BY m.label`;

test('an entity that states the word stands at the point of its parent', async () => {
  const held = await gesture(async (ask) => {
    const parent = await anEntity(ask, 'Walk 1 parent', point(4), NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 2 child', null, INHERITED);
    await subordinate(ask, child, parent);
    return placed.parse(await ask(DRAWN));
  });

  expect(held).toStrictEqual([
    { label: 'Walk 1 parent', parent: null, lon: 4, precision: null },
    { label: 'Walk 2 child', parent: 'Walk 1 parent', lon: 4, precision: 'inherited' },
  ]);
});

// THE RULE KEYS ON THE WORD AND NEVER ON A NULL GEOMETRY. Measured on the corpus that waits:
// every unpositioned unit has a positioned ancestor, so a rule keyed on the geometry would draw
// 740 units where 142 make the claim. The word is a judgement, and the graph cannot reproduce it.
test('an entity that states no word is not placed, whatever its parent carries', async () => {
  const held = await gesture(async (ask) => {
    const parent = await anEntity(ask, 'Walk 1 parent', point(4), NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 2 child', null, NOTHING_SAID);
    await subordinate(ask, child, parent);
    return placed.parse(await ask(DRAWN));
  });

  expect(held).toStrictEqual([
    { label: 'Walk 1 parent', parent: null, lon: 4, precision: null },
    { label: 'Walk 2 child', parent: null, lon: null, precision: null },
  ]);
});

test('the walk climbs past an ancestor that carries no point', async () => {
  const held = await gesture(async (ask) => {
    const top = await anEntity(ask, 'Walk 1 top', point(9), NOTHING_SAID);
    const middle = await anEntity(ask, 'Walk 2 middle', null, NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 3 child', null, INHERITED);
    await subordinate(ask, middle, top);
    await subordinate(ask, child, middle);
    return placed.parse(await ask(DRAWN));
  });

  expect(held.map((row) => [row.label, row.parent, row.lon])).toStrictEqual([
    ['Walk 1 top', null, 9],
    ['Walk 2 middle', null, null],
    ['Walk 3 child', 'Walk 1 top', 9],
  ]);
});

// A polygon reaches no surface that draws a dot, so an ancestor that carries one is walked
// through. Without this the child would take a position that no reader can draw.
test('an ancestor that carries an area is walked through', async () => {
  const held = await gesture(async (ask) => {
    const top = await anEntity(ask, 'Walk 1 top', point(9), NOTHING_SAID);
    const middle = await anEntity(ask, 'Walk 2 middle', AREA, NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 3 child', null, INHERITED);
    await subordinate(ask, middle, top);
    await subordinate(ask, child, middle);
    return placed.parse(await ask(DRAWN));
  });

  expect(held.map((row) => [row.label, row.parent])).toStrictEqual([
    ['Walk 1 top', null],
    ['Walk 2 middle', null],
    ['Walk 3 child', 'Walk 1 top'],
  ]);
});

// No CHECK refuses a ring of parents. One member carries a point, so the walk COULD place the
// others, and the gesture is empty without it. The depth is what stops the recursion.
test('a ring of parents answers, and each member takes the point in the ring', async () => {
  const held = await gesture(async (ask) => {
    const first = await anEntity(ask, 'Walk 1 first', null, INHERITED);
    const second = await anEntity(ask, 'Walk 2 second', point(6), NOTHING_SAID);
    await subordinate(ask, first, second);
    await subordinate(ask, second, first);
    return placed.parse(await ask(DRAWN));
  });

  expect(held.map((row) => [row.label, row.parent, row.lon])).toStrictEqual([
    ['Walk 1 first', 'Walk 2 second', 6],
    ['Walk 2 second', null, 6],
  ]);
});

// No CHECK refuses a relation from a row to itself. Without the guard the walk answered with
// the entity itself, and the surface would then write `position from <its own label>`.
test('a relation from a row to itself makes no parent', async () => {
  const held = await gesture(async (ask) => {
    const alone = await anEntity(ask, 'Walk 1 alone', null, INHERITED);
    await subordinate(ask, alone, alone);
    return placed.parse(await ask(DRAWN));
  });

  expect(held).toStrictEqual([
    { label: 'Walk 1 alone', parent: null, lon: null, precision: 'inherited' },
  ]);
});

// The word says nobody located the entity. A point of its own says the opposite, and the point
// wins. `parent_id` must then be empty, or a reader states an origin the point never had.
test('an entity that states the word and carries a point names no parent', async () => {
  const held = await gesture(async (ask) => {
    const parent = await anEntity(ask, 'Walk 1 parent', point(9), NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 2 child', point(2), INHERITED);
    await subordinate(ask, child, parent);
    return placed.parse(await ask(DRAWN));
  });

  expect(held).toStrictEqual([
    { label: 'Walk 1 parent', parent: null, lon: 9, precision: null },
    { label: 'Walk 2 child', parent: null, lon: 2, precision: 'inherited' },
  ]);
});

// An area reaches no surface that draws a dot. A coalesce over the geometry kept the area and
// dropped the inherited point, so the row drew nowhere and the word said nothing.
test('an entity that carries an area takes the inherited point', async () => {
  const held = await gesture(async (ask) => {
    const parent = await anEntity(ask, 'Walk 1 parent', point(9), NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 2 child', AREA, INHERITED);
    await subordinate(ask, child, parent);
    return placed.parse(await ask(DRAWN));
  });

  expect(held).toStrictEqual([
    { label: 'Walk 1 parent', parent: null, lon: 9, precision: null },
    { label: 'Walk 2 child', parent: 'Walk 1 parent', lon: 9, precision: 'inherited' },
  ]);
});

// M4 lets a relation stand at the end of a relation. Without the two filters the walk answers
// with the identifier of a relation in a column that names an entity.
test('a parent named through a relation endpoint is not walked', async () => {
  const held = await gesture(async (ask) => {
    const parent = await anEntity(ask, 'Walk 1 parent', point(9), NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 2 child', null, INHERITED);
    const carrier = await oneProposal(ask, 'create_relation');
    const [made_] = made.parse(await ask(INSERT_RELATION, [child, parent, carrier]));
    if (made_ === undefined) throw new Error('the relation was not written');
    const from = await oneProposal(ask, 'create_relation');
    await ask(
      `INSERT INTO public.relations (type, src_kind, src_id, dst_kind, dst_id, attrs, sources,
         promoted_from)
       VALUES ('subordinate_to', 'entity', $1, 'relation', $2, '{}'::jsonb,
               ARRAY['${DOCUMENT}']::text[]::doc_id[], $3)`,
      [child, made_.id, from],
    );
    return placed.parse(await ask(DRAWN));
  });

  // The first relation places the child. The second names a relation, and it adds nothing.
  expect(held.map((row) => [row.label, row.parent])).toStrictEqual([
    ['Walk 1 parent', null],
    ['Walk 2 child', 'Walk 1 parent'],
  ]);
});

// Two ancestors at one distance. `min(hop)` alone answers with two rows for one entity, so the
// tie is broken on the identifier and the answer repeats on every run.
test('two parents at one distance give one answer, and the same one twice', async () => {
  const held = await gesture(async (ask) => {
    const left = await anEntity(ask, 'Walk 1 left', point(3), NOTHING_SAID);
    const right = await anEntity(ask, 'Walk 2 right', point(7), NOTHING_SAID);
    const child = await anEntity(ask, 'Walk 3 child', null, INHERITED);
    await subordinate(ask, child, left);
    await subordinate(ask, child, right);
    const first = placed.parse(await ask(DRAWN));
    const second = placed.parse(await ask(DRAWN));
    return { first, second };
  });

  expect(held.first).toHaveLength(3);
  expect(held.first).toStrictEqual(held.second);
  expect(held.first.filter((row) => row.label === 'Walk 3 child')).toHaveLength(1);
});

// The bound is four hops, because the unit tree of the corpus that waits is four deep. The
// fifth link is what proves the bound: it stands one hop too far, and it takes no position.
test('the walk stops after four hops', async () => {
  const held = await gesture(async (ask) => {
    const top = await anEntity(ask, 'Walk 0 top', point(9), NOTHING_SAID);
    const one = await anEntity(ask, 'Walk 1 link', null, INHERITED);
    const two = await anEntity(ask, 'Walk 2 link', null, INHERITED);
    const three = await anEntity(ask, 'Walk 3 link', null, INHERITED);
    const four = await anEntity(ask, 'Walk 4 link', null, INHERITED);
    const five = await anEntity(ask, 'Walk 5 link', null, INHERITED);
    await subordinate(ask, one, top);
    await subordinate(ask, two, one);
    await subordinate(ask, three, two);
    await subordinate(ask, four, three);
    await subordinate(ask, five, four);
    return placed.parse(await ask(DRAWN));
  });

  expect(held.map((row) => [row.label, row.lon])).toStrictEqual([
    ['Walk 0 top', 9],
    ['Walk 1 link', 9],
    ['Walk 2 link', 9],
    ['Walk 3 link', 9],
    ['Walk 4 link', 9],
    ['Walk 5 link', null],
  ]);
});

// An entity that carries a point and states no word draws as the cautious state, and never as a
// measured one. `41st Combined Arms Army` of the corpus that waits is that row.
test('an entity that carries a point and states no word keeps its point and no word', async () => {
  const held = await gesture(async (ask) => {
    await anEntity(ask, 'Walk 1 measured', point(4), NOTHING_SAID);
    return placed.parse(await ask(DRAWN));
  });

  expect(held).toStrictEqual([{ label: 'Walk 1 measured', parent: null, lon: 4, precision: null }]);
});

// THE POPULATION, AND NOT THE RULE. Every case above builds its own tree and rolls it back. This
// one reads the record as it stands, because the whole reason the feature exists is a count: the
// v1 corpus marks 142 units `position_mode = 'parent'`, and one pair rides in the fixture.
const census = z.array(
  z.object({
    rows: z.coerce.number(),
    drawable: z.coerce.number(),
    borrowed: z.coerce.number(),
    claimed: z.coerce.number(),
  }),
);

const CENSUS = `
  SELECT count(*)                                            AS rows,
         count(*) FILTER (WHERE geom IS NOT NULL)             AS drawable,
         count(*) FILTER (WHERE parent_id IS NOT NULL)        AS borrowed,
         count(*) FILTER (WHERE position_precision = 'inherited') AS claimed
    FROM api.full_map`;

test('every entity that claims a borrowed position is placed at an ancestor', async () => {
  const [held] = census.parse(await probe('superuser', async (ask) => ask(CENSUS)));
  if (held === undefined) throw new Error('the map read answered no census row');

  // The view answers for EVERY entity. A row count under the entity count is the filter on the
  // geometry, come back.
  expect(held.rows).toBe(1178);
  // 143 claim the word and 143 are placed at an ancestor. **These two must be equal**, or a unit
  // stated a borrowed position and the walk found no ancestor to borrow from.
  expect(held.borrowed).toBe(held.claimed);
  expect(held.claimed).toBe(143);
  // 565 carry a point, of which 143 borrowed it. The rest are placed nowhere, and that is not a
  // fault: nobody located them and no ancestor of theirs carries a point.
  expect(held.drawable).toBe(565);
  expect(held.rows - held.drawable).toBe(613);
});

// The committed fixture repeats the walk in TypeScript, and nothing held the two answers together.
// A tie between two parents at one distance is where they last disagreed.
//
// **The join is the label and never the identifier.** The loader replays the fixture through the
// write doors, and each door mints its own identifier, so no row of the database carries the
// identifier the fixture states. The labels are what survive the load.
const borrowedByLabel = z.array(z.object({ label: z.string(), parent: z.string().nullable() }));

const FIXTURE_BORROWED = `
  SELECT m.label, (SELECT p.label FROM api.full_map p WHERE p.id = m.parent_id) AS parent
    FROM api.full_map m
   WHERE m.label = ANY($1::text[]) AND m.parent_id IS NOT NULL
   ORDER BY m.label`;

test('the fixture walk answers exactly what the view answers, for every fixture row', async () => {
  const labelOf = new Map(corpus.entities.map((entity) => [entity.id, entity.label]));
  const wanted = corpus.positions
    .filter((row) => row.parentId !== null)
    .map((row) => ({
      label: labelOf.get(row.entityId) ?? row.entityId,
      parent: labelOf.get(row.parentId ?? '') ?? null,
    }))
    .sort((one, other) => one.label.localeCompare(other.label));

  const labels = corpus.entities.map((entity) => entity.label);
  const held = await probe('superuser', async (ask) =>
    borrowedByLabel.parse(await ask(FIXTURE_BORROWED, [labels])),
  );

  // Both directions in one comparison: a row the view borrows and the fixture does not is as much
  // a disagreement as the reverse, and a one-way check would report neither.
  expect(held).toStrictEqual(wanted);
});
