// The unit of decision and the proposer of each act, as the door stamps them, and the page of the
// queue that the operator reads. Each case runs inside a transaction that rolls back, so the census
// tests count the same rows before and after.

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { V1_ORIGINATOR, V1_TITLE } from './v1-orbat.ts';
import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_unit_of_decision';
const OTHER = 'doc_unit_of_decision_other';
const EXTRACTOR = 'unit-of-decision-test@1';
const PAGE =
  'line one\nline two\nline three: the 5th Army holds Chita\nline four\nline five\nline six';
const CITED = { start: PAGE.indexOf('the 5th'), end: PAGE.indexOf(' holds') };

const PUT = `SELECT public.put_document($1, 'file', $3, $2, NULL, NULL, NULL, 'text/plain',
  '2026-10-07'::date)`;
const TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';
const CALL = `SELECT public.record_model_call('extractor', 'v2', 'openrouter', 'a-model', $1, 120,
  'ok', NULL, 'a-model', 10, 5) AS id`;
const BATCH = 'SELECT item, proposal_id FROM public.propose_batch($1::jsonb) ORDER BY item';

const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

const seed = async (ask: Ask): Promise<string> => {
  await ask(PUT, [DOC, 'raw/unit-of-decision.txt', V1_TITLE]);
  await ask(TEXT, [DOC, JSON.stringify([PAGE]), EXTRACTOR]);
  await ask(PUT, [OTHER, 'raw/unit-of-decision-other.txt', 'A page that a session found']);
  await ask(TEXT, [OTHER, JSON.stringify([PAGE]), EXTRACTOR]);
  const [call] = z
    .array(z.object({ id: z.uuid() }))
    .parse(await as(ask, 'gabriel_agent', () => ask(CALL, ['e'.repeat(64)])));
  if (call === undefined) throw new Error('the door recorded no call');
  return call.id;
};

type Item = Record<string, unknown>;

const cited = (change: Item): Item => ({
  src: [DOC],
  names: [],
  model_call_id: null,
  originator: V1_ORIGINATOR,
  modality: 'asserts',
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, ...CITED }],
  ...change,
});

const entity = (id: string, label: string): Item =>
  cited({
    id,
    op: 'create_entity',
    payload: { type: 'military_unit', label, sources: [DOC] },
  });

const subordinate = (id: string, child: string, parent: string): Item =>
  cited({
    id,
    op: 'create_relation',
    payload: { type: 'subordinate_to', src_id: child, dst_id: parent, sources: [DOC] },
    names: [child, parent],
  });

const batch = (ask: Ask, role: string, items: readonly Item[]) =>
  as(ask, role, () => ask(BATCH, [JSON.stringify(items)]));

const stamped = z.array(z.object({ id: z.uuid(), unit_id: z.uuid(), proposer: z.string() }));

const stampsOf = async (ask: Ask, ids: readonly string[]) =>
  new Map(
    stamped
      .parse(
        await ask('SELECT id, unit_id, proposer FROM public.proposals WHERE id = ANY($1::uuid[])', [
          ids,
        ]),
      )
      .map((row) => [row.id, row]),
  );

// The v1 shape: a top formation in one group, and a tree under it in a second group. The child
// owns its link to its parent in its own group. The link from the second group to the top
// formation crosses two groups, so it is a unit of its own and no entity waits for it.
test('the child owns each relation of its group, and a relation across two groups is a link unit', async () => {
  const top = randomUUID();
  const army = randomUUID();
  const brigade = randomUUID();
  const armyToTop = randomUUID();
  const brigadeToArmy = randomUUID();
  const stamps = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, 'gabriel_research', [entity(top, 'Eastern Military District')]);
    // The relation comes before the entity that owns it, and the door still finds that entity.
    await batch(ask, 'gabriel_research', [
      subordinate(brigadeToArmy, brigade, army),
      entity(army, '5th Army'),
      subordinate(armyToTop, army, top),
      entity(brigade, '57th Brigade'),
    ]);
    return stampsOf(ask, [top, army, brigade, armyToTop, brigadeToArmy]);
  });
  expect(stamps.get(top)?.unit_id).toBe(top);
  expect(stamps.get(army)?.unit_id).toBe(army);
  expect(stamps.get(brigade)?.unit_id).toBe(brigade);
  expect(stamps.get(brigadeToArmy)?.unit_id).toBe(brigade);
  expect(stamps.get(armyToTop)?.unit_id).toBe(armyToTop);
});

test('a relation whose source is in the record belongs to its target end in the group', async () => {
  const fresh = randomUUID();
  const link = randomUUID();
  const stamps = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const [row] = z
      .array(z.object({ id: z.uuid() }))
      .parse(await ask('SELECT id FROM public.entities ORDER BY id LIMIT 1'));
    if (row === undefined) throw new Error('the fixture holds no entity');
    const held = row.id;
    await batch(ask, 'gabriel_research', [
      entity(fresh, '6th Army'),
      subordinate(link, held, fresh),
    ]);
    return stampsOf(ask, [link]);
  });
  expect(stamps.get(link)?.unit_id).toBe(fresh);
});

test('the proposer is the v1 import, the research AI or the extractor', async () => {
  const v1 = randomUUID();
  const research = randomUUID();
  const extracted = randomUUID();
  const stamps = await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    await batch(ask, 'gabriel_research', [entity(v1, 'A unit of the v1 work')]);
    await batch(ask, 'gabriel_research', [
      { ...entity(research, 'A unit that a session found'), originator: 'A ministry' },
    ]);
    await batch(ask, 'gabriel_agent', [
      { ...entity(extracted, 'A unit that a page states'), model_call_id: call },
    ]);
    return stampsOf(ask, [v1, research, extracted]);
  });
  expect([v1, research, extracted].map((id) => stamps.get(id)?.proposer)).toStrictEqual([
    'v1_import',
    'research_ai',
    'extractor',
  ]);
});

const end = z
  .object({ name: z.string().nullable(), state: z.string(), group: z.string().nullable() })
  .nullable();
const page = z.object({
  total: z.number(),
  next: z.array(z.string()).nullable(),
  units: z.array(
    z.object({
      unit: z.uuid(),
      kind: z.string(),
      name: z.string(),
      type: z.string().nullable(),
      proposer: z.string(),
      group: z.object({ id: z.uuid(), subject: z.string().nullable() }).nullable(),
      acts: z.array(z.object({ id: z.uuid(), op: z.string(), src: end, dst: end })),
      documents: z.array(z.object({ id: z.string(), title: z.string() })),
      passages: z.array(
        z.object({
          act: z.uuid(),
          supports: z.string(),
          ownLine: z.boolean(),
          before: z.string(),
          text: z.string(),
          after: z.string(),
        }),
      ),
    }),
  ),
});
type Page = z.output<typeof page>;

const READ = 'SELECT public.review_units($1::text[], $2::int) AS page';

const readPage = async (ask: Ask, after: readonly string[] | null, size: number): Promise<Page> => {
  const [row] = z.array(z.object({ page })).parse(await ask(READ, [after, size]));
  if (row === undefined) throw new Error('the read gave no row');
  return row.page;
};

const everyPage = async (ask: Ask, size: number): Promise<readonly Page['units'][number][]> => {
  const units: Page['units'][number][] = [];
  let after: readonly string[] | null = null;
  for (;;) {
    const read = await readPage(ask, after, size);
    units.push(...read.units);
    if (read.next === null) return units;
    after = read.next;
  }
};

test('the queue comes in pages of units, each with its acts, its group and its passages', async () => {
  const top = randomUUID();
  const army = randomUUID();
  const armyToTop = randomUUID();
  const brigade = randomUUID();
  const brigadeToArmy = randomUUID();
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, 'gabriel_research', [entity(top, 'Eastern Military District')]);
    await batch(ask, 'gabriel_research', [
      entity(army, '5th Army'),
      subordinate(armyToTop, army, top),
      entity(brigade, '57th Brigade'),
      subordinate(brigadeToArmy, brigade, army),
    ]);
    return as(ask, 'gabriel_app', async () => ({
      whole: await readPage(ask, null, 200),
      paged: await everyPage(ask, 2),
    }));
  });

  // A page of two, read to the end, gives each unit once and in the order of one long page.
  expect(read.paged.map((unit) => unit.unit)).toStrictEqual(
    read.whole.units.map((unit) => unit.unit),
  );
  expect(read.paged).toHaveLength(read.whole.total);

  const brigadeUnit = read.paged.find((unit) => unit.unit === brigade);
  expect(brigadeUnit).toMatchObject({
    kind: 'entity',
    name: '57th Brigade',
    type: 'military_unit',
    proposer: 'v1_import',
    group: { subject: '5th Army' },
    documents: [{ id: DOC }],
  });
  expect(brigadeUnit?.acts.map((act) => act.op)).toStrictEqual([
    'create_entity',
    'create_relation',
  ]);
  expect(brigadeUnit?.acts[1]?.dst).toStrictEqual({
    name: '5th Army',
    state: 'pending',
    group: expect.any(String) as string,
  });
  expect(brigadeUnit?.passages[0]).toMatchObject({
    before: 'line one\nline two\nline three: ',
    text: 'the 5th Army',
    after: ' holds Chita\nline four\nline five',
  });
  // Each passage names the act that it supports. A line of the v1 import is the line of its own
  // unit, and the lines around it state other units.
  expect(
    brigadeUnit?.passages.map(({ act, supports, ownLine }) => ({ act, supports, ownLine })),
  ).toStrictEqual(
    [
      { act: brigade, supports: '57th Brigade', ownLine: true },
      { act: brigadeToArmy, supports: '57th Brigade subordinate to 5th Army', ownLine: true },
    ].sort((one, other) => (one.act < other.act ? -1 : 1)),
  );

  const link = read.paged.find((unit) => unit.unit === armyToTop);
  expect(link).toMatchObject({
    kind: 'link',
    name: '5th Army subordinate to Eastern Military District',
  });
});

// The research role reads the page as an AI reviewer. The worker and the public read do not.
test('only the operator and the AI reviewer read the page of the queue', async () => {
  for (const identity of ['read', 'agent'] as const)
    await expect(rolledBack(identity, (ask) => ask(READ, [null, 1]))).rejects.toMatchObject({
      code: '42501',
    });
  await expect(rolledBack('research', (ask) => ask(READ, [null, 1]))).resolves.toHaveLength(1);
});

test('only an item that cites the stored v1 ORBAT may name the originator of the v1 import', async () => {
  const cause = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    return batch(ask, 'gabriel_research', [
      {
        ...entity(randomUUID(), 'A unit that a session found'),
        src: [OTHER],
        citations: [{ document: OTHER, text_extractor: EXTRACTOR, page: 1, ...CITED }],
      },
    ]);
  }).then(
    () => null,
    (error: unknown) => error,
  );
  expect(cause).toMatchObject({
    code: '22023',
    message: expect.stringMatching(/belongs to the import of the v1 work/u) as string,
  });
});

test('a relation whose end is a relation of the record is a unit of its own', async () => {
  const army = randomUUID();
  const link = randomUUID();
  const stamps = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const [row] = z
      .array(z.object({ id: z.uuid() }))
      .parse(await ask('SELECT id FROM public.relations ORDER BY id LIMIT 1'));
    if (row === undefined) throw new Error('the fixture holds no relation');
    await batch(ask, 'gabriel_research', [
      entity(army, '7th Army'),
      cited({
        id: link,
        op: 'create_relation',
        payload: {
          type: 'contradicts',
          src_id: army,
          dst_id: row.id,
          dst_kind: 'relation',
          sources: [DOC],
        },
        names: [army, row.id],
      }),
    ]);
    return stampsOf(ask, [link]);
  });
  expect(stamps.get(link)?.unit_id).toBe(link);
});

const MIGRATION = join(import.meta.dirname, '..', 'db', 'migrations', '0052_unit_of_decision.sql');

// The state before 0052: no proposer and no unit. The proposer reads the originator, and the view
// reads the proposer, so the view goes with it inside the transaction that rolls back.
const BEFORE_0052 = `
  SET LOCAL ROLE gabriel_owner;
  ALTER TABLE proposals DROP COLUMN proposer CASCADE;
  ALTER TABLE proposals DROP COLUMN unit_id;
  RESET ROLE;`;

const REJECTED = `
  ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only;
  UPDATE public.proposals SET status = 'rejected', decided_at = now(), decided_by = 'a test'
   WHERE id = $1::uuid;
  ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only;`;

test('the migration gives the acts of the record their unit by the rule of the door', async () => {
  const top = randomUUID();
  const corps = randomUUID();
  const corpsToTop = randomUUID();
  const army = randomUUID();
  const armyToTop = randomUUID();
  const brigade = randomUUID();
  const brigadeToArmy = randomUUID();
  const gone = randomUUID();
  const goneToArmy = randomUUID();
  const stamps = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, 'gabriel_research', [
      entity(top, 'Eastern Military District'),
      entity(corps, '68th Army Corps'),
      subordinate(corpsToTop, corps, top),
    ]);
    await batch(ask, 'gabriel_research', [
      entity(army, '5th Army'),
      subordinate(armyToTop, army, top),
      entity(brigade, '57th Brigade'),
      subordinate(brigadeToArmy, brigade, army),
      entity(gone, '58th Brigade'),
      subordinate(goneToArmy, gone, army),
    ]);
    // A source end that the operator rejected no longer owns its relation, which then goes to
    // its target end in the group.
    for (const statement of REJECTED.split(';').filter((part) => part.trim() !== ''))
      await ask(statement, statement.includes('$1') ? [gone] : undefined);
    await ask(BEFORE_0052);
    await ask(await readFile(MIGRATION, 'utf8'));
    return stampsOf(ask, [corpsToTop, armyToTop, brigadeToArmy, goneToArmy, top, brigade]);
  });
  expect(stamps.get(corpsToTop)?.unit_id).toBe(corps);
  expect(stamps.get(armyToTop)?.unit_id).toBe(armyToTop);
  expect(stamps.get(brigadeToArmy)?.unit_id).toBe(brigade);
  expect(stamps.get(goneToArmy)?.unit_id).toBe(army);
  expect(stamps.get(top)?.unit_id).toBe(top);
  expect(stamps.get(brigade)?.proposer).toBe('v1_import');
});

test('a group with no tree is named by its document, and a circle by its first entity', async () => {
  const [ship, owner, owns, alpha, beta, up, down] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const found = (item: Item): Item => ({
    ...item,
    src: [OTHER],
    originator: 'A ministry',
    citations: [{ document: OTHER, text_extractor: EXTRACTOR, page: 1, ...CITED }],
    payload: { ...(item['payload'] as Item), sources: [OTHER] },
  });
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, 'gabriel_research', [
      found(entity(ship, 'A tanker')),
      found(entity(owner, 'An owner')),
      found(
        cited({
          id: owns,
          op: 'create_relation',
          payload: { type: 'owns', src_id: owner, dst_id: ship },
          names: [owner, ship],
        }),
      ),
    ]);
    await batch(ask, 'gabriel_research', [
      entity(beta, 'Circle beta'),
      entity(alpha, 'Circle alpha'),
      subordinate(up, alpha, beta),
      subordinate(down, beta, alpha),
    ]);
    return as(ask, 'gabriel_app', () => readPage(ask, null, 200));
  });
  const unitOf = (id: string) => read.units.find((unit) => unit.unit === id);
  expect(unitOf(ship)?.group?.subject).toBe('A page that a session found');
  expect(unitOf(ship)?.passages.map((passage) => passage.ownLine)).toStrictEqual([false]);
  expect(unitOf(alpha)?.group?.subject).toBe('Circle alpha');
});
