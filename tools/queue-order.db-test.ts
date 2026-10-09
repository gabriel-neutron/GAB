// The order and the filters of the review queue, as the operator reads it page by page. Each case
// runs inside a transaction that rolls back, so the census tests count the same rows before and
// after.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { ORIGINATOR, TITLE } from './v1-orbat.ts';
import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_queue_order';
const OTHER = 'doc_queue_order_other';
const EXTRACTOR = 'queue-order-test@1';
const PAGE = 'line one\nline two\nthe Qx front holds the river\nline four';
const CITED = { start: PAGE.indexOf('the Qx'), end: PAGE.indexOf(' holds') };

const PUT = `SELECT public.put_document($1, 'file', $3, $2, NULL, NULL, NULL, 'text/plain',
  '2026-10-07'::date)`;
const TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';
const BATCH = 'SELECT item, proposal_id FROM public.propose_batch($1::jsonb) ORDER BY item';
const READ = `SELECT public.review_units($1::text[], $2::int, $3::uuid, $4::text, $5::text,
  $6::text, $7::text, $8::uuid) AS page`;

const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

type Item = Record<string, unknown>;

const cited = (change: Item): Item => ({
  src: [DOC],
  names: [],
  model_call_id: null,
  originator: ORIGINATOR,
  modality: 'asserts',
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, ...CITED }],
  ...change,
});

const entity = (id: string, label: string, type = 'military_unit'): Item =>
  cited({ id, op: 'create_entity', payload: { type, label, sources: [DOC] } });

const subordinate = (id: string, child: string, parent: string): Item =>
  cited({
    id,
    op: 'create_relation',
    payload: { type: 'subordinate_to', src_id: child, dst_id: parent, sources: [DOC] },
    names: [child, parent],
  });

// An act of the research AI that cites the other document.
const researched = (id: string, label: string): Item => ({
  id,
  op: 'create_entity',
  payload: { type: 'military_unit', label, sources: [OTHER] },
  src: [OTHER],
  names: [],
  model_call_id: null,
  originator: 'A ministry',
  modality: 'asserts',
  citations: [{ document: OTHER, text_extractor: EXTRACTOR, page: 1, ...CITED }],
});

const batch = (ask: Ask, items: readonly Item[]) =>
  as(ask, 'gabriel_research', () => ask(BATCH, [JSON.stringify(items)]));

const page = z.object({
  total: z.number().int(),
  matched: z.number().int(),
  before: z.number().int(),
  next: z.array(z.string()).nullable(),
  units: z.array(
    z.object({
      unit: z.uuid(),
      name: z.string(),
      group: z.object({ id: z.uuid(), subject: z.string().nullable() }).nullable(),
    }),
  ),
  choices: z.object({
    groups: z.array(z.object({ id: z.uuid(), subject: z.string().nullable() })),
    documents: z.array(z.object({ id: z.string(), title: z.string() })),
    proposers: z.array(z.string()),
  }),
});
type Page = z.output<typeof page>;

interface Filter {
  readonly group?: string;
  readonly proposer?: string;
  readonly fault?: string;
  readonly document?: string;
  readonly name?: string;
  readonly unit?: string;
}

const readPage = async (
  ask: Ask,
  after: readonly string[] | null,
  size: number,
  filter: Filter = {},
): Promise<Page> => {
  const [row] = z
    .array(z.object({ page }))
    .parse(
      await ask(READ, [
        after,
        size,
        filter.group ?? null,
        filter.proposer ?? null,
        filter.fault ?? null,
        filter.document ?? null,
        filter.name ?? null,
        filter.unit ?? null,
      ]),
    );
  if (row === undefined) throw new Error('the read gave no row');
  return row.page;
};

const everyUnit = async (ask: Ask, size: number, filter: Filter = {}): Promise<string[]> => {
  const units: string[] = [];
  let after: readonly string[] | null = null;
  for (;;) {
    const read = await readPage(ask, after, size, filter);
    units.push(...read.units.map((unit) => unit.unit));
    if (read.next === null) return units;
    after = read.next;
  }
};

interface Seeded {
  readonly zulu: string;
  readonly yankee: string;
  readonly alpha: string;
  readonly link: string;
  readonly bravo: string;
  readonly charlie: string;
  readonly echo: string;
  readonly kilo: string;
  readonly lone: string;
}

// Two groups. The second group holds a link to the top of the first group, so the second group
// waits for the first, and the first group comes first although its subject sorts after.
const seed = async (ask: Ask): Promise<Seeded> => {
  await ask(PUT, [DOC, 'raw/queue-order.txt', TITLE]);
  await ask(TEXT, [DOC, JSON.stringify([PAGE]), EXTRACTOR]);
  await ask(PUT, [OTHER, 'raw/queue-order-other.txt', 'A page that a session found']);
  await ask(TEXT, [OTHER, JSON.stringify([PAGE]), EXTRACTOR]);
  const ids: Seeded = {
    zulu: randomUUID(),
    yankee: randomUUID(),
    alpha: randomUUID(),
    link: randomUUID(),
    bravo: randomUUID(),
    charlie: randomUUID(),
    echo: randomUUID(),
    kilo: randomUUID(),
    lone: randomUUID(),
  };
  await batch(ask, [
    entity(ids.zulu, 'Qx Zulu Front'),
    entity(ids.yankee, 'Qx Yankee Corps'),
    subordinate(randomUUID(), ids.yankee, ids.zulu),
  ]);
  await batch(ask, [
    entity(ids.charlie, 'Qx Charlie Brigade'),
    subordinate(randomUUID(), ids.charlie, ids.alpha),
    entity(ids.alpha, 'Qx Alpha Army'),
    subordinate(ids.link, ids.alpha, ids.zulu),
    entity(ids.bravo, 'Qx Bravo Brigade'),
    subordinate(randomUUID(), ids.bravo, ids.alpha),
    entity(ids.echo, 'Qx Echo Body', 'unknown'),
    subordinate(randomUUID(), ids.echo, ids.alpha),
  ]);
  await batch(ask, [entity(ids.lone, 'Qx Aardvark Unit')]);
  await batch(ask, [researched(ids.kilo, 'Qx Kilo Unit')]);
  return ids;
};

const groupOf = async (ask: Ask, unit: string): Promise<string> => {
  const [row] = z
    .array(z.object({ batch_id: z.uuid() }))
    .parse(await ask('SELECT batch_id FROM public.proposals WHERE id = $1', [unit]));
  if (row === undefined) throw new Error('the act has no group');
  return row.batch_id;
};

test('the queue puts the group that others wait for first, then the faults, then the tree, then the acts with no group', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const ids = await seed(ask);
    const order = await as(ask, 'gabriel_app', () => everyUnit(ask, 200));
    return { ids, order };
  });
  const { ids, order } = read;
  const mine = order.filter((unit) =>
    [ids.zulu, ids.yankee, ids.alpha, ids.link, ids.bravo, ids.charlie, ids.echo].includes(unit),
  );
  expect(mine).toStrictEqual([
    // The first group: the parent before the child.
    ids.zulu,
    ids.yankee,
    // The second group: the units with a fault first, then the clean units in tree order and by
    // name.
    ids.echo,
    ids.link,
    ids.alpha,
    ids.bravo,
    ids.charlie,
  ]);
  // The acts with no group come after every unit of a group.
  const lastInGroup = Math.max(...mine.map((unit) => order.indexOf(unit)));
  expect(order.indexOf(ids.lone)).toBeGreaterThan(lastInGroup);
  expect(order.indexOf(ids.kilo)).toBeGreaterThan(lastInGroup);
});

test('each filter runs on the server, with the keyset pages and the counts', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const ids = await seed(ask);
    const first = await groupOf(ask, ids.zulu);
    const second = await groupOf(ask, ids.alpha);
    return as(ask, 'gabriel_app', async () => ({
      ids,
      first,
      second,
      group: await readPage(ask, null, 200, { group: second }),
      groupPaged: await everyUnit(ask, 1, { group: second }),
      secondPage: await readPage(ask, (await readPage(ask, null, 2, { group: second })).next, 2, {
        group: second,
      }),
      name: await readPage(ask, null, 200, { name: 'BRIGADE', document: DOC }),
      fault: await readPage(ask, null, 200, { group: second, fault: 'unknown_type' }),
      waits: await readPage(ask, null, 200, { group: second, fault: 'end_waits' }),
      research: await readPage(ask, null, 200, { proposer: 'research_ai', name: 'qx' }),
      document: await readPage(ask, null, 200, { document: OTHER }),
      none: await readPage(ask, null, 200, { proposer: 'v1_import', name: 'qx kilo' }),
    }));
  });
  const { ids } = read;
  expect(read.group.units.map((unit) => unit.unit)).toStrictEqual([
    ids.echo,
    ids.link,
    ids.alpha,
    ids.bravo,
    ids.charlie,
  ]);
  expect(read.group.matched).toBe(5);
  expect(read.group.total).toBeGreaterThan(5);
  // A page of one, read to the end, gives each unit once and in the order of one long page.
  expect(read.groupPaged).toStrictEqual(read.group.units.map((unit) => unit.unit));
  // The second page says how many units of the filter come before it.
  expect(read.secondPage.before).toBe(2);
  expect(read.secondPage.units.map((unit) => unit.unit)).toStrictEqual([ids.alpha, ids.bravo]);

  expect(read.name.units.map((unit) => unit.unit)).toStrictEqual([ids.bravo, ids.charlie]);
  expect(read.fault.units.map((unit) => unit.unit)).toStrictEqual([ids.echo]);
  expect(read.waits.units.map((unit) => unit.unit)).toStrictEqual([ids.link]);
  expect(read.research.units.map((unit) => unit.unit)).toStrictEqual([ids.kilo]);
  expect(read.document.units.map((unit) => unit.unit)).toStrictEqual([ids.kilo]);

  // A filter that finds nothing still counts the whole queue, so the screen can tell an empty
  // filter from an empty queue.
  expect(read.none).toMatchObject({ units: [], matched: 0, before: 0, next: null });
  expect(read.none.total).toBeGreaterThan(0);

  // The choices of the filters: each group in the order of the queue, and each cited document.
  const groups = read.group.choices.groups.map((group) => group.id);
  expect(groups.indexOf(read.first)).toBeGreaterThan(-1);
  expect(groups.indexOf(read.second)).toBeGreaterThan(groups.indexOf(read.first));
  expect(read.group.choices.documents).toContainEqual({
    id: OTHER,
    title: 'A page that a session found',
  });
});

test('a page of one unit, read to the end with no filter, gives the order of one long page', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    return as(ask, 'gabriel_app', async () => ({
      single: await everyUnit(ask, 1),
      long: await everyUnit(ask, 200),
    }));
  });
  expect(read.single).toStrictEqual(read.long);
});

test('a grandchild comes after its parent, also when its name sorts first', async () => {
  const [top, middle, bottom] = [randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(bottom, 'Qa Bottom Company'),
      subordinate(randomUUID(), bottom, middle),
      entity(middle, 'Qm Middle Battalion'),
      subordinate(randomUUID(), middle, top),
      entity(top, 'Qz Top Brigade'),
    ]);
    const group = await groupOf(ask, top);
    return as(ask, 'gabriel_app', () => everyUnit(ask, 200, { group }));
  });
  expect(read).toStrictEqual([top, middle, bottom]);
});

// The limit of the order: the depth and the group never move, but a fault can. A rejected parent
// blocks its children, and they move to the start of their group, before the place of the screen.
test('the children of a rejected parent move before the place of the screen', async () => {
  const [top, a, b, c] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    await batch(ask, [
      entity(top, 'Qf Top Brigade'),
      entity(a, 'Qf A Company'),
      subordinate(randomUUID(), a, top),
      entity(b, 'Qf B Company'),
      subordinate(randomUUID(), b, top),
      entity(c, 'Qf C Company'),
      subordinate(randomUUID(), c, top),
    ]);
    const group = await groupOf(ask, top);
    const first = await as(ask, 'gabriel_app', () => readPage(ask, null, 2, { group }));
    await ask("SELECT public.reject_unit($1::uuid, 'duplicate', NULL, 'a test')", [top]);
    return as(ask, 'gabriel_app', async () => ({
      first,
      next: await readPage(ask, first.next, 2, { group }),
      again: await readPage(ask, null, 200, { group }),
    }));
  });
  expect(read.first.units.map((unit) => unit.unit)).toStrictEqual([top, a]);
  // The next page after the place of the screen shows no unit of the group: B and C are now
  // blocked, so they come before that place.
  expect(read.next.units).toStrictEqual([]);
  expect(read.next.matched).toBe(3);
  // A read from the first unit shows them again, with the faults first.
  expect(read.again.units.map((unit) => unit.unit)).toStrictEqual([a, b, c]);
});

test('one unit is read by its identifier, wherever it stands in the queue', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const ids = await seed(ask);
    const asked = await as(ask, 'gabriel_app', async () => ({
      far: await readPage(ask, null, 1, { unit: ids.charlie }),
      lone: await readPage(ask, null, 1, { unit: ids.lone }),
    }));
    await ask("SELECT public.reject_unit($1::uuid, 'duplicate', NULL, 'a test')", [ids.lone]);
    const decided = await as(ask, 'gabriel_app', () => readPage(ask, null, 1, { unit: ids.lone }));
    return { ids, ...asked, decided };
  });
  expect(read.far.units.map((unit) => unit.unit)).toStrictEqual([read.ids.charlie]);
  expect(read.far.units[0]?.name).toBe('Qx Charlie Brigade');
  expect(read.lone.units.map((unit) => unit.unit)).toStrictEqual([read.ids.lone]);
  // A decided unit waits no more, so the read gives no unit.
  expect(read.decided).toMatchObject({ units: [], matched: 0, next: null });
});

test('the choices of the proposer name only the proposers that have a unit in the queue', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const [row] = z.array(z.object({ proposer: z.string() })).parse(
      await ask(
        `SELECT string_agg(DISTINCT proposer, ',' ORDER BY proposer) AS proposer
             FROM public.proposals WHERE status = 'pending'`,
      ),
    );
    return {
      pending: (row?.proposer ?? '').split(','),
      page: await as(ask, 'gabriel_app', () => readPage(ask, null, 1)),
    };
  });
  expect(read.page.choices.proposers).toStrictEqual(read.pending);
  expect(read.page.choices.proposers).toContain('research_ai');
});
