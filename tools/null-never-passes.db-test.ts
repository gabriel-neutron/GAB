// A CHECK passes when its expression yields NULL. Every rule below was read for that fault on
// #14, and every rule below was found sound — so these tests are what keeps them sound. A later
// tidy-up that drops an `IS NOT NULL`, a `coalesce` or a `cardinality` half restores the hole in
// silence, because a hole accepts a row and fails no other test.
//
// THE SECOND FAULT THE FILE NOW HOLDS. A key whose value is a JSON null is not a missing key.
// A rule keyed on the presence of the key alone accepts it. The geometry of an act was written
// that way, and #127 measured it. The two faults share one sentence: a null is never a value.
//
// Each test opens a transaction, makes one gesture, asserts the SQLSTATE and the constraint that
// refused, and rolls back. The proposals ledger is append-only and a trigger refuses a delete, so
// the rollback is the only way back. One gesture asserts a success instead, and it says so.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

// Every gesture cites `manual` and `vessel`, which db/apply/95_seed.sql always carries, and it
// names `last_port_call`, a declared key with no pattern. Nothing here reads the fixture.
const DOCUMENT = 'manual';
const TYPE = 'vessel';

const made = z.array(z.object({ id: z.uuid() }));

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

// ============================================================ the source list of an act =====

const propose = (payload: string, src: string): string =>
  `SELECT public.propose_change('create_entity', '${payload}'::jsonb, ${src}) AS id`;

const ENTITY = `{"type":"${TYPE}","label":"A null test"}`;

// `propose_change` stamps the author from session_user, so the call signs as the operator.
const proposedBy = async (payload: string, src: string): Promise<unknown> =>
  gesture(async (ask) => {
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    return made.parse(await ask(propose(payload, src)));
  });

test('an act that cites no document is refused', async () => {
  await expect(proposedBy(ENTITY, `ARRAY[]::text[]`)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_src_shape',
  });
});

test('an act that names a NULL in place of a document is refused', async () => {
  await expect(proposedBy(ENTITY, `ARRAY['${DOCUMENT}', NULL]::text[]`)).rejects.toMatchObject({
    code: '23514',
    constraint: 'doc_id_check',
  });
});

// ================================================== the source list of a value of an act =====

const withAttrs = (attribute: string): string =>
  `{"type":"${TYPE}","label":"A null test","attrs":{"last_port_call":${attribute}}}`;

const CITED = `ARRAY['${DOCUMENT}']::text[]`;

test('a value of an act that cites no document is refused', async () => {
  await expect(proposedBy(withAttrs(`{"v":"Kotka","src":[]}`), CITED)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_attrs',
  });
});

test('a value of an act that names a NULL in place of a document is refused', async () => {
  await expect(proposedBy(withAttrs(`{"v":"Kotka","src":[null]}`), CITED)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_attrs',
  });
});

test('a value of an act that carries no source list is refused', async () => {
  await expect(proposedBy(withAttrs(`{"v":"Kotka"}`), CITED)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_attrs',
  });
});

// ================================================================ the geometry of an act =====
//
// M9 for the position: the unknown is the absence of the key. A JSON null under `geom` answers
// `payload ? 'geom'`. So the promotion built a geometry from a null, and it raised XX000 inside
// PostGIS. The act then stayed pending, and nothing could ever apply it. Migration 0012 moved
// the refusal to the proposal.
//
// THE RULE READS SIX THINGS, AND THE FIRST DRAFT READ ONLY ONE. `{"geom": {}}` is an object,
// and the promotion raised `invalid GeoJSON representation`. Each gesture below carries one
// shape that a loader writes. A gesture is not one test each: `{}` fails the type test and the
// coordinates test at the same time, and its name says so.
//
// FOUR GESTURES HOLD A FAULT THAT RAISED NOTHING AT ALL. `["",""]` promoted to `POINT(0 0)`,
// and a false position on the map announces itself to nobody. An empty list promoted to
// `POINT EMPTY`. That is an absence the key does not announce. A `crs` member named a system
// that the promotion ignored. Only a number is a coordinate, no list is empty, no third key
// stands.
//
// THE LAST GESTURE ASSERTS A SUCCESS AND NO SQLSTATE. The rule reads the shape and never the
// content. Nothing else here proves that it did not shut the door on a real geometry. It is a
// control: it passes with the constraint, and it passes without it.

const withGeom = (geom: string): string =>
  `{"type":"${TYPE}","label":"A null test","geom":${geom}}`;

const POINT = `{"type":"Point","coordinates":[4.05,51.95]}`;

const refusedGeom = async (geom: string): Promise<void> => {
  await expect(proposedBy(withGeom(geom), CITED)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_geom',
  });
};

test('an act that carries a null in place of a geometry is refused', async () => {
  await refusedGeom('null');
});

test('an act whose geometry is not an object is refused', async () => {
  await refusedGeom('"POINT(4.05 51.95)"');
});

test('an act whose geometry names no type and no coordinates is refused', async () => {
  await refusedGeom('{}');
});

test('an act whose geometry names a type that no door states is refused', async () => {
  await refusedGeom('{"type":"Bogus","coordinates":[4.05,51.95]}');
});

test('an act whose geometry carries a null in place of its coordinates is refused', async () => {
  await refusedGeom('{"type":"Point","coordinates":null}');
});

test('an act that hides a null inside its coordinates is refused', async () => {
  await refusedGeom('{"type":"MultiPoint","coordinates":[[4.05,51.95],null]}');
});

test('an act whose coordinates are not numbers is refused', async () => {
  await refusedGeom('{"type":"Point","coordinates":["",""]}');
});

test('an act whose list of coordinates is empty is refused', async () => {
  await refusedGeom('{"type":"Point","coordinates":[]}');
});

test('an act that hides an empty list inside its coordinates is refused', async () => {
  await refusedGeom('{"type":"Polygon","coordinates":[[]]}');
});

// The one gesture here that stored a row and raised nothing. `crs` names EPSG:3857 to PostGIS,
// which returns that SRID, and `ST_SetSRID(..., 4326)` then relabels the geometry and moves
// nothing. The store kept the metres of the act, and it called them degrees. The act named
// `POINT(4.0514 51.1056)`, and no reader can see that it was lost.
test('an act whose geometry carries a third key is refused', async () => {
  await refusedGeom(
    '{"type":"Point","coordinates":[451000,6640000],' +
      '"crs":{"type":"name","properties":{"name":"EPSG:3857"}}}',
  );
});

test('an act that carries a geometry object stands', async () => {
  expect(await proposedBy(withGeom(POINT), CITED)).toHaveLength(1);
});

// ===================================================== the source list of a promoted row =====
//
// No role writes `entities` or `relations`, so these four gestures are the superuser. A row of
// either table needs the proposal it was promoted from, and a relation needs two live endpoints,
// so the test builds all of them inside its own transaction and the rollback removes them.

const GOOD_ATTRS = `{"last_port_call":{"v":"Kotka","src":["${DOCUMENT}"]}}`;
const NO_SRC_ATTRS = `{"last_port_call":{"v":"Kotka"}}`;

// Departure: the act is never promoted, so the ends it names need not exist.
const END = '00000000-0000-4000-8000-00000000e0d0';

const WITNESS = {
  create_entity: ENTITY,
  create_relation: `{"type":"berthed_at","src_id":"${END}","dst_id":"${END}"}`,
} as const;

/** One pending proposal, signed as the operator, whose id a promoted row may name. */
const oneProposal = async (ask: Ask, op: keyof typeof WITNESS): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(
    await ask(`SELECT public.propose_change('${op}', '${WITNESS[op]}'::jsonb, ${CITED}) AS id`),
  );
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('the proposal was not written');
  return row.id;
};

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, attrs, sources, promoted_from)
  VALUES ($1, $2, $3::jsonb, $4::text[]::doc_id[], $5) RETURNING id`;

const anEntity = (attrs: string, sources: string): Promise<unknown> =>
  gesture(async (ask) => {
    const from = await oneProposal(ask, 'create_entity');
    return ask(INSERT_ENTITY, [TYPE, 'A null test', attrs, sources, from]);
  });

test('an entity that cites no document is refused', async () => {
  await expect(anEntity(GOOD_ATTRS, '{}')).rejects.toMatchObject({
    code: '23514',
    constraint: 'entities_sources_shape',
  });
});

test('a value of an entity that carries no source list is refused', async () => {
  await expect(anEntity(NO_SRC_ATTRS, `{${DOCUMENT}}`)).rejects.toMatchObject({
    code: '23514',
    constraint: 'entities_attrs_valid',
  });
});

const INSERT_RELATION = `INSERT INTO public.relations
  (type, src_id, dst_id, attrs, sources, promoted_from)
  VALUES ('berthed_at', $1, $2, $3::jsonb, $4::text[]::doc_id[], $5) RETURNING id`;

const anEnd = async (ask: Ask, label: string): Promise<string> => {
  const from = await oneProposal(ask, 'create_entity');
  const [row] = made.parse(
    await ask(INSERT_ENTITY, [TYPE, label, GOOD_ATTRS, `{${DOCUMENT}}`, from]),
  );
  if (row === undefined) throw new Error('the endpoint was not written');
  return row.id;
};

const aRelation = (attrs: string, sources: string): Promise<unknown> =>
  gesture(async (ask) => {
    const src = await anEnd(ask, 'One end');
    const dst = await anEnd(ask, 'The other end');
    const from = await oneProposal(ask, 'create_relation');
    return ask(INSERT_RELATION, [src, dst, attrs, sources, from]);
  });

test('a relation that cites no document is refused', async () => {
  await expect(aRelation(GOOD_ATTRS, '{}')).rejects.toMatchObject({
    code: '23514',
    constraint: 'relations_sources_shape',
  });
});

test('a value of a relation that carries no source list is refused', async () => {
  await expect(aRelation(NO_SRC_ATTRS, `{${DOCUMENT}}`)).rejects.toMatchObject({
    code: '23514',
    constraint: 'relations_attrs_valid',
  });
});

// ======================================================= the same rule, derived not listed =====
//
// The gestures above prove nine rules. This one reads EVERY check of `public` and holds the rule
// itself, so a check written tomorrow is covered on the day it is written and not on the day
// somebody remembers to add a gesture for it.
//
// The shape it looks for: a check over exactly ONE nullable column, whose text names neither
// `<col> IS NULL` nor `<col> IS NOT NULL`. Such a check yields NULL for a NULL value, and a NULL
// check passes. Three checks were in that shape until migration 0008 wrote their guards down.
//
// A check over two or more nullable columns is a different form — `(x IS NULL) = (y IS NULL)` is
// the pattern this schema uses for a pair — so it is not read here.

const EVERY_PUBLIC_CHECK = `
  SELECT t.relname AS table_name, c.conname AS constraint_name,
         pg_catalog.pg_get_constraintdef(c.oid) AS definition,
         (SELECT array_agg(a.attname ORDER BY a.attname)
            FROM pg_catalog.pg_attribute a
           WHERE a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
             AND NOT a.attnotnull)::text[] AS nullable
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
   WHERE c.contype = 'c' AND n.nspname = 'public'
   ORDER BY t.relname, c.conname`;

const checks = z.array(
  z.object({
    table_name: z.string(),
    constraint_name: z.string(),
    definition: z.string(),
    nullable: z.array(z.string()).nullable(),
  }),
);

test('every check over one nullable column states its own NULL guard', async () => {
  const declared = checks.parse(await probe('app', (ask) => ask(EVERY_PUBLIC_CHECK)));

  const unguarded = declared
    .filter((check) => (check.nullable ?? []).length === 1)
    .filter((check) => {
      const column = check.nullable?.[0] ?? '';
      return (
        !check.definition.includes(`${column} IS NULL`) &&
        !check.definition.includes(`${column} IS NOT NULL`)
      );
    })
    .map((check) => `${check.table_name}.${check.constraint_name}`);

  // The count is asserted too: a query that returns nothing also passes an empty expectation.
  expect(declared.length).toBeGreaterThan(50);
  expect(unguarded).toStrictEqual([]);
});
