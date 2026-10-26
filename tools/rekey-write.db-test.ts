// The write step of the re-key, on the doors of the database. Each test runs inside a transaction
// that rolls back, so the corpus stays as it was.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { UNIQUE_KEYS } from '@gab/tools/duplicate-identifier';
import { callTool, type Session } from '@gab/tools/tool';
import { propose } from '@gab/tools/propose';

import { rolledBack, type Ask } from './probe.ts';
import { DRIFTED_KEYS } from './rekey-attributes.ts';
import { apply, doorsOf, readGroups, type Doors, type Group } from './rekey-write.ts';

const SHA = 'c'.repeat(64);
const DOC = `doc_${SHA.slice(0, 12)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const TEXT =
  'The tanker NAYARA has a deadweight of 115000 t. ACME LLC owns NAYARA. ' +
  'Rosneft owns NAYARA. NAYARA lies at Sikka. Another list gives a tonnage of 115000 t.\n' +
  'Gross tonnage (t)\n42 500';

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

// Every statement runs as one role: the doors of the script are the doors of the roles.
const sessionAs = (ask: Ask, role: string): Session => ({
  query: async (text, values) => {
    await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
    try {
      return { rows: await ask(text, values) };
    } finally {
      await ask('RESET SESSION AUTHORIZATION');
    }
  },
});

const item = (ref: string, act: Record<string, unknown>, excerpt: string) => ({
  ref,
  act,
  originator: 'The port authority',
  modality: 'asserts',
  evidence: [{ document: DOC, page: 1, excerpt }],
});

const sent = z.object({ proposals: z.array(z.object({ ref: z.string(), proposalId: z.uuid() })) });

const send = async (ask: Ask, items: unknown[]): Promise<Record<string, string>> => {
  const outcome = await callTool(propose, sessionAs(ask, 'gabriel_research'), { items });
  if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
  return Object.fromEntries(
    sent.parse(outcome.output).proposals.map((one) => [one.ref, one.proposalId]),
  );
};

const recordEntity = async (ask: Ask): Promise<string> => {
  const [row] = z
    .array(z.object({ id: z.uuid() }))
    .parse(await ask('SELECT id::text AS id FROM api.entity ORDER BY id LIMIT 1'));
  if (row === undefined) throw new Error('the fixture holds no entity');
  return row.id;
};

const NAYARA = (key: string, excerpt = 'a deadweight of 115000 t', value = 115000) =>
  item(
    'ship',
    { op: 'create_entity', type: 'vessel', label: 'NAYARA', attrs: { [key]: { v: value } } },
    excerpt,
  );

interface Fixture {
  readonly ship: string;
  readonly company: string;
  readonly between: string;
  readonly owner: string;
  readonly place: string;
}

// A drifted vessel, a company of the same batch that is right, a relation between the two (it joins
// the unit of the company), a relation from the record (it joins the unit of the vessel), and a place.
const plant = async (
  ask: Ask,
  key = 'dwt_t',
  excerpt?: string,
  value?: number,
): Promise<Fixture> => {
  await sessionAs(ask, 'gabriel_research').query(STORE, [
    'url',
    'A report of the re-key test',
    `raw/${SHA}`,
    'https://example.org/rekey',
    SHA,
    'application/pdf',
    TODAY,
    null,
  ]);
  await sessionAs(ask, 'gabriel_research').query(WRITE_TEXT, [
    DOC,
    JSON.stringify([TEXT]),
    'rekey-test-1',
  ]);
  const held = await recordEntity(ask);
  const first = await send(ask, [
    NAYARA(key, excerpt, value),
    item('firm', { op: 'create_entity', type: 'company', label: 'ACME LLC' }, 'ACME LLC owns'),
    item(
      'between',
      { op: 'create_relation', type: 'owns', srcId: 'firm', dstId: 'ship' },
      'ACME LLC owns NAYARA',
    ),
  ]);
  const owner = await send(ask, [
    item(
      'owner',
      { op: 'create_relation', type: 'owns', srcId: held, dstId: first['ship'] },
      'Rosneft owns NAYARA',
    ),
  ]);
  const place = await send(ask, [
    item(
      'place',
      {
        op: 'update_entity',
        targetId: first['ship'],
        geom: { type: 'Point', coordinates: [69.8, 22.4] },
        geomMethod: 'not_stated',
      },
      'NAYARA lies at Sikka',
    ),
  ]);
  return {
    ship: first['ship'] ?? '',
    company: first['firm'] ?? '',
    between: first['between'] ?? '',
    owner: owner['owner'] ?? '',
    place: place['place'] ?? '',
  };
};

const STATES = `SELECT id::text AS id, status, reject_reason, reject_note, decided_by, op, payload
  FROM public.proposals WHERE id = ANY($1::uuid[])`;

const stateOf = async (ask: Ask, ids: readonly string[]) =>
  z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        reject_reason: z.string().nullable(),
        reject_note: z.string().nullable(),
        decided_by: z.string().nullable(),
        op: z.string(),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .parse(await ask(STATES, [ids]));

const groupOf = async (ask: Ask, fixture: Fixture): Promise<Group> => {
  const found = (await readGroups(sessionAs(ask, 'gabriel_app'), UNIQUE_KEYS, DRIFTED_KEYS)).find(
    (one) => one.moved.some((act) => act.id === fixture.ship),
  );
  if (found === undefined) throw new Error('the queue holds no group of the vessel');
  return found;
};

const doorsOfRole = (ask: Ask, log: string[] = []): Doors => {
  const real = doorsOf(sessionAs(ask, 'gabriel_research'), sessionAs(ask, 'gabriel_app'));
  return {
    send: (items) => {
      log.push('send');
      return real.send(items);
    },
    waiting: (ids) => real.waiting(ids),
    rejectRelation: (id, note) => {
      log.push('reject');
      return real.rejectRelation(id, note);
    },
    rejectUnit: (id, note) => {
      log.push('reject');
      return real.rejectUnit(id, note);
    },
  };
};

const PENDING_DWT = `SELECT id::text AS id FROM public.proposals
  WHERE status = 'pending' AND payload->'attrs' ? 'capacity_dwt'`;

test('a re-key sends the corrected acts, sends again the linked acts, and then rejects the old acts', async () => {
  const done = await rolledBack('superuser', async (ask) => {
    const fixture = await plant(ask);
    const group = await groupOf(ask, fixture);
    const log: string[] = [];
    const result = await apply(group, doorsOfRole(ask, log));
    return {
      fixture,
      group,
      log,
      result,
      old: await stateOf(ask, [
        fixture.ship,
        fixture.company,
        fixture.between,
        fixture.owner,
        fixture.place,
      ]),
      fresh: z
        .array(z.object({ id: z.string() }))
        .parse(await ask(PENDING_DWT))
        .map((one) => one.id),
      later: await readGroups(sessionAs(ask, 'gabriel_app'), UNIQUE_KEYS, DRIFTED_KEYS),
    };
  });
  const { fixture, log, result, old } = done;
  expect(result).toMatchObject({ status: 'done', rejected: 3 });
  // The order: every send comes before the first rejection.
  expect(log.indexOf('reject')).toBeGreaterThan(log.lastIndexOf('send'));
  const status = Object.fromEntries(old.map((one) => [one.id, one]));
  // The vessel and both relations are rejected as `other`, with a note that names the new act.
  for (const id of [fixture.ship, fixture.between, fixture.owner]) {
    expect(status[id]).toMatchObject({
      status: 'rejected',
      reject_reason: 'other',
      decided_by: 'script rekey-attributes',
    });
    expect(status[id]?.reject_note).toMatch(/^re-keyed: replaced by the act [0-9a-f-]{36}$/u);
  }
  // The place of another batch goes with the unit of its vessel, and the database words its reason.
  expect(status[fixture.place]).toMatchObject({
    status: 'rejected',
    reject_reason: 'end_rejected',
  });
  // The company is right: it stays, and its copy is the same act.
  expect(status[fixture.company]?.status).toBe('pending');
  // One new vessel waits with the canonical key, and nothing else is left to do.
  expect(done.fresh).toHaveLength(1);
  expect(done.later.filter((one) => one.moved.length > 0)).toHaveLength(0);
});

test('a second run finds nothing, and a group that was sent already is not sent twice', async () => {
  const done = await rolledBack('superuser', async (ask) => {
    const fixture = await plant(ask);
    const real = doorsOfRole(ask);
    const total = async (): Promise<number> =>
      z
        .array(z.object({ n: z.number() }))
        .parse(
          await ask('SELECT count(*)::int AS n FROM public.proposals WHERE src::text[] @> $1', [
            [DOC],
          ]),
        )[0]?.n ?? 0;
    // The first run stops before the first rejection: the new acts and the old acts all wait.
    const stop = () => Promise.reject(new Error('stop'));
    await apply(await groupOf(ask, fixture), {
      ...real,
      rejectRelation: stop,
      rejectUnit: stop,
    }).catch(() => undefined);
    const afterStop = await total();
    const second = await apply(await groupOf(ask, fixture), real);
    const afterSecond = await total();
    const third = (
      await readGroups(sessionAs(ask, 'gabriel_app'), UNIQUE_KEYS, DRIFTED_KEYS)
    ).filter((one) => one.moved.some((act) => act.id === fixture.ship));
    return { afterStop, afterSecond, second, third };
  });
  expect(done.afterSecond).toBe(done.afterStop);
  expect(done.second).toMatchObject({ status: 'done', rejected: 3 });
  expect(done.third).toHaveLength(0);
});

test('a rejection that fails half way is reported, and a second run ends it', async () => {
  const done = await rolledBack('superuser', async (ask) => {
    const fixture = await plant(ask);
    const real = doorsOfRole(ask);
    const stop = () => Promise.reject(new Error('stop'));
    const first = await apply(await groupOf(ask, fixture), { ...real, rejectUnit: stop });
    const second = await apply(await groupOf(ask, fixture), real);
    return { first, second, old: await stateOf(ask, [fixture.ship, fixture.between]) };
  });
  expect(done.first).toMatchObject({ status: 'refused', rejected: 2 });
  expect(done.second.status).toBe('done');
  expect(done.old.map((one) => one.status)).toStrictEqual(['rejected', 'rejected']);
});

test('a poor excerpt is replaced by a passage of the stored page, and the re-key goes on', async () => {
  const done = await rolledBack('superuser', async (ask) => {
    const fixture = await plant(ask, 'gross_tonnage_t', 'NAYARA lies at Sikka', 42500);
    const group = await groupOf(ask, fixture);
    const result = await apply(group, doorsOfRole(ask));
    const [fresh] = z.array(z.object({ gt: z.number() })).parse(
      await ask(
        `SELECT (payload->'attrs'->'gross_tonnage_gt'->>'v')::int AS gt FROM public.proposals
            WHERE status = 'pending' AND payload->'attrs' ? 'gross_tonnage_gt'`,
      ),
    );
    return { held: group.held, extra: group.extra.get(fixture.ship), result, fresh };
  });
  expect(done.held).toBeNull();
  expect(done.extra?.map((one) => one.excerpt)).toEqual(['Gross tonnage (t)\n42 500']);
  expect(done.result.status).toBe('done');
  expect(done.fresh?.gt).toBe(42500);
});

test('a group with a number that the page does not label is held, and nothing is sent', async () => {
  const done = await rolledBack('superuser', async (ask) => {
    const fixture = await plant(ask, 'dwt_t', 'a tonnage of 115000 t', 777000);
    const group = await groupOf(ask, fixture);
    const log: string[] = [];
    return { group, result: await apply(group, doorsOfRole(ask, log)), log };
  });
  expect(done.group.held).not.toBeNull();
  expect(done.result.status).toBe('held');
  expect(done.log).toStrictEqual([]);
});

test('a refusal of the door leaves the old acts as they are', async () => {
  const done = await rolledBack('superuser', async (ask) => {
    const fixture = await plant(ask);
    const group = await groupOf(ask, fixture);
    const real = doorsOfRole(ask);
    const refusing: Doors = {
      ...real,
      send: () => Promise.resolve({ ok: false, refusal: 'a refusal' }),
    };
    return { result: await apply(group, refusing), old: await stateOf(ask, [fixture.ship]) };
  });
  expect(done.result).toMatchObject({ status: 'refused', rejected: 0 });
  expect(done.old[0]?.status).toBe('pending');
});
