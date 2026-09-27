// Departure: an agent calls propose_change directly and no schema of the writer runs, and the
// superuser writes entities with no proposal rule at all. So each door is tested alone.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

const PROPOSE = `SELECT public.propose_change('create_entity', $1::jsonb,
  ARRAY['manual']::text[]) AS id`;

const INSERT_ENTITY = `INSERT INTO public.entities (type, label, geom, sources, promoted_from)
  VALUES ('vessel', 'A position test', public.ST_SetSRID(public.ST_GeomFromGeoJSON($1), 4326),
          ARRAY['manual']::doc_id[], $2) RETURNING id`;

const payloadOf = (geom: unknown): string =>
  JSON.stringify({ type: 'vessel', label: 'A position test', geom });

// External constraint: the trigger that stamps the author refuses each role but the two writers.
const proposedIn = async (ask: Ask, geom: unknown): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const [row] = made.parse(await ask(PROPOSE, [payloadOf(geom)]));
  await ask('RESET SESSION AUTHORIZATION');
  if (row === undefined) throw new Error('the proposal was not written');
  return row.id;
};

// External constraint: the proposals ledger is append-only, so the rollback is the only way back.
const inTransaction = <T>(work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

const proposed = (geom: unknown): Promise<string> => inTransaction((ask) => proposedIn(ask, geom));

// Departure: the act that the row names carries no position, so only the insert reads the geometry.
const inserted = (geom: unknown): Promise<unknown> =>
  inTransaction(async (ask) => {
    const from = await proposedIn(ask, undefined);
    return made.parse(await ask(INSERT_ENTITY, [JSON.stringify(geom), from]));
  });

const PROPOSAL_REFUSED = { code: '23514', constraint: 'proposals_payload_geom_position' };
const ENTITY_REFUSED = { code: '23514', constraint: 'entities_geom_on_globe' };

const QUAY = { type: 'Point', coordinates: [4.05, 51.95] };
const METRES = { type: 'Point', coordinates: [451000, 6640000] };
const HEIGHT = { type: 'Point', coordinates: [4.05, 51.95, 3] };
const RAGGED = {
  type: 'LineString',
  coordinates: [
    [4.05, 51.95],
    [4.06, 51.96, 5],
  ],
};
const ONE_VERTEX = { type: 'LineString', coordinates: [[4.05, 51.95]] };
const OPEN_RING = {
  type: 'Polygon',
  coordinates: [
    [
      [4.05, 51.95],
      [4.06, 51.95],
      [4.06, 51.96],
      [4.05, 51.96],
    ],
  ],
};

test.each([
  ['a position in metres', METRES],
  ['a latitude past the pole', { type: 'Point', coordinates: [4.05, -91] }],
  ['a height', HEIGHT],
  ['a list that mixes two and three ordinates', RAGGED],
])('an act that carries %s is refused at the proposal', async (_case, geom) => {
  await expect(proposed(geom)).rejects.toMatchObject(PROPOSAL_REFUSED);
});

test.each([
  ['a position in metres', METRES],
  ['a line of one vertex', ONE_VERTEX],
  ['a ring that does not close', OPEN_RING],
  ['an empty point', { type: 'Point', coordinates: [] }],
])('an entity that carries %s is refused at the insert', async (_case, geom) => {
  await expect(inserted(geom)).rejects.toMatchObject(ENTITY_REFUSED);
});

test('a position on the globe is still accepted at both doors', async () => {
  await expect(proposed(QUAY)).resolves.toMatch(/^[0-9a-f-]{36}$/);
  await expect(inserted(QUAY)).resolves.toHaveLength(1);
});
