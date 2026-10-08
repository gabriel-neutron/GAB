// The group action, the rail of the groups and the read of one group, through the doors of the
// writer against the test database. A unit is not decided by the transaction that proposed it, so
// each statement commits on its own, and each test undoes what it wrote.

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, expect, test } from 'vitest';
import { z } from 'zod';

import { openPool, roleAddress } from './pool.ts';
import { writeRoutes } from './routes.ts';

const pool = openPool();
const NO_STORE = { put: () => Promise.reject(new Error('no act door reaches the raw store')) };
const NO_READ = { read: () => Promise.reject(new Error('no act door reads the raw store')) };
const app = writeRoutes(pool, NO_STORE, NO_READ);

// A research AI proposes a linked batch through its own door, as the MCP server does.
const research = new Pool({
  connectionString: roleAddress('gabriel_research', 'GABRIEL_RESEARCH_PASSWORD'),
});

afterAll(async () => {
  await research.end();
  await pool.end();
});

const ask = async (door: string, body: unknown): Promise<[number, unknown]> => {
  const answer = await app.request(door, {
    method: 'POST',
    headers: { host: '127.0.0.1:5177', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return [answer.status, await answer.json()];
};

const one = async (text: string, values: readonly unknown[]): Promise<Record<string, unknown>> => {
  const found = await pool.query<Record<string, unknown>>(text, [...values]);
  return found.rows[0] ?? {};
};

interface Item {
  readonly id: string;
  readonly op: 'create_entity' | 'create_relation';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly names?: readonly string[];
  readonly dissent?: boolean;
  readonly dissent_reason?: string;
}

// The fixture gives each cited document one page of text, so each item cites its first letter.
const proposedBatch = async (items: readonly Item[]): Promise<void> => {
  const page = await one(
    'SELECT document_id, extractor FROM public.document_text WHERE page = 1 LIMIT 1',
    [],
  );
  await research.query('SELECT proposal_id FROM public.propose_batch($1::jsonb)', [
    JSON.stringify(
      items.map((item) => ({
        ...item,
        names: item.names ?? [],
        src: [page['document_id']],
        originator: 'A group test',
        modality: 'asserts',
        citations: [
          {
            document: page['document_id'],
            text_extractor: page['extractor'],
            page: 1,
            start: 0,
            end: 1,
          },
        ],
      })),
    ),
  ]);
};

const unit = (id: string, label: string, extra: Partial<Item> = {}): Item => ({
  id,
  op: 'create_entity',
  payload: { type: 'military_unit', label },
  ...extra,
});

const under = (id: string, child: string, parent: string): Item => ({
  id,
  op: 'create_relation',
  payload: { type: 'subordinate_to', src_id: child, dst_id: parent },
  names: [child, parent],
});

const batchOf = async (proposalId: string): Promise<string> =>
  z
    .string()
    .parse(
      (await one('SELECT batch_id FROM public.proposals WHERE id = $1::uuid', [proposalId]))[
        'batch_id'
      ],
    );

const DECISION_OF = 'SELECT status, decided_as FROM public.proposals WHERE id = $1::uuid';

const decisionOf = async (proposalId: string): Promise<Record<string, unknown>> =>
  one(DECISION_OF, [proposalId]);

const LIVE_ROWS =
  'SELECT (SELECT count(*) FROM public.entities WHERE id = $1::uuid)' +
  ' + (SELECT count(*) FROM public.relations WHERE id = $1::uuid) AS n';

const liveRows = async (targetId: string): Promise<number> =>
  Number((await one(LIVE_ROWS, [targetId]))['n']);

const results = z.object({
  results: z.array(
    z.object({
      unit: z.uuid(),
      name: z.string(),
      outcome: z.enum(['promoted', 'refused']),
      said: z.string().nullable(),
    }),
  ),
});

const promoteGroup = async (groupId: string, unitIds: readonly string[]) => {
  const [status, reply] = await ask('/write/promote-group', { groupId, unitIds });
  expect(status).toBe(200);
  return results.parse(reply).results;
};

// Every promoted row goes again through the doors of the operator, the relations first, and every
// unit that still waits is rejected, so the record ends where it began.
const undone = async (promoted: readonly string[], waiting: readonly string[]) => {
  for (const targetId of promoted) {
    await ask('/write/delete-relation', { targetId });
    await ask('/write/delete-entity', { targetId });
    expect({ targetId, live: await liveRows(targetId) }).toStrictEqual({ targetId, live: 0 });
  }
  for (const unitId of waiting) await ask('/write/reject-unit', { unitId, reason: 'out_of_scope' });
};

test('a group action writes only the listed clean units, a parent before its child', async () => {
  const [army, brigade, toArmy, battalion, toBrigade, late, toLate, disputed, toDisputed] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  await proposedBatch([
    unit(army, 'Group test army'),
    unit(brigade, 'Group test brigade'),
    under(toArmy, brigade, army),
    unit(battalion, 'Group test battalion'),
    under(toBrigade, battalion, brigade),
    unit(late, 'Group test late'),
    under(toLate, late, army),
    unit(disputed, 'Group test disputed', { dissent: true, dissent_reason: 'two readings' }),
    under(toDisputed, disputed, army),
  ]);
  const group = await batchOf(army);
  let read: Awaited<ReturnType<typeof promoteGroup>> = [];
  try {
    // The screen showed four units, the child before its parent. The unit "late" came after the
    // view, so it is not in the list.
    read = await promoteGroup(group, [battalion, brigade, army, disputed]);
    expect(read).toStrictEqual([
      {
        unit: disputed,
        name: 'Group test disputed',
        outcome: 'refused',
        said: 'Not clean: Disputed: two readings',
      },
      { unit: army, name: 'Group test army', outcome: 'promoted', said: null },
      { unit: brigade, name: 'Group test brigade', outcome: 'promoted', said: null },
      { unit: battalion, name: 'Group test battalion', outcome: 'promoted', said: null },
    ]);
    for (const id of [army, brigade, toArmy, battalion, toBrigade])
      expect(await decisionOf(id)).toStrictEqual({ status: 'accepted', decided_as: 'group' });
    for (const id of [late, toLate, disputed, toDisputed])
      expect(await decisionOf(id)).toStrictEqual({ status: 'pending', decided_as: null });
  } finally {
    await undone(
      read.some((one) => one.outcome === 'promoted')
        ? [toBrigade, toArmy, battalion, brigade, army]
        : [],
      [late, disputed],
    );
  }
});

test('a unit whose parent fails in the same action is refused, and the refusal names the parent', async () => {
  const [army, brigade, toArmy] = [randomUUID(), randomUUID(), randomUUID()];
  await proposedBatch([
    unit(army, 'Group test failed army', { dissent: true, dissent_reason: 'unclear' }),
    unit(brigade, 'Group test orphan brigade'),
    under(toArmy, brigade, army),
  ]);
  try {
    const read = await promoteGroup(await batchOf(army), [army, brigade]);
    expect(read).toStrictEqual([
      {
        unit: army,
        name: 'Group test failed army',
        outcome: 'refused',
        said: 'Not clean: Disputed: unclear',
      },
      {
        unit: brigade,
        name: 'Group test orphan brigade',
        outcome: 'refused',
        said:
          'nothing of the unit is promoted, because its relation subordinate_to waits for ' +
          'Group test failed army, which is not in the record',
      },
    ]);
    expect(await liveRows(brigade)).toBe(0);
  } finally {
    await undone([], [brigade, army]);
  }
});

test('a unit decided before the action, or of another group, is refused and written by nobody', async () => {
  const [kept, decided, toKept, foreign, near, toForeign] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  await proposedBatch([
    unit(kept, 'Group test kept'),
    unit(decided, 'Group test decided'),
    under(toKept, decided, kept),
  ]);
  await proposedBatch([
    unit(foreign, 'Group test foreign'),
    unit(near, 'Group test near'),
    under(toForeign, near, foreign),
  ]);
  await ask('/write/reject-unit', { unitId: decided, reason: 'duplicate' });
  let read: Awaited<ReturnType<typeof promoteGroup>> = [];
  try {
    read = await promoteGroup(await batchOf(kept), [kept, decided, foreign]);
    expect(read.map(({ unit: id, outcome, said }) => ({ id, outcome, said }))).toStrictEqual([
      { id: decided, outcome: 'refused', said: 'The unit is decided already' },
      { id: foreign, outcome: 'refused', said: 'The unit is not in this group' },
      { id: kept, outcome: 'promoted', said: null },
    ]);
    expect(await decisionOf(foreign)).toStrictEqual({ status: 'pending', decided_as: null });
  } finally {
    await undone(read.some((one) => one.outcome === 'promoted') ? [kept] : [], [
      near,
      foreign,
      kept,
    ]);
  }
});

test('a child whose parent is in the group but not in the list is refused, and the refusal names the parent', async () => {
  const [army, brigade, toArmy] = [randomUUID(), randomUUID(), randomUUID()];
  await proposedBatch([
    unit(army, 'Group test unlisted army'),
    unit(brigade, 'Group test listed brigade'),
    under(toArmy, brigade, army),
  ]);
  try {
    const read = await promoteGroup(await batchOf(army), [brigade]);
    expect(read).toStrictEqual([
      {
        unit: brigade,
        name: 'Group test listed brigade',
        outcome: 'refused',
        said:
          'nothing of the unit is promoted, because its relation subordinate_to waits for ' +
          'Group test unlisted army, which is not in the record',
      },
    ]);
    for (const id of [army, brigade, toArmy])
      expect(await decisionOf(id)).toStrictEqual({ status: 'pending', decided_as: null });
    expect([await liveRows(brigade), await liveRows(toArmy)]).toStrictEqual([0, 0]);
  } finally {
    await undone([], [brigade, army]);
  }
});

test('a group action that names no unit is refused before the record is reached', async () => {
  const [status, reply] = await ask('/write/promote-group', {
    groupId: randomUUID(),
    unitIds: [],
  });
  expect([status, reply]).toStrictEqual([
    422,
    { refusal: 'the body names one group and the units of it that the screen showed' },
  ]);
});

const railLine = z.object({
  id: z.uuid(),
  subject: z.string().nullable(),
  proposer: z.string(),
  document: z.object({ id: z.string(), title: z.string() }).nullable(),
  units: z.number().int(),
  clean: z.number().int(),
  faults: z.record(z.string(), z.number().int()),
});

const groupUnit = z.object({
  unit: z.uuid(),
  kind: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  state: z.enum(['clean', 'not_clean', 'blocked']),
  faults: z.array(z.object({ kind: z.string(), level: z.string() })),
  entities: z.number().int(),
  relations: z.number().int(),
  writable: z.boolean(),
  parent: z.object({ unit: z.uuid().nullable(), name: z.string() }).nullable(),
});

test('the rail counts the units of each group, and the read of one group gives its tree', async () => {
  const [army, brigade, toArmy, disputed, toDisputed, below, toBelow] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  await proposedBatch([
    unit(army, 'Rail test army'),
    unit(brigade, 'Rail test brigade'),
    under(toArmy, brigade, army),
    unit(disputed, 'Rail test disputed', { dissent: true, dissent_reason: 'unclear' }),
    under(toDisputed, disputed, army),
    unit(below, 'Rail test below the disputed'),
    under(toBelow, below, disputed),
  ]);
  const group = await batchOf(army);
  try {
    const [status, rail] = await ask('/private/review-groups', {});
    expect(status).toBe(200);
    const line = z
      .object({ groups: z.array(railLine) })
      .parse(rail)
      .groups.find((held) => held.id === group);
    expect(line).toMatchObject({
      subject: 'Rail test army',
      proposer: 'research_ai',
      // The unit below the disputed one is clean, but the action cannot write it.
      units: 4,
      clean: 2,
      faults: { dispute: 1 },
    });
    expect(line?.document).not.toBeNull();

    const [readStatus, read] = await ask('/private/review-group', { groupId: group });
    expect(readStatus).toBe(200);
    const units = z
      .object({ id: z.uuid(), subject: z.string().nullable(), units: z.array(groupUnit) })
      .parse(read);
    expect(units.subject).toBe('Rail test army');
    const byId = new Map(units.units.map((held) => [held.unit, held] as const));
    expect(byId.get(brigade)).toMatchObject({
      name: 'Rail test brigade',
      type: 'military_unit',
      state: 'clean',
      entities: 1,
      relations: 1,
      writable: true,
      parent: { unit: army, name: 'Rail test army' },
    });
    // The unit below the disputed one is clean, and the action cannot write it.
    expect(byId.get(below)).toMatchObject({ state: 'clean', writable: false });
    expect(byId.get(disputed)).toMatchObject({ state: 'not_clean', writable: false });
    expect(byId.get(army)).toMatchObject({ entities: 1, relations: 0, parent: null });
    expect(byId.get(disputed)?.faults).toContainEqual({ kind: 'dispute', level: 'not_clean' });
  } finally {
    await undone([], [brigade, below, disputed, army]);
  }
});

test('the read of a group that waits for nothing is refused', async () => {
  const [status, reply] = await ask('/private/review-group', { groupId: randomUUID() });
  expect([status, reply]).toStrictEqual([422, { refusal: 'no unit of this group waits' }]);
});

// Origin of the numbers: the largest group of the v1 import on 2026-10-07 holds 104 units, an army
// with 103 units below it on two levels, and one relation to a unit of another group. The bound is
// decided, not calibrated: the operator waits for one answer, and a minute is too long.
const LEVEL_ONE = 8;
const LEVEL_TWO = 95;
const SLOWEST_MS = 20_000;

test('a group action on a group of the size of the largest v1 group answers in one wait', async ({
  annotate,
}) => {
  const district = [randomUUID(), randomUUID(), randomUUID()] as const;
  await proposedBatch([
    unit(district[0], 'Size test district'),
    unit(district[1], 'Size test district staff'),
    under(district[2], district[1], district[0]),
  ]);
  const army = randomUUID();
  const toDistrict = randomUUID();
  const firsts = Array.from({ length: LEVEL_ONE }, () => [randomUUID(), randomUUID()] as const);
  const seconds = Array.from(
    { length: LEVEL_TWO },
    (_, at) => [randomUUID(), randomUUID(), firsts[at % LEVEL_ONE]?.[0] ?? army] as const,
  );
  await proposedBatch([
    unit(army, 'Size test army'),
    under(toDistrict, army, district[0]),
    ...firsts.flatMap(([id, link], at) => [
      unit(id, `Size test division ${String(at)}`),
      under(link, id, army),
    ]),
    ...seconds.flatMap(([id, link, parent], at) => [
      unit(id, `Size test regiment ${String(at)}`),
      under(link, id, parent),
    ]),
  ]);
  const group = await batchOf(army);
  const entities = [army, ...firsts.map(([id]) => id), ...seconds.map(([id]) => id)];
  let read: Awaited<ReturnType<typeof promoteGroup>> = [];
  try {
    const began = performance.now();
    read = await promoteGroup(group, entities);
    const took = Math.round(performance.now() - began);
    await annotate(`a group action of ${String(entities.length)} units took ${String(took)} ms`);
    expect(read.filter((one) => one.outcome === 'promoted')).toHaveLength(entities.length);
    expect(took).toBeLessThan(SLOWEST_MS);
    // The relation to the district waits for a unit of another group, so it stays in the queue.
    expect(await decisionOf(toDistrict)).toStrictEqual({ status: 'pending', decided_as: null });
  } finally {
    const written = new Set(
      read.filter((one) => one.outcome === 'promoted').map((one) => one.unit),
    );
    await undone(
      [
        ...seconds.flatMap(([id, link]) => (written.has(id) ? [link, id] : [])),
        ...firsts.flatMap(([id, link]) => (written.has(id) ? [link, id] : [])),
        ...(written.has(army) ? [army] : []),
      ],
      [toDistrict, ...entities.filter((id) => !written.has(id)), district[1], district[0]],
    );
  }
});

test('a child whose rejected parent took its link with it is not written by the group action', async () => {
  const [army, brigade, toArmy, sister] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await proposedBatch([
    unit(army, 'Group test rejected army'),
    unit(brigade, 'Group test brigade of the rejected army'),
    under(toArmy, brigade, army),
    unit(sister, 'Group test sister'),
    under(randomUUID(), sister, brigade),
  ]);
  const group = await batchOf(army);
  try {
    // "end rejected" is refused while the other end waits.
    expect(
      await ask('/write/reject-relation', { proposalId: toArmy, reason: 'end_rejected' }),
    ).toMatchObject([422, {}]);
    expect((await ask('/write/reject-unit', { unitId: army, reason: 'duplicate' }))[0]).toBe(200);
    expect(
      (await ask('/write/reject-relation', { proposalId: toArmy, reason: 'end_rejected' }))[0],
    ).toBe(200);
    const read = await promoteGroup(group, [brigade]);
    expect(read).toStrictEqual([
      {
        unit: brigade,
        name: 'Group test brigade of the rejected army',
        outcome: 'refused',
        said: expect.stringMatching(
          /^Not clean: Its parent Group test rejected army was rejected on \d{4}-\d{2}-\d{2}$/u,
        ) as string,
      },
    ]);
    expect(await decisionOf(brigade)).toStrictEqual({ status: 'pending', decided_as: null });
  } finally {
    await undone([], [sister, brigade]);
  }
});

test('each decision answers what it wrote or rejected: the name and the counts', async () => {
  const [army, brigade, toArmy, corps, toCorps] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  await proposedBatch([
    unit(army, 'Said test army'),
    unit(brigade, 'Said test brigade'),
    under(toArmy, brigade, army),
    unit(corps, 'Said test corps'),
    under(toCorps, corps, army),
  ]);
  const promoted: string[] = [];
  try {
    const [rejectStatus, relation] = await ask('/write/reject-relation', {
      proposalId: toCorps,
      reason: 'wrong_value',
    });
    expect(rejectStatus).toBe(200);
    expect(relation).toMatchObject({
      targetId: null,
      written: { name: 'Said test corps subordinate to Said test army', entities: 0, relations: 1 },
    });

    const [promoteStatus, written] = await ask('/write/promote-unit', { unitId: army });
    expect(promoteStatus).toBe(200);
    promoted.push(army);
    expect(written).toMatchObject({
      state: 'decided',
      written: { name: 'Said test army', entities: 1, relations: 0, others: 0 },
    });

    const [, rejected] = await ask('/write/reject-unit', { unitId: brigade, reason: 'duplicate' });
    expect(rejected).toMatchObject({
      targetId: null,
      written: { name: 'Said test brigade', entities: 1, relations: 1, others: 0 },
    });
  } finally {
    await undone(promoted, [corps]);
  }
});

const decidedAct = z.object({
  id: z.uuid(),
  status: z.enum(['accepted', 'rejected']),
  decidedAs: z.string().nullable(),
  rejectReason: z.string().nullable(),
  rejectNote: z.string().nullable(),
  name: z.string().nullable(),
});

test('the operator reads its own rejections with the reason and the note', async () => {
  const [army, brigade, toArmy] = [randomUUID(), randomUUID(), randomUUID()];
  await proposedBatch([
    unit(army, 'Decided test army'),
    unit(brigade, 'Decided test brigade'),
    under(toArmy, brigade, army),
  ]);
  await ask('/write/reject-unit', {
    unitId: brigade,
    reason: 'other',
    note: 'The page names a ferry.',
  });
  try {
    // The two acts are the newest decisions, so two pages of one act give them, each once.
    const page = z.object({
      acts: z.array(decidedAct),
      next: z.object({ decidedAt: z.string(), id: z.uuid() }).nullable(),
    });
    const [status, reply] = await ask('/private/review-decided', { after: null, size: 1 });
    expect(status).toBe(200);
    const first = page.parse(reply);
    expect(first.next?.id).toBe(first.acts[0]?.id);
    const [, again] = await ask('/private/review-decided', { after: first.next, size: 1 });
    const acts = [...first.acts, ...page.parse(again).acts];
    expect(acts.filter((act) => act.id === brigade || act.id === toArmy)).toStrictEqual(
      [
        {
          id: brigade,
          status: 'rejected',
          decidedAs: 'unit',
          rejectReason: 'other',
          rejectNote: 'The page names a ferry.',
          name: 'Decided test brigade',
        },
        {
          id: toArmy,
          status: 'rejected',
          decidedAs: 'unit',
          rejectReason: 'other',
          rejectNote: 'The page names a ferry.',
          name: 'Decided test brigade subordinate to Decided test army',
        },
      ].sort((one, other) => (one.id < other.id ? -1 : 1)),
    );
  } finally {
    await undone([], [army]);
  }
});
