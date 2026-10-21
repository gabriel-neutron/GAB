// A place has a method of geolocation. The column holds a closed list, a new place brings its
// method through the promotion, the door of a machine refuses a place with no method, and the
// operator fills the method of a stored place once. The release function reads the method.
// Each gesture rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { GEOLOCATION_METHODS } from '../packages/proposal/src/geolocation-method.ts';

import { probe, rolledBack, type Ask } from './probe.ts';

const POINT = { type: 'Point', coordinates: [30, 60] };
const MOVED = { type: 'Point', coordinates: [31, 61] };

const idOf = z.array(z.object({ id: z.uuid() }));

const PROPOSE = `SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[], $3::text,
  $4::uuid) AS id`;
const PROMOTE = 'SELECT public.promote_unit($1::uuid, $2::text) AS id';

const idFrom = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = idOf.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

const proposed = (
  ask: Ask,
  op: string,
  payload: unknown,
  target: string | null = null,
): Promise<string> =>
  idFrom(ask, PROPOSE, [op, JSON.stringify(payload), target === null ? null : 'entity', target]);

// Each statement runs in its own transaction: an act is not decided by the transaction that
// proposed it. The proposals stay, because the ledger is append-only, and the rows go.
const promoted = async (ask: Ask, id: string): Promise<void> => {
  await idFrom(ask, PROMOTE, [id, 'a test']);
};

const removed = async (ask: Ask, id: string): Promise<void> => {
  await promoted(ask, await proposed(ask, 'delete_entity', {}, id));
};

const methodOf = async (ask: Ask, id: string): Promise<string | undefined> =>
  z
    .array(z.object({ geom_method: z.string() }))
    .parse(await ask('SELECT geom_method FROM public.entities WHERE id = $1', [id]))[0]
    ?.geom_method;

// A new entity that the operator accepts, and the removal of it at the end.
const withEntity = <T>(
  extra: Record<string, unknown>,
  work: (ask: Ask, id: string) => Promise<T>,
): Promise<T> =>
  probe('app', async (ask) => {
    const id = await proposed(ask, 'create_entity', created(extra));
    await promoted(ask, id);
    try {
      return await work(ask, id);
    } finally {
      await removed(ask, id);
    }
  });

const created = (extra: Record<string, unknown>) => ({
  type: 'facility',
  label: 'A method test',
  geom: POINT,
  ...extra,
});

test('the list of the database is the list of the code', async () => {
  const found = await rolledBack('superuser', (ask) =>
    ask(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'entities_geom_method_closed'`,
    ),
  );
  const def = z.array(z.object({ def: z.string() })).parse(found)[0]?.def ?? '';
  const words = [...def.matchAll(/'([a-z_]+)'/gu)].map((one) => one[1]);
  expect(words.sort()).toStrictEqual([...GEOLOCATION_METHODS].sort());
});

test('a new entity takes the method of its act when the operator accepts it', async () => {
  const found = await withEntity({ geom_method: 'satellite_match' }, (ask, id) =>
    methodOf(ask, id),
  );
  expect(found).toBe('satellite_match');
});

test('an act with a place and no method gives not_stated', async () => {
  const found = await withEntity({}, (ask, id) => methodOf(ask, id));
  expect(found).toBe('not_stated');
});

test('a new place brings its method, and a change of the name keeps the method', async () => {
  const found = await withEntity({ geom_method: 'register_address' }, async (ask, id) => {
    await promoted(ask, await proposed(ask, 'update_entity', { label: 'Another name' }, id));
    const afterName = await methodOf(ask, id);
    await promoted(
      ask,
      await proposed(ask, 'update_entity', { geom: MOVED, geom_method: 'photo_video_match' }, id),
    );
    return { afterName, afterMove: await methodOf(ask, id) };
  });
  expect(found).toStrictEqual({ afterName: 'register_address', afterMove: 'photo_video_match' });
});

test('the same place with a stated method gives that method to the entity', async () => {
  const found = await withEntity({}, async (ask, id) => {
    await promoted(
      ask,
      await proposed(ask, 'update_entity', { geom: POINT, geom_method: 'satellite_match' }, id),
    );
    return methodOf(ask, id);
  });
  expect(found).toBe('satellite_match');
});

test('the same place with no stated method takes no method away, and changes nothing', async () => {
  await withEntity({ geom_method: 'osm_object' }, async (ask, id) => {
    const repeat = await proposed(
      ask,
      'update_entity',
      { geom: POINT, geom_method: 'not_stated' },
      id,
    );
    await expect(promoted(ask, repeat)).rejects.toMatchObject({
      constraint: 'act_changes_something',
    });
    expect(await methodOf(ask, id)).toBe('osm_object');
  });
});

test.each([
  ['a word outside the list', created({ geom_method: 'guess' })],
  ['a method that is not a text', created({ geom_method: 7 })],
  ['a method with no place', { type: 'facility', label: 'A', geom_method: 'osm_object' }],
])('an act with %s is refused', async (_case, payload) => {
  await expect(
    rolledBack('app', (ask) => proposed(ask, 'create_entity', payload)),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_create_entity_shape' });
});

test('a change of place with a word outside the list is refused', async () => {
  await expect(
    rolledBack('app', (ask) =>
      proposed(
        ask,
        'update_entity',
        { geom: POINT, geom_method: 'guess' },
        '00000000-0000-4000-8000-000000000001',
      ),
    ),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_update_entity_shape' });
});

test('the column refuses a word outside the list', async () => {
  await expect(
    rolledBack('superuser', (ask) =>
      ask(
        `INSERT INTO public.entities (type, label, geom_method, sources, promoted_from)
         VALUES ('facility', 'A', 'guess', ARRAY['manual']::doc_id[], gen_random_uuid())`,
      ),
    ),
  ).rejects.toMatchObject({ code: '23514', constraint: 'entities_geom_method_closed' });
});

test('the fill changes a place that is not_stated, and then keeps its method', async () => {
  const found = await withEntity({}, async (ask, id) => {
    const fill = (method: string) =>
      ask('SELECT public.fill_geolocation_method($1, $2) AS changed', [id, method]);
    const first = await fill('osm_object');
    const again = await fill('register_address');
    return { first, again, method: await methodOf(ask, id) };
  });
  expect(found.first).toStrictEqual([{ changed: true }]);
  expect(found.again).toStrictEqual([{ changed: false }]);
  expect(found.method).toBe('osm_object');
});

test('the fill changes nothing for an entity that does not exist', async () => {
  const found = await probe('app', (ask) =>
    ask('SELECT public.fill_geolocation_method($1, $2) AS changed', [
      '00000000-0000-4000-8000-000000000009',
      'osm_object',
    ]),
  );
  expect(found).toStrictEqual([{ changed: false }]);
});

// ============================================================= an act that clears a place =====
const holdsPlace = async (ask: Ask, id: string): Promise<boolean> =>
  z
    .array(z.object({ placed: z.boolean() }))
    .parse(
      await ask('SELECT geom IS NOT NULL AS placed FROM public.entities WHERE id = $1', [id]),
    )[0]?.placed === true;

test('an act with geom null clears the place, keeps the old place in the history and resets the method', async () => {
  await withEntity({ geom_method: 'satellite_match' }, async (ask, id) => {
    const clear = await proposed(ask, 'update_entity', { geom: null }, id);
    await promoted(ask, clear);
    expect(await holdsPlace(ask, id)).toBe(false);
    expect(await methodOf(ask, id)).toBe('not_stated');
    const [row] = z
      .array(z.object({ prior: z.unknown() }))
      .parse(await ask('SELECT prior_value AS prior FROM public.proposals WHERE id = $1', [clear]));
    expect(row?.prior).toMatchObject({
      geom: { type: 'Point', coordinates: [30, 60] },
      geom_method: 'satellite_match',
    });
  });
});

test('an act that clears a place that is NULL already is refused', async () => {
  await withEntity({ geom: undefined }, async (ask, id) => {
    const clear = await proposed(ask, 'update_entity', { geom: null }, id);
    await expect(promoted(ask, clear)).rejects.toMatchObject({
      constraint: 'act_changes_something',
    });
  });
});

test('a clearing act with a method is refused by the shape of the act', async () => {
  await expect(
    rolledBack('app', (ask) =>
      proposed(
        ask,
        'update_entity',
        { geom: null, geom_method: 'osm_object' },
        '00000000-0000-4000-8000-000000000001',
      ),
    ),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_update_entity_shape' });
});
