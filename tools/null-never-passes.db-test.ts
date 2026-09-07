// A CHECK passes when its expression yields NULL. Every rule below was read for that fault on
// #14, and every rule below was found sound — so these tests are what keeps them sound. A later
// tidy-up that drops an `IS NOT NULL`, a `coalesce` or a `cardinality` half restores the hole in
// silence, because a hole accepts a row and fails no other test.
//
// Each test opens a transaction, makes one gesture, asserts the SQLSTATE and the constraint that
// refused, and rolls back. The proposals ledger is append-only and a trigger refuses a delete, so
// the rollback is the only way back.

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

// ===================================================== the source list of a promoted row =====
//
// No role writes `entities` or `relations`, so these four gestures are the superuser. A row of
// either table needs the proposal it was promoted from, and a relation needs two live endpoints,
// so the test builds all of them inside its own transaction and the rollback removes them.

const GOOD_ATTRS = `{"last_port_call":{"v":"Kotka","src":["${DOCUMENT}"]}}`;
const NO_SRC_ATTRS = `{"last_port_call":{"v":"Kotka"}}`;

/** One pending proposal, signed as the operator, whose id a promoted row may name. */
const oneProposal = async (ask: Ask, op: string): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(
    await ask(`SELECT public.propose_change('${op}', '${ENTITY}'::jsonb, ${CITED}) AS id`),
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
