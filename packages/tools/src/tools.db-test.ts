// Each tool runs against the disposable database as gabriel_research, the role with the narrowest
// grants. Each gesture runs inside a transaction that rolls back, so the corpus stays as it was.

import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import { expect, test } from 'vitest';
import { IDENTIFIER_KEYS } from '@gab/proposal/identifiers';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { MAX_TOLERANT_UNITS } from './excerpt.ts';
import { proposeOf } from './propose.ts';
import { UK_LIST_CSV } from './uk-sanctions-list.ts';
import { callTool, type Reach, type Session, type Tool } from './tool.ts';

const SHA = 'f'.repeat(64);
const DOC = `doc_${SHA.slice(0, 12)}`;
const ABSENT = '00000000-0000-4000-8000-000000000000';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const call = async (ask: Ask, name: string, raw: unknown) =>
  callTool(toolNamed(name), sessionOf(ask), raw);

const output = async (ask: Ask, name: string, raw: unknown): Promise<unknown> => {
  const outcome = await call(ask, name, raw);
  if (!outcome.ok) throw new Error(`${name} refused: ${outcome.refusal}`);
  return outcome.output;
};

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
// The door of a fetched document accepts only today or yesterday.
const TODAY = new Date().toISOString().slice(0, 10);
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

// The research role stores the document and its text through its own doors.
const withDocument = async (
  ask: Ask,
  pages: readonly string[],
  uri = 'https://example.org/report',
): Promise<void> => {
  await ask(STORE, [
    'url',
    'A report of the tool test',
    `raw/${SHA}`,
    uri,
    SHA,
    'application/pdf',
    TODAY,
    null,
  ]);
  await ask(WRITE_TEXT, [DOC, JSON.stringify(pages), 'tool-test-1']);
};

const entityRow = z.object({ id: z.uuid(), label: z.string() });

const connected = async (ask: Ask) => {
  const [row] = z.array(entityRow).parse(
    await ask(`SELECT e.id::text AS id, e.label FROM api.entity e
        JOIN api.relation r ON r.src_kind = 'entity' AND r.dst_kind = 'entity' AND r.src_id = e.id
        ORDER BY e.id LIMIT 1`),
  );
  if (row === undefined) throw new Error('the fixture holds no relation between two entities');
  return row;
};

const hits = z.object({
  entities: z.array(z.object({ id: z.uuid(), label: z.string(), type: z.string() })),
});

const proposed = z.object({ proposals: z.array(z.object({ proposalId: z.uuid() })).length(1) });

// One item that cites the first page of the test document, as the research role gives it.
const citedOnPageOne = (act: Readonly<Record<string, unknown>>) => ({
  items: [
    {
      ref: 'one',
      act,
      originator: 'The tool test',
      modality: 'asserts',
      evidence: [{ document: DOC, page: 1, excerpt: 'page one' }],
    },
  ],
});

// ---------------------------------------------------------- search_graph ---

test('search_graph finds an entity by a part of its name', async () => {
  const found = await rolledBack('research', async (ask) => {
    const held = await connected(ask);
    return {
      held,
      result: hits.parse(await output(ask, 'search_graph', { query: held.label.slice(1, 4) })),
    };
  });
  expect(found.result.entities.map((entity) => entity.id)).toContain(found.held.id);
});

test('search_graph narrows by type, and a wrong type finds nothing', async () => {
  const found = await rolledBack('research', async (ask) => {
    const held = await connected(ask);
    return hits.parse(
      await output(ask, 'search_graph', { query: held.label, type: 'no_such_type' }),
    );
  });
  expect(found.entities).toStrictEqual([]);
});

test('search_graph reads a percent sign as a letter and not as a wildcard', async () => {
  const found = await rolledBack('research', async (ask) =>
    hits.parse(await output(ask, 'search_graph', { query: '%' })),
  );
  expect(found.entities).toStrictEqual([]);
});

test('search_graph holds the list to the limit', async () => {
  const found = await rolledBack('research', async (ask) =>
    hits.parse(await output(ask, 'search_graph', { query: 'a', limit: 2 })),
  );
  expect(found.entities.length).toBeLessThanOrEqual(2);
});

const IMO_HELD = `SELECT id::text AS id, attrs -> 'imo' ->> 'v' AS value
  FROM api.entity WHERE jsonb_typeof(attrs -> 'imo' -> 'v') = 'string'
  ORDER BY id LIMIT 1`;

const imoHeld = z.array(z.object({ id: z.uuid(), value: z.string() }));

test('each entity type of the map of spellings is a live type of the record', async () => {
  const live = await probe('read', async (ask) =>
    z
      .array(z.object({ key: z.string() }))
      .parse(await ask('SELECT key FROM api.entity_type WHERE NOT retired')),
  );
  const keys = live.map((row) => row.key);
  for (const type of Object.keys(IDENTIFIER_KEYS)) expect(keys).toContain(type);
});

test('search_graph finds a hull by its imo, and the next proposal on it is update_attrs', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one']);
    const [held] = imoHeld.parse(await ask(IMO_HELD));
    if (held === undefined) throw new Error('the fixture holds no entity with an imo');
    const result = hits.parse(
      await output(ask, 'search_graph', { identifier: { key: 'imo', value: held.value } }),
    );
    const [hull] = result.entities;
    if (hull === undefined) throw new Error('search_graph found no entity for the imo');
    const made = proposed.parse(
      await output(
        ask,
        'propose',
        citedOnPageOne({
          op: 'update_attrs',
          targetKind: 'entity',
          targetId: hull.id,
          attrs: { imo: { v: held.value } },
        }),
      ),
    );
    return { held, result, made };
  });
  expect(found.result.entities.map((entity) => entity.id)).toStrictEqual([found.held.id]);
  expect(found.made.proposals).toHaveLength(1);
});

test('search_graph finds nothing for an imo that no entity holds', async () => {
  const found = await rolledBack('research', async (ask) =>
    hits.parse(await output(ask, 'search_graph', { identifier: { key: 'imo', value: '9074729' } })),
  );
  expect(found.entities).toStrictEqual([]);
});

// --------------------------------------------------------- list_entities ---

const listed = z.object({
  entities: z.array(z.object({ id: z.uuid(), label: z.string(), type: z.string() })),
  next: z.uuid().nullable(),
  total: z.number(),
  withKey: z.number().nullable(),
  withoutKey: z.number().nullable(),
});

const COUNT_KEYS = ['flag_history', 'mmsi_history', 'call_sign'] as const;

test('list_entities counts the vessels with a key and without it, and the two add up', async () => {
  await rolledBack('research', async (ask) => {
    for (const key of COUNT_KEYS) {
      const found = listed.parse(
        await output(ask, 'list_entities', { type: 'vessel', key, limit: 1 }),
      );
      expect(found.total).toBeGreaterThan(0);
      expect((found.withKey ?? 0) + (found.withoutKey ?? 0)).toBe(found.total);
      const [direct] = z
        .array(z.object({ n: z.number() }))
        .parse(
          await ask(
            `SELECT count(*)::int AS n FROM api.entity WHERE type = 'vessel' AND NOT (attrs ? $1)`,
            [key],
          ),
        );
      expect(found.withoutKey).toBe(direct?.n);
    }
  });
});

test('list_entities lists only the entities without a key when presence says without', async () => {
  await rolledBack('research', async (ask) => {
    const found = listed.parse(
      await output(ask, 'list_entities', {
        type: 'vessel',
        key: 'call_sign',
        presence: 'without',
        limit: 200,
      }),
    );
    const ids = found.entities.map((entity) => entity.id);
    const withKey = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        await ask(
          `SELECT id::text AS id FROM api.entity WHERE type = 'vessel' AND attrs ? 'call_sign'`,
        ),
      );
    expect(found.entities.length).toBeGreaterThan(0);
    for (const held of withKey) expect(ids).not.toContain(held.id);
  });
});

test('list_entities lists only the entities with a key when presence says with', async () => {
  await rolledBack('research', async (ask) => {
    const found = listed.parse(
      await output(ask, 'list_entities', {
        type: 'vessel',
        key: 'flag_history',
        presence: 'with',
        limit: 200,
      }),
    );
    const held = z
      .array(z.object({ id: z.uuid() }))
      .parse(
        await ask(
          `SELECT id::text AS id FROM api.entity WHERE type = 'vessel' AND attrs ? 'flag_history'`,
        ),
      );
    const ids = new Set(held.map((row) => row.id));
    for (const entity of found.entities) expect(ids.has(entity.id)).toBe(true);
    expect(found.entities.length).toBe(Math.min(200, held.length));
  });
});

test('list_entities reads all entities of a type through the cursor, none lost, none repeated', async () => {
  await rolledBack('research', async (ask) => {
    const seen: string[] = [];
    let after: string | undefined;
    let total: number | undefined;
    let pages = 0;
    do {
      const page = listed.parse(
        await output(ask, 'list_entities', { type: 'vessel', limit: 3, ...(after && { after }) }),
      );
      seen.push(...page.entities.map((entity) => entity.id));
      total = page.total;
      after = page.next ?? undefined;
      pages += 1;
    } while (after !== undefined && pages < 10_000);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(total);
    const all = z
      .array(z.object({ id: z.uuid() }))
      .parse(await ask(`SELECT id::text AS id FROM api.entity WHERE type = 'vessel'`));
    expect([...seen].sort()).toStrictEqual(all.map((row) => row.id).sort());
  });
});

test('list_entities refuses a type that the record does not hold', async () => {
  await rolledBack('research', async (ask) => {
    const outcome = await call(ask, 'list_entities', { type: 'no_such_type' });
    expect(outcome.ok).toBe(false);
  });
});

// --------------------------------------------------------- neighbourhood ---

const walk = z.object({
  entities: z.array(
    z.object({ id: z.uuid(), label: z.string(), type: z.string(), hop: z.number() }),
  ),
});

test('neighbourhood returns the root at hop zero and a neighbour at hop one', async () => {
  const found = await rolledBack('research', async (ask) => {
    const held = await connected(ask);
    return {
      held,
      result: walk.parse(await output(ask, 'neighbourhood', { root: held.id, depth: 1 })),
    };
  });
  const hops = found.result.entities.map((entity) => entity.hop);
  expect(found.result.entities.find((entity) => entity.hop === 0)?.id).toBe(found.held.id);
  expect(Math.max(...hops)).toBe(1);
});

test('neighbourhood of an identifier that no entity holds is empty', async () => {
  const found = await rolledBack('research', async (ask) =>
    walk.parse(await output(ask, 'neighbourhood', { root: ABSENT })),
  );
  expect(found.entities).toStrictEqual([]);
});

// --------------------------------------------------------- document_text ---

const text = z.object({
  document: z.string(),
  extractor: z.string().nullable(),
  pages: z.array(z.object({ page: z.number(), text: z.string() })),
  lastPage: z.number().nullable(),
  truncated: z.boolean(),
  next: z.object({ page: z.number(), fromCharacter: z.number() }).nullable(),
});

test('document_text returns the pages of the range and the last page of the set', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one', 'page two', 'page three']);
    return text.parse(
      await output(ask, 'document_text', { document: DOC, fromPage: 2, toPage: 3 }),
    );
  });
  expect(found).toStrictEqual({
    document: DOC,
    extractor: 'tool-test-1',
    pages: [
      { page: 2, text: 'page two' },
      { page: 3, text: 'page three' },
    ],
    lastPage: 3,
    truncated: false,
    next: null,
  });
});

test('document_text without a range starts at page one', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['page one', 'page two']);
    return text.parse(await output(ask, 'document_text', { document: DOC }));
  });
  expect(found.pages.map((page) => page.page)).toStrictEqual([1, 2]);
});

test('document_text cuts a long page at the size cap and says so', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['x'.repeat(60_000), 'second']);
    return text.parse(await output(ask, 'document_text', { document: DOC }));
  });
  expect(found.truncated).toBe(true);
  expect(found.pages.reduce((sum, page) => sum + page.text.length, 0)).toBeLessThanOrEqual(40_000);
  expect(found.next).toStrictEqual({ page: 1, fromCharacter: 40_000 });
});

test('document_text reads a long page in slices that follow "next", with no character lost or read twice', async () => {
  const long = Array.from({ length: 95_000 }, (_, at) => String.fromCharCode(97 + (at % 26))).join(
    '',
  );
  const { read, slices } = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['before', long, 'after']);
    let at: { page: number; fromCharacter: number } | null = { page: 2, fromCharacter: 0 };
    const parts: string[] = [];
    let count = 0;
    while (at !== null && at.page === 2) {
      const found = text.parse(
        await output(ask, 'document_text', {
          document: DOC,
          fromPage: at.page,
          toPage: at.page,
          fromCharacter: at.fromCharacter,
        }),
      );
      parts.push(found.pages.map((page) => page.text).join(''));
      at = found.next;
      count += 1;
    }
    return { read: parts.join(''), slices: count };
  });
  expect(slices).toBe(3);
  expect(read).toBe(long);
});

test('document_text gives the next page at offset zero when the cap falls on a page boundary', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['x'.repeat(40_000), 'second']);
    return text.parse(await output(ask, 'document_text', { document: DOC }));
  });
  expect(found.pages.map((page) => page.page)).toStrictEqual([1]);
  expect(found.next).toStrictEqual({ page: 2, fromCharacter: 0 });
});

test('document_text never cuts a character in two', async () => {
  const found = await rolledBack('research', async (ask) => {
    await withDocument(ask, [`${'x'.repeat(39_999)}😀tail`]);
    return text.parse(await output(ask, 'document_text', { document: DOC }));
  });
  expect(found.pages[0]?.text).toBe('x'.repeat(39_999));
  expect(found.next).toStrictEqual({ page: 1, fromCharacter: 39_999 });
});

test('document_text refuses an offset after the end of the page, and gives its length', async () => {
  const outcome = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['short']);
    return call(ask, 'document_text', { document: DOC, fromCharacter: 5 });
  });
  expect(outcome).toMatchObject({ ok: false });
  expect(JSON.stringify(outcome)).toContain('page 1 holds 5 characters');
});

test('document_text refuses a range above the cap', async () => {
  const outcome = await rolledBack('research', (ask) =>
    call(ask, 'document_text', { document: DOC, fromPage: 1, toPage: 11 }),
  );
  expect(outcome.ok).toBe(false);
});

// --------------------------------------------------------------- propose ---

const PAGE_ONE =
  'On 12 March 2024 the tanker NAYARA, of 41 200 dwt, left Sikka. Rosneft owns the ves-\n' +
  'sel through Sea­trade Ltd.';

const item = (
  ref: string,
  act: Readonly<Record<string, unknown>>,
  excerpt: string,
): Readonly<Record<string, unknown>> => ({
  ref,
  act,
  originator: 'The port authority',
  modality: 'asserts',
  evidence: [{ document: DOC, page: 1, excerpt }],
});

const NAYARA = item(
  'nayara',
  {
    op: 'create_entity',
    type: 'vessel',
    label: 'Nayara',
    attrs: { departed_on: { v: '2024-03-12' }, capacity_dwt: { v: 41200 } },
  },
  'On 12 March 2024 the tanker NAYARA, of 41 200 dwt',
);

const proposedBatch = z.object({
  proposals: z.array(
    z.object({
      ref: z.string(),
      proposalId: z.uuid(),
      written: z.boolean(),
      disputed: z.boolean(),
      unstated: z.array(z.string()),
      droppedBounds: z.array(z.string()),
    }),
  ),
});

// The research role cannot read a citation, so the owner opens the transaction, the research
// role makes each call, and the owner reads the rows that the call wrote.
const asResearch = async <T>(ask: Ask, work: () => Promise<T>): Promise<T> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

// A refusal of the door aborts the transaction, so each call stands in a savepoint, and the test
// reads the rows after a refusal too.
const proposeAgain = async (ask: Ask, items: readonly unknown[]) => {
  await ask('SAVEPOINT propose');
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
  const outcome = await call(ask, 'propose', { items });
  if (outcome.ok) {
    await ask('RESET SESSION AUTHORIZATION');
    await ask('RELEASE SAVEPOINT propose');
  } else await ask('ROLLBACK TO SAVEPOINT propose');
  return outcome;
};

const proposeOnPage = async (ask: Ask, items: readonly unknown[], page = PAGE_ONE) => {
  await asResearch(ask, () => withDocument(ask, [page]));
  return proposeAgain(ask, items);
};

const batchOf = (outcome: Awaited<ReturnType<typeof call>>) => {
  if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
  return proposedBatch.parse(outcome.output);
};

const ROWS = `SELECT p.id::text AS id, p.author_role, p.status, p.src::text[] AS src, p.payload,
    p.dissent, p.dissent_reason, p.originator, c.page, c.start, c."end", c.modality, c.text_extractor
  FROM public.proposals p LEFT JOIN public.citation c ON c.claim_id = p.id
  WHERE p.src::text[] @> ARRAY[$1::text] ORDER BY p.created_at, p.id`;

const documentRows = z.array(
  z.object({
    id: z.uuid(),
    author_role: z.string(),
    status: z.string(),
    src: z.array(z.string()),
    payload: z.record(z.string(), z.unknown()),
    dissent: z.boolean(),
    dissent_reason: z.string().nullable(),
    originator: z.string().nullable(),
    page: z.number().nullable(),
    start: z.number().nullable(),
    end: z.number().nullable(),
    modality: z.string().nullable(),
    text_extractor: z.string().nullable(),
  }),
);

const rowsOfDocument = async (ask: Ask) => documentRows.parse(await ask(ROWS, [DOC]));

const spanOf = (start: number | null | undefined, end: number | null | undefined): string =>
  Array.from(PAGE_ONE)
    .slice(start ?? 0, end ?? 0)
    .join('');

test('propose stores the act of the role, its originator and the citation of its excerpt', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [NAYARA]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { ref: 'nayara', written: true, disputed: false, unstated: [] },
  ]);
  expect(found.rows).toHaveLength(1);
  const [row] = found.rows;
  expect(row).toMatchObject({
    id: found.batch.proposals[0]?.proposalId,
    author_role: 'gabriel_research',
    status: 'pending',
    src: [DOC],
    dissent: false,
    dissent_reason: null,
    originator: 'The port authority',
    page: 1,
    modality: 'asserts',
    text_extractor: 'tool-test-1',
  });
  expect(spanOf(row?.start, row?.end)).toBe('On 12 March 2024 the tanker NAYARA, of 41 200 dwt');
  expect(row?.payload['attrs']).toStrictEqual({
    departed_on: { v: '2024-03-12', src: [DOC] },
    capacity_dwt: { v: 41200, src: [DOC] },
  });
});

test('an excerpt with other white space, a soft hyphen and a hyphen at a line end is found', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [
      item(
        'owner',
        { op: 'create_entity', type: 'company', label: 'Seatrade Ltd' },
        'Rosneft  owns the vessel through Seatrade Ltd.',
      ),
    ]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  const [row] = found.rows;
  expect(spanOf(row?.start, row?.end)).toBe('Rosneft owns the ves-\nsel through Sea­trade Ltd.');
  expect(found.batch.proposals[0]?.disputed).toBe(false);
});

test('an excerpt that the page does not hold refuses the whole batch and names the item', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [
      NAYARA,
      item(
        'ghost',
        { op: 'create_entity', type: 'vessel', label: 'Ghost' },
        'the tanker Ghost left Vadinar',
      ),
    ]);
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(/^item ghost: .*does not hold the excerpt/u) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

test('an excerpt that is not exact on a page above the tolerant size is refused with a sentence that asks for an exact copy', async () => {
  const page = `${'a '.repeat(MAX_TOLERANT_UNITS)}he said “no” today`;
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(
      ask,
      [
        item(
          'quotes',
          { op: 'create_entity', type: 'vessel', label: 'Quoted' },
          'he said "no" today',
        ),
      ],
      page,
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(
      /^item quotes: .*holds more than .* characters.*exact/u,
    ) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

test('a value that its excerpt does not state marks the item as disputed', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [
      item(
        'nayara',
        { op: 'create_entity', type: 'vessel', label: 'Nayara', attrs: { flag: { v: 'Panama' } } },
        'the tanker NAYARA',
      ),
    ]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { disputed: true, unstated: ['attrs.flag'], written: true },
  ]);
  expect(found.rows[0]).toMatchObject({
    dissent: true,
    dissent_reason: 'no cited passage states attrs.flag "Panama"',
  });
});

const AERO_PAGE = 'GAZPROMNEFT AERO, Moscow, Russia; Tax ID No. 7714117720 (Russia).';

test.each(['RU', 'Russia'])(
  'a proposal of the jurisdiction %j on a page that writes Russia is accepted and stored as RU',
  async (jurisdiction) => {
    const found = await rolledBack('superuser', async (ask) => {
      const batch = batchOf(
        await proposeOnPage(
          ask,
          [
            item(
              'aero',
              {
                op: 'create_entity',
                type: 'company',
                label: 'Gazpromneft Aero',
                attrs: { registration_jurisdiction: { v: jurisdiction } },
              },
              'GAZPROMNEFT AERO, Moscow, Russia',
            ),
          ],
          AERO_PAGE,
        ),
      );
      const id = batch.proposals[0]?.proposalId;
      await ask("SELECT public.apply_proposal($1::uuid, 'a test', NULL)", [id]);
      const stored = z.array(z.object({ act: z.unknown(), row: z.unknown() })).parse(
        await ask(
          `SELECT p.payload #> '{attrs,registration_jurisdiction,v}' AS act,
                    e.attrs #> '{registration_jurisdiction,v}' AS row
               FROM public.proposals p JOIN public.entities e ON e.promoted_from = p.id
              WHERE p.id = $1::uuid`,
          [id],
        ),
      );
      const searched = hits.parse(
        await asResearch(ask, () =>
          output(ask, 'search_graph', {
            identifier: { key: 'registration_jurisdiction', value: 'Russian Federation' },
            query: 'Gazpromneft Aero',
          }),
        ),
      );
      return { batch, stored, id, searched };
    });
    expect(found.batch.proposals).toMatchObject([{ disputed: false, unstated: [] }]);
    expect(found.stored).toStrictEqual([{ act: 'RU', row: 'RU' }]);
    expect(found.searched.entities.map((entity) => entity.id)).toStrictEqual([found.id]);
  },
);

// A unit tree drawn as an image: its OCR text mixes the columns, so it holds no parent.
const IMAGE_SHA = 'e'.repeat(64);
const IMAGE_DOC = `doc_${IMAGE_SHA.slice(0, 12)}`;
const READ_FROM_IMAGE = '1453rd Motorized Rifle Regiment > Ural Drone Crew';

const proposeOnImage = async (ask: Ask, items: readonly unknown[]) => {
  await asResearch(ask, async () => {
    await ask(STORE, [
      'url',
      'A unit tree of the tool test',
      `raw/${IMAGE_SHA}`,
      'https://example.org/unit-tree.png',
      IMAGE_SHA,
      'image/png',
      TODAY,
      null,
    ]);
    await ask(WRITE_TEXT, [
      IMAGE_DOC,
      JSON.stringify(['1453rd Rifle Ural Crew Drone']),
      'tool-test-1',
    ]);
  });
  return proposeAgain(ask, items);
};

const fromImage = (document: string) => ({
  ref: 'crew',
  act: { op: 'create_entity', type: 'military_unit', label: 'Ural Drone Crew' },
  originator: 'Tochnyi',
  modality: 'asserts',
  evidence: [{ document, page: 1, excerpt: READ_FROM_IMAGE, fromImage: true }],
});

const TRANSCRIBED = `SELECT p.dissent, p.dissent_reason, c.start, c."end", c.transcription
  FROM public.proposals p JOIN public.citation c ON c.claim_id = p.id
  WHERE p.src::text[] @> ARRAY[$1::text]`;

const transcribedRows = z.array(
  z.object({
    dissent: z.boolean(),
    dissent_reason: z.string().nullable(),
    start: z.number().nullable(),
    end: z.number().nullable(),
    transcription: z.string().nullable(),
  }),
);

test('words read from an image are cited as a transcription, and the item is disputed', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const first = await proposeOnImage(ask, [fromImage(IMAGE_DOC)]);
    const again = await proposeAgain(ask, [fromImage(IMAGE_DOC)]);
    return {
      first: batchOf(first),
      again: batchOf(again),
      rows: transcribedRows.parse(await ask(TRANSCRIBED, [IMAGE_DOC])),
    };
  });
  expect(found.first.proposals).toMatchObject([{ written: true, disputed: true }]);
  expect(found.again.proposals).toMatchObject([{ written: false }]);
  expect(found.rows).toStrictEqual([
    {
      dissent: true,
      dissent_reason:
        'an excerpt is read from the image by the AI: compare its words with the image',
      start: null,
      end: null,
      transcription: READ_FROM_IMAGE,
    },
  ]);
});

test('words read from an image are refused for a document that is no image', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const outcome = await proposeOnPage(ask, [fromImage(DOC)]);
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(/^item crew: .*is no PNG or JPEG image/u) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

test('a back-end agent never cites words read from an image', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await asResearch(ask, () => withDocument(ask, [PAGE_ONE]));
    return callTool(proposeOf(ABSENT), sessionOf(ask), { items: [fromImage(DOC)] });
  });
  expect(found).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(/^item crew: an agent cites the stored text/u) as string,
  });
});

const SEATRADE = item(
  'owner',
  { op: 'create_entity', type: 'company', label: 'Seatrade Ltd' },
  'through Sea­trade Ltd.',
);

const SIKKA = item('port', { op: 'create_entity', type: 'port', label: 'Sikka' }, 'left Sikka');

// The checker supports one item, does not support a second one, and gives no verdict on a third.
const checker: Reach = {
  now: () => new Date(),
  check: async () =>
    Promise.resolve(
      new Map([
        ['nayara', { verdict: 'supported' as const }],
        ['owner', { verdict: 'not_supported' as const, reason: 'the page names another owner' }],
      ]),
    ),
};

test('the record keeps why the checker disputes an item, and nothing for an item it supports', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await asResearch(ask, () => withDocument(ask, [PAGE_ONE]));
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
    const outcome = await callTool(
      toolNamed('propose'),
      sessionOf(ask),
      { items: [NAYARA, SEATRADE, SIKKA] },
      checker,
    );
    await ask('RESET SESSION AUTHORIZATION');
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  const reasonOf = (ref: string) => {
    const id = found.batch.proposals.find((one) => one.ref === ref)?.proposalId;
    return found.rows.find((row) => row.id === id)?.dissent_reason;
  };
  expect(reasonOf('nayara')).toBeNull();
  expect(reasonOf('owner')).toBe('the checker says not_supported: the page names another owner');
  expect(reasonOf('port')).toBe('the checker did not answer');
});

// The checker names the items by their refs, which the record does not keep.
const byRef: Reach = {
  now: () => new Date(),
  check: async () =>
    Promise.resolve(
      new Map([
        ['e1', { verdict: 'supported' as const }],
        [
          'e2',
          { verdict: 'not_supported' as const, reason: 'the passage names e1, and not e2 or e22' },
        ],
      ]),
    ),
};

test('the reason of the checker names each item of the batch by its name, and not by its ref', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await asResearch(ask, () => withDocument(ask, [PAGE_ONE]));
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
    const outcome = await callTool(
      toolNamed('propose'),
      sessionOf(ask),
      {
        items: [
          { ...NAYARA, ref: 'e1' },
          { ...SEATRADE, ref: 'e2' },
        ],
      },
      byRef,
    );
    await ask('RESET SESSION AUTHORIZATION');
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  const id = found.batch.proposals.find((one) => one.ref === 'e2')?.proposalId;
  expect(found.rows.find((row) => row.id === id)?.dissent_reason).toBe(
    'the checker says not_supported: the passage names Nayara, and not Seatrade Ltd or e22',
  );
});

// A free model can give a reason with control characters, or a reason that is very long.
const messy: Reach = {
  now: () => new Date(),
  check: async () =>
    Promise.resolve(
      new Map([
        ['owner', { verdict: 'unclear' as const, reason: `two\u0000\nowners ${'x'.repeat(2000)}` }],
      ]),
    ),
};

test('a messy reason of the checker is kept as one cut line of plain text', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await asResearch(ask, () => withDocument(ask, [PAGE_ONE]));
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
    const outcome = await callTool(
      toolNamed('propose'),
      sessionOf(ask),
      { items: [SEATRADE] },
      messy,
    );
    await ask('RESET SESSION AUTHORIZATION');
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  const reason = found.rows[0]?.dissent_reason ?? '';
  expect(found.batch.proposals).toMatchObject([{ disputed: true, written: true }]);
  expect(reason.startsWith('the checker says unclear: two owners xxx')).toBe(true);
  expect(reason).toHaveLength(1000);
});

test('a relation of a batch names an entity that the same batch creates', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const outcome = await proposeOnPage(ask, [
      NAYARA,
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: 'nayara' },
        'Rosneft owns the vessel',
      ),
    ]);
    return { held, batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  const [vessel, link] = found.batch.proposals;
  const relation = found.rows.find((row) => row.id === link?.proposalId);
  expect(relation?.payload).toMatchObject({ src_id: found.held.id, dst_id: vessel?.proposalId });
});

test('a relation that names a later item or an absent entity refuses the batch', async () => {
  const outcomes = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const later = await proposeOnPage(ask, [
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: 'nayara' },
        'Rosneft owns the vessel',
      ),
      NAYARA,
    ]);
    const absent = await proposeAgain(ask, [
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: ABSENT },
        'Rosneft owns the vessel',
      ),
    ]);
    return { later, absent };
  });
  expect(outcomes.later).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('item owner: it names nayara') as string,
  });
  expect(outcomes.absent).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(ABSENT) as string,
  });
});

// A relation of a later call names a new entity that waits in the queue.
const ownerOfPending = async (ask: Ask) => {
  const held = await connected(ask);
  const [vessel] = batchOf(await proposeOnPage(ask, [NAYARA])).proposals;
  if (vessel === undefined) throw new Error('propose wrote no entity');
  const outcome = await proposeAgain(ask, [
    item(
      'owner',
      { op: 'create_relation', type: 'owns', srcId: held.id, dstId: vessel.proposalId },
      'Rosneft owns the vessel',
    ),
  ]);
  const [link] = batchOf(outcome).proposals;
  if (link === undefined) throw new Error('propose wrote no relation');
  return { held, vessel: vessel.proposalId, link: link.proposalId };
};

const decision = z.array(
  z.object({ id: z.uuid(), status: z.string(), reject_reason: z.string().nullable() }),
);
const DECISIONS = `SELECT id::text AS id, status, reject_reason FROM public.proposals
  WHERE id = ANY ($1::uuid[]) ORDER BY id`;
const decisionsOf = async (ask: Ask, ids: readonly string[]) =>
  new Map(decision.parse(await ask(DECISIONS, [ids])).map((row) => [row.id, row] as const));

test('a relation to a new entity that waits in the queue joins the unit of that entity', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { vessel, link } = await ownerOfPending(ask);
    const [page] = z
      .array(
        z.object({
          page: z.object({
            units: z.array(z.object({ unit: z.uuid(), acts: z.array(z.object({ id: z.uuid() })) })),
          }),
        }),
      )
      .parse(
        await ask('SELECT public.review_units(NULL, 200, p_unit => $1::uuid) AS page', [vessel]),
      );
    return { vessel, link, units: page?.page.units ?? [] };
  });
  expect(found.units).toHaveLength(1);
  expect(found.units[0]?.unit).toBe(found.vessel);
  expect(found.units[0]?.acts.map((act) => act.id).sort()).toStrictEqual(
    [found.vessel, found.link].sort(),
  );
});

test('a rejection of the entity that waits rejects the relation to it as "end rejected"', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { vessel, link } = await ownerOfPending(ask);
    await ask("SELECT public.reject_unit($1::uuid, 'wrong_value', NULL, 'a test')", [vessel]);
    return { vessel, link, rows: await decisionsOf(ask, [vessel, link]) };
  });
  expect(found.rows.get(found.vessel)).toMatchObject({
    status: 'rejected',
    reject_reason: 'wrong_value',
  });
  expect(found.rows.get(found.link)).toMatchObject({
    status: 'rejected',
    reject_reason: 'end_rejected',
  });
});

test('an acceptance of the entity that waits writes the relation to it through its unit', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { held, vessel, link } = await ownerOfPending(ask);
    // An act is never decided by the transaction that proposed it, so the test dates it back.
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id IN ($1::uuid, $2::uuid)", [
      vessel,
      link,
    ]);
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    await ask("SELECT public.promote_unit($1::uuid, 'a test')", [vessel]);
    const relations = z
      .array(z.object({ src_id: z.uuid(), dst_id: z.uuid() }))
      .parse(
        await ask(
          'SELECT src_id::text AS src_id, dst_id::text AS dst_id FROM public.relations WHERE id = $1',
          [link],
        ),
      );
    return { held, vessel, link, relations, rows: await decisionsOf(ask, [vessel, link]) };
  });
  expect(found.rows.get(found.vessel)?.status).toBe('accepted');
  expect(found.rows.get(found.link)?.status).toBe('accepted');
  expect(found.relations).toStrictEqual([{ src_id: found.held.id, dst_id: found.vessel }]);
});

test('a relation to a new entity that waits needs an entity of the record at its other end', async () => {
  const SEATRADE = item(
    'seatrade',
    { op: 'create_entity', type: 'company', label: 'Seatrade Ltd' },
    'Rosneft owns the vessel through Seatrade Ltd.',
  );
  const ownerOf = (srcId: string, dstId: string) =>
    item('owner', { op: 'create_relation', type: 'owns', srcId, dstId }, 'Rosneft owns the vessel');
  const outcomes = await rolledBack('superuser', async (ask) => {
    const [vessel] = batchOf(await proposeOnPage(ask, [NAYARA])).proposals;
    const [company] = batchOf(await proposeAgain(ask, [SEATRADE])).proposals;
    if (vessel === undefined || company === undefined) throw new Error('propose wrote no entity');
    const twoWaiting = await proposeAgain(ask, [ownerOf(company.proposalId, vessel.proposalId)]);
    const withRef = await proposeAgain(ask, [
      { ...SEATRADE, ref: 'buyer' },
      ownerOf('buyer', vessel.proposalId),
    ]);
    return { company: company.proposalId, vessel: vessel.proposalId, twoWaiting, withRef };
  });
  const refusal = (id: string) =>
    `item owner: the new entity ${id} waits in the review queue, so the other end of the ` +
    'relation must be an entity of the record';
  expect(outcomes.twoWaiting).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(refusal(outcomes.company)) as string,
  });
  expect(outcomes.withRef).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(refusal(outcomes.vessel)) as string,
  });
});

test('a retry of the same batch writes no second proposal and no second citation', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const batch = [
      NAYARA,
      item(
        'owner',
        { op: 'create_relation', type: 'owns', srcId: held.id, dstId: 'nayara' },
        'Rosneft owns the vessel',
      ),
    ];
    const first = batchOf(await proposeOnPage(ask, batch));
    const again = batchOf(await proposeAgain(ask, batch));
    return { first, again, rows: await rowsOfDocument(ask) };
  });
  expect(found.again.proposals.map((one) => one.proposalId)).toStrictEqual(
    found.first.proposals.map((one) => one.proposalId),
  );
  expect(found.again.proposals.map((one) => one.written)).toStrictEqual([false, false]);
  expect(found.rows).toHaveLength(2);
});

// One page can name two units with one label, each under a different parent.
test('two new entities with one type and one label that cite different passages are two acts', async () => {
  const vessel = { op: 'create_entity', type: 'vessel', label: 'Nayara' };
  const batch = [
    item('first', vessel, 'the tanker NAYARA'),
    item('second', vessel, 'On 12 March 2024 the tanker NAYARA, of 41 200 dwt'),
  ];
  const found = await rolledBack('superuser', async (ask) => {
    const first = batchOf(await proposeOnPage(ask, batch));
    const again = batchOf(await proposeAgain(ask, batch));
    return { first, again, rows: await rowsOfDocument(ask) };
  });
  const [one, two] = found.first.proposals;
  expect(one?.proposalId).not.toBe(two?.proposalId);
  expect(found.first.proposals.map((each) => each.written)).toStrictEqual([true, true]);
  expect(found.again.proposals.map((each) => each.proposalId)).toStrictEqual(
    found.first.proposals.map((each) => each.proposalId),
  );
  expect(found.again.proposals.map((each) => each.written)).toStrictEqual([false, false]);
  expect(found.rows).toHaveLength(2);
});

const KEYED = `SELECT e.id::text AS id, k.key, e.attrs -> k.key -> 'v' #>> '{}' AS value
  FROM api.entity e CROSS JOIN LATERAL jsonb_object_keys(e.attrs) AS k(key)
  WHERE jsonb_typeof(e.attrs -> k.key -> 'v') = 'string'
  ORDER BY e.id, k.key LIMIT 1`;

const keyed = z.array(z.object({ id: z.uuid(), key: z.string(), value: z.string() }));

test('propose updates attributes and keeps the documents the value already held', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const [held] = keyed.parse(await ask(KEYED));
    if (held === undefined) throw new Error('the fixture holds no string attribute');
    const outcome = await proposeOnPage(ask, [
      item(
        'update',
        {
          op: 'update_attrs',
          targetKind: 'entity',
          targetId: held.id,
          attrs: { [held.key]: { v: held.value } },
        },
        'the tanker NAYARA',
      ),
    ]);
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.rows[0]?.src).toContain(DOC);
  expect(found.rows[0]?.src).not.toContain('manual');
  expect(found.batch.proposals[0]?.disputed).toBe(true);
});

// An operator signed the value with the document and no page, so the record cites the document
// already. A citation with a page is the only new thing in a second act.
test('propose adds a citation to a value whose document an accepted act cites already, once', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const [held] = keyed.parse(await ask(KEYED));
    if (held === undefined) throw new Error('the fixture holds no string attribute');
    await asResearch(ask, () => withDocument(ask, [PAGE_ONE]));
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    await ask(
      `SELECT public.sign_change('a test', 'update_attrs',
         jsonb_build_object('attrs', jsonb_build_object($1::text,
           jsonb_build_object('v', $2::text, 'src', jsonb_build_array($3::text)))),
         ARRAY[$3], 'entity', $4::uuid, '{}'::uuid[])`,
      [held.key, held.value, DOC, held.id],
    );
    await ask('RESET SESSION AUTHORIZATION');
    const act = item(
      'cite',
      {
        op: 'update_attrs',
        targetKind: 'entity',
        targetId: held.id,
        attrs: { [held.key]: { v: held.value } },
      },
      'the tanker NAYARA',
    );
    return { first: await proposeAgain(ask, [act]), again: await proposeAgain(ask, [act]) };
  });
  expect(batchOf(found.first).proposals).toMatchObject([{ written: true }]);
  expect(batchOf(found.again).proposals).toMatchObject([{ written: false }]);
});

test('propose refuses an act that the write contract refuses, and names the item', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item('blank', { op: 'create_entity', type: '', label: 'Nayara' }, 'the tanker NAYARA'),
    ]),
  );
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(/^item blank: /u) as string,
  });
});

// A page that states the two bounds of an ownership, and two days that the record refuses.
const DATED =
  'Rosneft owned the tanker from 2 May 2019 to 30 November 2023. A charter ran from 12 March ' +
  '2024 to 1 January 2024, and a licence since 30 February 2024.';

const owns = (held: string, bounds: Readonly<Record<string, string>>) => ({
  op: 'create_relation',
  type: 'owns',
  srcId: held,
  dstId: held,
  ...bounds,
});

test('a relation keeps the start and the end that its excerpt states', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const outcome = await proposeOnPage(
      ask,
      [
        item(
          'owner',
          owns(held.id, { validFrom: '2019-05-02', validTo: '2023-11-30' }),
          'Rosneft owned the tanker from 2 May 2019 to 30 November 2023.',
        ),
      ],
      DATED,
    );
    return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { ref: 'owner', written: true, disputed: false, unstated: [], droppedBounds: [] },
  ]);
  expect(found.rows[0]?.payload).toMatchObject({
    valid_from: '2019-05-02',
    valid_to: '2023-11-30',
  });
});

test('a slash date is day/month only when each excerpt comes from the FCDO UK Sanctions List', async () => {
  const page = 'Date Designated: 09/05/2025';
  const other = 'e'.repeat(64);
  const proposed = async (setup: (ask: Ask) => Promise<unknown>, mixed = false) =>
    rolledBack('superuser', async (ask) => {
      const held = await connected(ask);
      await setup(ask);
      const given = item('owner', owns(held.id, { validFrom: '2025-05-09' }), page);
      if (mixed) {
        await asResearch(ask, async () => {
          await ask(STORE, [
            'url',
            'Another list',
            `raw/${other}`,
            'https://example.org/list',
            other,
            'text/csv',
            TODAY,
            null,
          ]);
          await ask(WRITE_TEXT, [
            `doc_${other.slice(0, 12)}`,
            JSON.stringify([page]),
            'tool-test-1',
          ]);
        });
        Object.assign(given, {
          evidence: [
            { document: DOC, page: 1, excerpt: page },
            { document: `doc_${other.slice(0, 12)}`, page: 1, excerpt: page },
          ],
        });
      }
      const outcome = await proposeAgain(ask, [given]);
      return { batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
    });
  const atAddress = (uri: string) => (ask: Ask) =>
    asResearch(ask, () => withDocument(ask, [page], uri));
  const uk = await proposed(atAddress(UK_LIST_CSV));
  expect(uk.batch.proposals).toMatchObject([{ unstated: [], droppedBounds: [] }]);
  expect(uk.rows[0]?.payload).toMatchObject({ valid_from: '2025-05-09' });
  // The bytes were stored first at another address, and the UK tool gave them its provider.
  const byProvider = await proposed(async (ask) => {
    await atAddress('https://example.org/report')(ask);
    await ask("UPDATE public.documents SET provider_id = 'uk_sanctions_list' WHERE id = $1", [DOC]);
  });
  expect(byProvider.batch.proposals).toMatchObject([{ droppedBounds: [] }]);
  for (const found of [
    await proposed(atAddress('https://example.org/report')),
    await proposed(atAddress(UK_LIST_CSV), true),
  ]) {
    expect(found.batch.proposals).toMatchObject([{ droppedBounds: ['validFrom'] }]);
    expect(found.rows[0]?.payload).not.toHaveProperty('valid_from');
  }
});

// The claim that the checker reads, for each item of the last batch.
const claimsRead: unknown[] = [];
const reading: Reach = {
  now: () => new Date(),
  check: async (items) => {
    claimsRead.push(...items.map((one) => one.claim.act));
    return Promise.resolve(
      new Map(items.map((one) => [one.ref, { verdict: 'supported' as const }])),
    );
  },
};

test('a start that no excerpt states is not proposed, and the checker does not read it', async () => {
  claimsRead.length = 0;
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    await asResearch(ask, () => withDocument(ask, [DATED]));
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
    const outcome = await callTool(
      toolNamed('propose'),
      sessionOf(ask),
      {
        items: [
          item(
            'owner',
            owns(held.id, { validFrom: '2018-01-01', validTo: '2023-11-30' }),
            'Rosneft owned the tanker from 2 May 2019 to 30 November 2023.',
          ),
        ],
      },
      reading,
    );
    await ask('RESET SESSION AUTHORIZATION');
    return { held, batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { written: true, disputed: false, unstated: [], droppedBounds: ['validFrom'] },
  ]);
  expect(found.rows[0]?.payload).toMatchObject({ valid_to: '2023-11-30' });
  expect(found.rows[0]?.payload).not.toHaveProperty('valid_from');
  expect(claimsRead).toStrictEqual([
    {
      op: 'create_relation',
      type: 'owns',
      srcId: found.held.id,
      dstId: found.held.id,
      validTo: '2023-11-30',
    },
  ]);
});

test('an end that no excerpt states refuses the batch of the research AI, and names the bound', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const outcome = await proposeOnPage(
      ask,
      [
        item(
          'owner',
          owns(held.id, { validFrom: '2019-05-02', validTo: '2024-06-30' }),
          'Rosneft owned the tanker from 2 May 2019',
        ),
      ],
      DATED,
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(
      /^item owner: no excerpt states the end date 2024-06-30 \(validTo\)/u,
    ) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

// An open owns relation of the record, which the operator signs in the transaction of the test.
// A null start gives a relation with no start.
const openOwns = async (ask: Ask, validFrom: string | null): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const signed = z.array(z.object({ target_id: z.uuid() }));
  const sign = async (op: string, payload: object, names: readonly string[] = []) => {
    const [row] = signed.parse(
      await ask(
        `SELECT target_id FROM public.sign_change('a test', $1, $2::jsonb, ARRAY['manual'],
           NULL, NULL, $3::uuid[])`,
        [op, JSON.stringify(payload), names],
      ),
    );
    if (row === undefined) throw new Error('the act was not signed');
    return row.target_id;
  };
  const owner = await sign('create_entity', {
    type: 'company',
    label: 'Rosneft',
    sources: ['manual'],
  });
  const vessel = await sign('create_entity', {
    type: 'vessel',
    label: 'A tanker',
    sources: ['manual'],
  });
  const owns = await sign(
    'create_relation',
    {
      type: 'owns',
      src_id: owner,
      dst_id: vessel,
      ...(validFrom === null ? {} : { valid_from: validFrom }),
      sources: ['manual'],
    },
    [owner, vessel],
  );
  await ask('RESET SESSION AUTHORIZATION');
  return owns;
};

const closing = (target: string, validTo: string, excerpt: string) =>
  item('close', { op: 'update_relation', targetId: target, validTo }, excerpt);

test('propose gives an open relation the end date that its excerpt states', async () => {
  claimsRead.length = 0;
  const found = await rolledBack('superuser', async (ask) => {
    const owns = await openOwns(ask, '2019-05-02');
    await asResearch(ask, () => withDocument(ask, [DATED]));
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
    const outcome = await callTool(
      toolNamed('propose'),
      sessionOf(ask),
      {
        items: [
          closing(
            owns,
            '2023-11-30',
            'Rosneft owned the tanker from 2 May 2019 to 30 November 2023.',
          ),
        ],
      },
      reading,
    );
    await ask('RESET SESSION AUTHORIZATION');
    return { owns, batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { ref: 'close', written: true, disputed: false, unstated: [], droppedBounds: [] },
  ]);
  expect(found.rows[0]?.payload).toStrictEqual({ valid_to: '2023-11-30' });
  // The checker reads the relation in words, because it reads no record.
  expect(claimsRead).toStrictEqual([
    {
      op: 'update_relation',
      targetId: found.owns,
      validTo: '2023-11-30',
      relation: 'Rosneft owns A tanker',
    },
  ]);
});

test.for([
  [
    'an end that no excerpt states',
    '2024-06-30',
    'Rosneft owned the tanker from 2 May 2019',
    'item close: no excerpt states the end date 2024-06-30 (validTo)',
  ],
  [
    'an end before the start',
    '2019-05-01',
    'It changed hands on 1 May 2019.',
    'item close: act.validTo: the relation starts on 2019-05-02, and it cannot end before',
  ],
] as const)('propose refuses %s of an open relation', async ([, validTo, excerpt, said]) => {
  const found = await rolledBack('superuser', async (ask) => {
    const owns = await openOwns(ask, '2019-05-02');
    const outcome = await proposeOnPage(
      ask,
      [closing(owns, validTo, excerpt)],
      `${DATED} It changed hands on 1 May 2019.`,
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(said) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

const starting = (target: string, validFrom: string, excerpt: string) =>
  item('start', { op: 'update_relation', targetId: target, validFrom }, excerpt);

test('propose gives a relation with no start the start date that its excerpt states', async () => {
  claimsRead.length = 0;
  const found = await rolledBack('superuser', async (ask) => {
    const owns = await openOwns(ask, null);
    await asResearch(ask, () => withDocument(ask, [DATED]));
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
    const outcome = await callTool(
      toolNamed('propose'),
      sessionOf(ask),
      { items: [starting(owns, '2019-05-02', 'Rosneft owned the tanker from 2 May 2019')] },
      reading,
    );
    await ask('RESET SESSION AUTHORIZATION');
    return { owns, batch: batchOf(outcome), rows: await rowsOfDocument(ask) };
  });
  expect(found.batch.proposals).toMatchObject([
    { ref: 'start', written: true, disputed: false, unstated: [], droppedBounds: [] },
  ]);
  expect(found.rows[0]?.payload).toStrictEqual({ valid_from: '2019-05-02' });
  expect(claimsRead).toStrictEqual([
    {
      op: 'update_relation',
      targetId: found.owns,
      validFrom: '2019-05-02',
      relation: 'Rosneft owns A tanker',
    },
  ]);
});

test.for([
  [
    'a start that no excerpt states',
    null,
    '2018-01-01',
    'item start: no excerpt states the start date 2018-01-01 (validFrom)',
  ],
  [
    'a second start',
    '2019-05-02',
    '2019-05-02',
    'item start: act.validFrom: the relation started on 2019-05-02 already',
  ],
] as const)('propose refuses %s of a relation', async ([, held, validFrom, said]) => {
  const found = await rolledBack('superuser', async (ask) => {
    const owns = await openOwns(ask, held);
    const outcome = await proposeOnPage(
      ask,
      [starting(owns, validFrom, 'Rosneft owned the tanker from 2 May 2019')],
      DATED,
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(said) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

// A designated_by relation of the record, which the operator signs in the transaction of the test.
const designatedRelation = async (ask: Ask, type = 'designated_by'): Promise<string> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const signed = z.array(z.object({ target_id: z.uuid() }));
  const sign = async (op: string, payload: object, names: readonly string[] = []) => {
    const [row] = signed.parse(
      await ask(
        `SELECT target_id FROM public.sign_change('a test', $1, $2::jsonb, ARRAY['manual'],
           NULL, NULL, $3::uuid[])`,
        [op, JSON.stringify(payload), names],
      ),
    );
    if (row === undefined) throw new Error('the act was not signed');
    return row.target_id;
  };
  const bank = await sign('create_entity', { type: 'bank', label: 'A bank', sources: ['manual'] });
  const body = await sign('create_entity', {
    type: 'state_body',
    label: 'A treasury',
    sources: ['manual'],
  });
  const held = await sign(
    'create_relation',
    { type, src_id: bank, dst_id: body, valid_from: '2022-02-24', sources: ['manual'] },
    [bank, body],
  );
  await ask('RESET SESSION AUTHORIZATION');
  return held;
};

const retyping = (target: string, excerpt: string) =>
  item('retype', { op: 'update_relation', targetId: target, type: 'restricted_by' }, excerpt);

const DIRECTIVE = 'Directive 4 under Executive Order 14024 restricts the A bank.';

test('propose changes the type of a relation when its excerpt names the provision', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await designatedRelation(ask);
    const outcome = await proposeOnPage(
      ask,
      [retyping(held, 'Directive 4 under Executive Order 14024')],
      DIRECTIVE,
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(batchOf(found.outcome).proposals).toMatchObject([
    { ref: 'retype', written: true, disputed: false, unstated: [], droppedBounds: [] },
  ]);
  expect(found.rows[0]?.payload).toStrictEqual({ type: 'restricted_by' });
});

test.for([
  [
    'an excerpt that names no provision',
    'designated_by',
    'restricts the A bank',
    'names the provision',
  ],
  ['a relation of another type', 'owns', 'Directive 4 under Executive', 'only designated_by'],
] as const)('propose refuses a type change with %s', async ([, type, excerpt, said]) => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await designatedRelation(ask, type);
    const outcome = await proposeOnPage(ask, [retyping(held, excerpt)], DIRECTIVE);
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(said) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

// The record holds these rules at the insert, so a bad act never waits in the review queue. The
// refusal names the item, the field and the sentence of the rule.
test.for([
  [
    'an interval that starts after it ends',
    { validFrom: '2024-03-12', validTo: '2024-01-01' },
    'item owner: act.validFrom: an interval starts on or before the day it ends',
  ],
  [
    'an interval on a type that takes none',
    { type: 'berthed_at', validFrom: '2024-03-12' },
    'item owner: act.validFrom: a relation of type berthed_at takes no interval',
  ],
  [
    'a day that the calendar does not hold',
    { validFrom: '2024-02-30' },
    'item owner: act.validFrom: a new relation has a type and two ends',
  ],
] as const)('propose refuses %s at the insert', async ([, change, said]) => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await connected(ask);
    const outcome = await proposeOnPage(
      ask,
      [
        item(
          'owner',
          { op: 'create_relation', type: 'owns', srcId: held.id, dstId: held.id, ...change },
          'A charter ran from 12 March 2024 to 1 January 2024, and a licence since 30 February 2024.',
        ),
      ],
      DATED,
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(said) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

test('propose refuses a geometry that is no valid shape on the globe at the insert', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item(
        'nayara',
        {
          op: 'create_entity',
          type: 'vessel',
          label: 'Nayara',
          geom: { type: 'LineString', coordinates: [[69.6, 22.4]] },
          geomMethod: 'source_coordinates',
        },
        'the tanker NAYARA',
      ),
    ]),
  );
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(
      'item nayara: act.geom: the geometry is not a valid shape on the globe',
    ) as string,
  });
});

test('propose refuses a position past the pole at the insert', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item(
        'nayara',
        {
          op: 'create_entity',
          type: 'vessel',
          label: 'Nayara',
          geom: { type: 'Point', coordinates: [69.6, -91] },
          geomMethod: 'source_coordinates',
        },
        'the tanker NAYARA',
      ),
    ]),
  );
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('item nayara: act.geom: each position') as string,
  });
});

test.each([
  [
    'a new entity',
    { op: 'create_entity', type: 'vessel', label: 'Nayara' },
    'item nayara: a geom needs geomMethod',
  ],
  [
    'a change of place',
    { op: 'update_entity', targetId: ABSENT },
    'item nayara: a geom needs geomMethod',
  ],
])('propose refuses a place with no method of geolocation for %s', async (_case, act, said) => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item('nayara', { ...act, geom: { type: 'Point', coordinates: [69.6, 22.4] } }, 'NAYARA'),
    ]),
  );
  expect(outcome).toMatchObject({ ok: false, refusal: expect.stringContaining(said) as string });
});

test('propose refuses a word outside the list of the methods of geolocation', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item(
        'nayara',
        {
          op: 'create_entity',
          type: 'vessel',
          label: 'Nayara',
          geom: { type: 'Point', coordinates: [69.6, 22.4] },
          geomMethod: 'guess',
        },
        'the tanker NAYARA',
      ),
    ]),
  );
  expect(outcome).toMatchObject({ ok: false });
});

test('propose refuses an update of a target that does not exist', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item(
        'update',
        {
          op: 'update_attrs',
          targetKind: 'entity',
          targetId: ABSENT,
          attrs: { flag: { v: 'PA' } },
        },
        'the tanker NAYARA',
      ),
    ]),
  );
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(`item update: the target ${ABSENT} does not exist`) as string,
  });
});

const LOCODE = "RU  ULU  Ust'-Luga  5940N 02819E";
const ULU = { type: 'Point', coordinates: [28.3167, 59.6667] };

// Two entities of the fixture: the first one with no place, the second one at 10 N, 20 E.
const placedPair = async (ask: Ask): Promise<readonly [string, string]> => {
  const [bare, moved] = z
    .array(z.object({ id: z.uuid() }))
    .parse(await ask('SELECT id::text AS id FROM public.entities ORDER BY id LIMIT 2'))
    .map((one) => one.id);
  if (bare === undefined || moved === undefined) throw new Error('the fixture holds no entity');
  await ask(
    `UPDATE public.entities SET geom = CASE WHEN id = $2::uuid
       THEN public.ST_SetSRID(public.ST_MakePoint(20, 10), 4326) END
     WHERE id IN ($1::uuid, $2::uuid)`,
    [bare, moved],
  );
  return [bare, moved];
};

test('propose gives a place to an entity of the record, and a different place is a doubt', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const [bare, moved] = await placedPair(ask);
    const place = (ref: string, targetId: string, geom: unknown) =>
      item(
        ref,
        { op: 'update_entity', targetId, geom, geomMethod: 'source_coordinates' },
        '5940N 02819E',
      );
    const outcome = await proposeOnPage(
      ask,
      [
        place('bare', bare, ULU),
        place('moved', moved, ULU),
        place('far', bare, { type: 'Point', coordinates: [30.5, 50.4] }),
      ],
      LOCODE,
    );
    const faults = z
      .array(
        z.object({
          id: z.uuid(),
          payload: z.unknown(),
          src: z.array(z.string()),
          kinds: z.array(z.string()),
        }),
      )
      .parse(
        await ask(
          `SELECT p.target_id::text AS id, p.payload, p.src::text[] AS src,
                  ARRAY(SELECT k->>'kind' FROM public.unit_faults(ARRAY[p.unit_id]) f,
                        jsonb_array_elements(f.faults) k) AS kinds
             FROM public.proposals p
            WHERE p.op = 'update_entity' AND p.src::text[] @> ARRAY[$1::text]
            ORDER BY p.created_at, p.id`,
          [DOC],
        ),
      );
    return { batch: batchOf(outcome), faults, bare, moved };
  });
  expect(found.batch.proposals).toMatchObject([
    { ref: 'bare', written: true, disputed: false, unstated: [] },
    { ref: 'moved', written: true, disputed: false, unstated: [] },
    { ref: 'far', written: true, disputed: true, unstated: ['geom.longitude', 'geom.latitude'] },
  ]);
  const of = (id: string, geom: unknown) =>
    found.faults.find(
      (one) =>
        one.id === id &&
        isDeepStrictEqual(one.payload, { geom, geom_method: 'source_coordinates' }),
    );
  expect(of(found.bare, ULU)).toMatchObject({ src: [DOC] });
  expect(of(found.bare, ULU)?.kinds).not.toContain('record_disagrees');
  expect(of(found.moved, ULU)?.kinds).toContain('record_disagrees');
});

test('propose refuses the place that an entity of the record has already', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const [, moved] = await placedPair(ask);
    return proposeOnPage(ask, [
      item(
        'same',
        {
          op: 'update_entity',
          targetId: moved,
          geom: { type: 'Point', coordinates: [20, 10] },
          geomMethod: 'source_coordinates',
        },
        'left Sikka',
      ),
    ]);
  });
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('item same: the entity') as string,
  });
  expect(outcome).toMatchObject({
    refusal: expect.stringContaining('has this place already') as string,
  });
});

test.each([
  ['an entity with a place', true, {}, { ok: true }],
  ['a method beside it', true, { geomMethod: 'osm_object' }, { ok: false }],
  [
    'an entity with no place',
    false,
    {},
    { ok: false, refusal: expect.stringContaining('has no place to clear') as string },
  ],
])('propose clears the place with geom null: %s', async (_case, placed, more, expected) => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const [bare, moved] = await placedPair(ask);
    return proposeOnPage(ask, [
      item(
        'clear',
        { op: 'update_entity', targetId: placed ? moved : bare, geom: null, ...more },
        'left Sikka',
      ),
    ]);
  });
  expect(outcome).toMatchObject(expected);
});

test('propose refuses a place on an entity that does not exist', async () => {
  const outcome = await rolledBack('superuser', async (ask) =>
    proposeOnPage(ask, [
      item(
        'place',
        {
          op: 'update_entity',
          targetId: ABSENT,
          geom: { type: 'Point', coordinates: [28, 59] },
          geomMethod: 'source_coordinates',
        },
        'left Sikka',
      ),
    ]),
  );
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(`item place: the target ${ABSENT} does not exist`) as string,
  });
});

// A new entity waits in the queue, and a later call gives its place from a UN/LOCODE line.
const placeOfPending = async (ask: Ask, geom: unknown = ULU, created?: unknown) => {
  const vesselItem =
    created === undefined
      ? NAYARA
      : item(
          'nayara',
          {
            op: 'create_entity',
            type: 'vessel',
            label: 'Nayara',
            geom: created,
            geomMethod: 'source_coordinates',
          },
          '5940N 02819E',
        );
  const [vessel] = batchOf(
    await proposeOnPage(ask, [vesselItem], `${PAGE_ONE}\n${LOCODE}`),
  ).proposals;
  if (vessel === undefined) throw new Error('propose wrote no entity');
  const outcome = await proposeAgain(ask, [
    item(
      'place',
      { op: 'update_entity', targetId: vessel.proposalId, geom, geomMethod: 'source_coordinates' },
      '5940N 02819E',
    ),
  ]);
  return { vessel: vessel.proposalId, outcome };
};

const placeUnit = z.array(z.object({ id: z.uuid(), unit_id: z.uuid(), status: z.string() }));
const PLACE_ACT = `SELECT id::text AS id, unit_id::text AS unit_id, status FROM public.proposals
  WHERE op = 'update_entity' AND target_id = $1`;

test('a place of a new entity that waits joins its unit, and is written after the entity', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { vessel, outcome } = await placeOfPending(ask);
    const [placed] = batchOf(outcome).proposals;
    const [page] = z
      .array(
        z.object({
          page: z.object({
            units: z.array(
              z.object({
                unit: z.uuid(),
                acts: z.array(z.object({ id: z.uuid(), op: z.string() })),
              }),
            ),
          }),
        }),
      )
      .parse(
        await ask('SELECT public.review_units(NULL, 200, p_unit => $1::uuid) AS page', [vessel]),
      );
    const before = placeUnit.parse(await ask(PLACE_ACT, [vessel]));
    // An act is never decided by the transaction that proposed it, so the test dates it back.
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE unit_id = $1", [vessel]);
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    await ask("SELECT public.promote_unit($1::uuid, 'a test')", [vessel]);
    const [entity] = z.array(z.object({ same: z.boolean() })).parse(
      await ask(
        `SELECT public.ST_Equals(geom, public.ST_SetSRID(public.ST_MakePoint(28.3167, 59.6667),
             4326)) AS same FROM public.entities WHERE id = $1`,
        [vessel],
      ),
    );
    return {
      vessel,
      placed: placed?.proposalId,
      units: page?.page.units ?? [],
      before,
      after: placeUnit.parse(await ask(PLACE_ACT, [vessel])),
      entity,
    };
  });
  expect(found.before).toStrictEqual([
    { id: found.placed, unit_id: found.vessel, status: 'pending' },
  ]);
  expect(found.units).toHaveLength(1);
  expect(found.units[0]?.acts.map((act) => act.op)).toStrictEqual([
    'create_entity',
    'update_entity',
  ]);
  expect(found.after).toStrictEqual([
    { id: found.placed, unit_id: found.vessel, status: 'accepted' },
  ]);
  expect(found.entity).toStrictEqual({ same: true });
});

test('propose refuses a clear of the place of a new entity that waits with no place', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const [vessel] = batchOf(
      await proposeOnPage(
        ask,
        [NAYARA],
        `${PAGE_ONE}
${LOCODE}`,
      ),
    ).proposals;
    if (vessel === undefined) throw new Error('propose wrote no entity');
    const outcome = await proposeAgain(ask, [
      item(
        'clear',
        { op: 'update_entity', targetId: vessel.proposalId, geom: null },
        '5940N 02819E',
      ),
    ]);
    return { vessel: vessel.proposalId, outcome };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(
      `the new entity ${found.vessel} has no place to clear`,
    ) as string,
  });
});

test('a rejection of the new entity rejects its place as "end rejected"', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { vessel, outcome } = await placeOfPending(ask);
    const [placed] = batchOf(outcome).proposals;
    if (placed === undefined) throw new Error('propose wrote no place');
    await ask("SELECT public.reject_unit($1::uuid, 'wrong_value', NULL, 'a test')", [vessel]);
    return {
      vessel,
      placed: placed.proposalId,
      rows: await decisionsOf(ask, [vessel, placed.proposalId]),
    };
  });
  expect(found.rows.get(found.vessel)).toMatchObject({
    status: 'rejected',
    reject_reason: 'wrong_value',
  });
  expect(found.rows.get(found.placed)).toMatchObject({
    status: 'rejected',
    reject_reason: 'end_rejected',
  });
});

test('propose refuses the place that a new entity that waits gives already', async () => {
  const outcome = await rolledBack('superuser', async (ask) => placeOfPending(ask, ULU, ULU));
  expect(outcome.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(
      `item place: the new entity ${outcome.vessel} has this place already`,
    ) as string,
  });
});

test('a place that differs from the place of the new entity is a doubt', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { vessel, outcome } = await placeOfPending(ask, ULU, {
      type: 'Point',
      coordinates: [28, 59],
    });
    batchOf(outcome);
    const [row] = z.array(z.object({ kinds: z.array(z.string()) })).parse(
      await ask(
        `SELECT ARRAY(SELECT k->>'kind' FROM public.unit_faults(ARRAY[$1::uuid]) f,
                  jsonb_array_elements(f.faults) k) AS kinds`,
        [vessel],
      ),
    );
    return row?.kinds ?? [];
  });
  expect(found).toContain('record_disagrees');
});

test('two different places of one new entity that waits are a doubt', async () => {
  const said = await rolledBack('superuser', async (ask) => {
    const { vessel, outcome } = await placeOfPending(ask);
    batchOf(outcome);
    batchOf(
      await proposeAgain(ask, [
        item(
          'other',
          {
            op: 'update_entity',
            targetId: vessel,
            geom: { type: 'Point', coordinates: [30.5, 50.4] },
            geomMethod: 'source_coordinates',
          },
          '5940N 02819E',
        ),
      ]),
    );
    return z
      .array(z.object({ said: z.string() }))
      .parse(
        await ask(
          `SELECT k->>'said' AS said FROM public.unit_faults(ARRAY[$1::uuid]) f,
                  jsonb_array_elements(f.faults) k WHERE k->>'kind' = 'record_disagrees'`,
          [vessel],
        ),
      )
      .map((one) => one.said);
  });
  // The reason gives the gap between the two points.
  expect(said).toContainEqual(
    expect.stringMatching(
      /^Another change of place of the unit gives another geometry, \d+ m apart$/u,
    ),
  );
});

test('propose refuses new attributes of a new entity that waits, and tells the agent to wait', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const [vessel] = batchOf(await proposeOnPage(ask, [NAYARA])).proposals;
    if (vessel === undefined) throw new Error('propose wrote no entity');
    return {
      vessel: vessel.proposalId,
      got: await proposeAgain(ask, [
        item(
          'attrs',
          {
            op: 'update_attrs',
            targetKind: 'entity',
            targetId: vessel.proposalId,
            attrs: { capacity_dwt: { v: 41200 } },
          },
          'of 41 200 dwt',
        ),
      ]),
    };
  });
  expect(outcome.got).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(
      `item attrs: the new entity ${outcome.vessel} waits in the review queue`,
    ) as string,
  });
});

test('propose refuses a page of a document that holds no stored text', async () => {
  const outcome = await rolledBack('research', (ask) => call(ask, 'propose', { items: [NAYARA] }));
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(`item nayara: document ${DOC} has no page 1`) as string,
  });
});

// ------------------------------------------------------- enqueue_extract ---

const JOBS = z.object({ document: z.string(), jobs: z.array(z.unknown()) });

test('enqueue_extract of a document that does not exist is a fault of the database', async () => {
  await expect(
    rolledBack('research', (ask) => call(ask, 'enqueue_extract', { document: 'doc_absent' })),
  ).rejects.toMatchObject({ code: '23503' });
});

test('enqueue_mapping of a document that does not exist is a fault of the database', async () => {
  await expect(
    rolledBack('research', (ask) => call(ask, 'enqueue_mapping', { document: 'doc_absent' })),
  ).rejects.toMatchObject({ code: '23503' });
});

const QUEUED = z.object({ jobId: z.uuid() });

test('enqueue_mapping queues one mapping job, job_status shows it, and a second call refuses', async () => {
  const seen = await rolledBack('research', async (ask) => {
    await withDocument(ask, ['Vessel,IMO\nNayara,9074729']);
    const queued = QUEUED.parse(await output(ask, 'enqueue_mapping', { document: DOC }));
    return {
      queued,
      status: JOBS.parse(await output(ask, 'job_status', { document: DOC })),
      // A refusal of the door aborts the transaction, so the refused call comes last.
      extract: await call(ask, 'enqueue_extract', { document: DOC }),
      again: await call(ask, 'enqueue_mapping', { document: DOC }),
    };
  });
  expect(seen.status.jobs).toMatchObject([
    { id: seen.queued.jobId, kind: 'map_structured', status: 'queued' },
  ]);
  expect(seen.again).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('queued or runs already') as string,
  });
  // Each tool keeps one job, so an open mapping does not stop the extraction of the document.
  expect(seen.extract.ok).toBe(true);
});

test('job_status of a document with no job is an empty list', async () => {
  const found = await rolledBack('research', async (ask) =>
    JOBS.parse(await output(ask, 'job_status', { document: 'doc_absent' })),
  );
  expect(found.jobs).toStrictEqual([]);
});

test('the reason of a doubt of place gives the gap, and the limit of the role of the point', async () => {
  const said = await rolledBack('superuser', async (ask) =>
    z.array(z.object({ said: z.string() })).parse(
      await ask(
        `SELECT public.place_gap_said(public.ST_MakePoint(32.0, 59.44), public.ST_MakePoint(a, b),
                                      held, given) AS said
           FROM (VALUES (32.0, 59.4517, NULL, NULL), (32.0, 59.4517, 'plant', 'plant'),
                        (32.0, 59.4517, NULL, 'gate'), (32.0, 59.4517, 'plant', 'gate'),
                        (32.0, 59.4419, 'gate', 'gate'),
                        (32.0, 59.4405, 'berth', NULL))
                AS v(a, b, held, given)`,
      ),
    ),
  );
  expect(said.map((row) => row.said)).toStrictEqual([
    ', 1303 m apart',
    ', 1303 m apart, more than the 1000 m of one plant: two sources give two places',
    ', 1303 m apart',
    ', 1303 m apart, and the two points have two roles (plant, gate), so they are not compared',
    ', 212 m apart, more than the 200 m of one gate: two sources give two places',
    ', 56 m apart',
  ]);
  // An empty geometry gives no gap, and the reason keeps its words.
  const empty = await rolledBack('superuser', async (ask) =>
    ask(
      `SELECT public.place_gap_said(public.ST_MakePoint(32.0, 59.44),
                                    'POINT EMPTY'::public.geometry, NULL, NULL) AS said`,
    ),
  );
  expect(empty).toStrictEqual([{ said: '' }]);
});

const sourcing = (target: string, excerpt: string) =>
  item('source', { op: 'add_source', targetId: target }, excerpt);

test('propose adds a source to a relation when its excerpt names the act', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await designatedRelation(ask);
    const outcome = await proposeOnPage(
      ask,
      [sourcing(held, 'A treasury lists A bank')],
      'A treasury lists A bank under its list.',
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(batchOf(found.outcome).proposals).toMatchObject([
    { ref: 'source', written: true, disputed: false, unstated: [], droppedBounds: [] },
  ]);
  expect(found.rows[0]?.payload).toStrictEqual({ add_source: true });
});

const LISTING = 'A treasury lists A bank under its list.';

// The relation cites the document already: an operator signed the first source act.
const citedRelation = async (ask: Ask): Promise<string> => {
  const held = await designatedRelation(ask);
  await asResearch(ask, () => withDocument(ask, [LISTING]));
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  await ask(
    `SELECT public.sign_change('a test', 'update_relation', '{"add_source": true}'::jsonb,
       ARRAY[$1], 'relation', $2::uuid, '{}'::uuid[])`,
    [DOC, held],
  );
  await ask('RESET SESSION AUTHORIZATION');
  return held;
};

const citationsOf = async (ask: Ask, held: string): Promise<number> =>
  z.array(z.object({ n: z.coerce.number() })).parse(
    await ask(
      `SELECT count(*) AS n FROM public.citation c JOIN public.proposals p ON p.id = c.claim_id
          WHERE p.target_id = $1 AND p.status = 'pending'`,
      [held],
    ),
  )[0]?.n ?? 0;

test('propose adds a citation to a document that the relation cites already, once', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await citedRelation(ask);
    const first = await proposeAgain(ask, [sourcing(held, 'A treasury lists A bank')]);
    const again = await proposeAgain(ask, [sourcing(held, 'A treasury lists A bank')]);
    const sources = await ask('SELECT sources::text[] AS s FROM public.relations WHERE id = $1', [
      held,
    ]);
    return { first, again, sources, rows: await citationsOf(ask, held) };
  });
  expect(batchOf(found.first).proposals).toMatchObject([{ written: true }]);
  expect(batchOf(found.again).proposals).toMatchObject([{ written: false }]);
  expect(found.rows).toBe(1);
  expect(found.sources).toStrictEqual([{ s: ['manual', DOC] }]);
});

test('propose refuses a citation whose excerpt the page does not hold, on a cited document', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const held = await citedRelation(ask);
    return proposeAgain(ask, [sourcing(held, 'A treasury bans A bank')]);
  });
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringMatching(/^item source: .*does not hold the excerpt/u) as string,
  });
});

test('propose refuses a citation that a promoted act of the relation holds already', async () => {
  const outcome = await rolledBack('superuser', async (ask) => {
    const held = await citedRelation(ask);
    const first = batchOf(await proposeAgain(ask, [sourcing(held, 'A treasury lists A bank')]));
    // An act is never decided by the transaction that proposed it, so the test dates it back.
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE id = $1::uuid", [
      first.proposals[0]?.proposalId,
    ]);
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    const [unit] = z
      .array(z.object({ unit_id: z.uuid() }))
      .parse(
        await ask('SELECT unit_id FROM public.proposals WHERE id = $1::uuid', [
          first.proposals[0]?.proposalId,
        ]),
      );
    await ask("SELECT public.promote_unit($1::uuid, 'a test')", [unit?.unit_id]);
    return proposeAgain(ask, [sourcing(held, 'A treasury lists A bank')]);
  });
  expect(outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('adds no source') as string,
  });
});

test('propose adds a source to a relation when its excerpt holds a Cyrillic name of the far end', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await designatedRelation(ask);
    await ask(
      `UPDATE public.entities SET attrs = attrs || '{"label_cyrillic":{"v":"Кавказ","src":["manual"]}}'::jsonb
        WHERE label = 'A treasury'`,
    );
    return proposeOnPage(
      ask,
      [sourcing(held, 'порту "Кавказ"')],
      'Удар по порту "Кавказ" в ночь на вторник.',
    );
  });
  expect(batchOf(found).proposals).toMatchObject([{ ref: 'source', written: true }]);
});

test('propose refuses a source whose excerpt holds only an alias under 4 characters', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await designatedRelation(ask);
    await ask(
      `UPDATE public.entities SET attrs = attrs || '{"aliases":{"v":["Kav"],"src":["manual"]}}'::jsonb
        WHERE label = 'A treasury'`,
    );
    return proposeOnPage(ask, [sourcing(held, 'Kav')], 'Kav was hit.');
  });
  expect(found).toMatchObject({ ok: false });
});

test('propose refuses a source whose excerpt names no end of the relation', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const held = await designatedRelation(ask);
    const outcome = await proposeOnPage(
      ask,
      [sourcing(held, 'An unrelated line')],
      'An unrelated line of another entry.',
    );
    return { outcome, rows: await rowsOfDocument(ask) };
  });
  expect(found.outcome).toMatchObject({
    ok: false,
    refusal: expect.stringContaining(
      'item source: no excerpt of a cited document names an end of the relation',
    ) as string,
  });
  expect(found.rows).toStrictEqual([]);
});

// An event of the record and, when asked, the occurred_at relation that places it at a site.
const placedEvent = async (
  ask: Ask,
  placed = true,
): Promise<{ event: string; relation: string }> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const signed = z.array(z.object({ target_id: z.uuid() }));
  const sign = async (op: string, payload: object, names: readonly string[] = []) => {
    const [row] = signed.parse(
      await ask(
        `SELECT target_id FROM public.sign_change('a test', $1, $2::jsonb, ARRAY['manual'],
           NULL, NULL, $3::uuid[])`,
        [op, JSON.stringify(payload), names],
      ),
    );
    if (row === undefined) throw new Error('the act was not signed');
    return row.target_id;
  };
  const event = await sign('create_entity', {
    type: 'event',
    label: 'claimed attack — Plant — 2025-03-03',
    sources: ['manual'],
  });
  const site = await sign('create_entity', {
    type: 'facility',
    label: 'Plant',
    sources: ['manual'],
  });
  const relation = placed
    ? await sign(
        'create_relation',
        { type: 'occurred_at', src_id: event, dst_id: site, sources: ['manual'] },
        [event, site],
      )
    : '';
  await ask('RESET SESSION AUTHORIZATION');
  return { event, relation };
};

const denial = (target: string) => ({
  ...sourcing(target, 'the Plant refinery'),
  originator: 'The governor',
  modality: 'denies',
});

test('propose denies an event of the record: the denial goes to its occurred_at relation', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { event, relation } = await placedEvent(ask);
    const outcome = await proposeOnPage(
      ask,
      [denial(event)],
      'The governor says the Plant refinery was not hit.',
    );
    const [target] = z.array(z.object({ target_id: z.string(), modality: z.string() })).parse(
      await ask(
        `SELECT p.target_id::text AS target_id, c.modality FROM public.proposals p
             JOIN public.citation c ON c.claim_id = p.id WHERE p.src::text[] @> ARRAY[$1::text]`,
        [DOC],
      ),
    );
    return { outcome, target, relation };
  });
  expect(batchOf(found.outcome).proposals).toMatchObject([{ ref: 'source', written: true }]);
  expect(found.target).toStrictEqual({ target_id: found.relation, modality: 'denies' });
});

test('propose refuses the denial of an event that has no occurred_at relation of the record', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { event } = await placedEvent(ask, false);
    return proposeOnPage(ask, [denial(event)], 'The governor says the Plant refinery was not hit.');
  });
  expect(found).toMatchObject({
    ok: false,
    refusal: expect.stringContaining('has no occurred_at relation of the record') as string,
  });
});

// ------------------------------------------------ read_duplicate_identifiers ---

test('read_duplicate_identifiers flags two entities with one INN, and not a third with another', async () => {
  await rolledBack('superuser', async (ask) => {
    const made = z.array(z.object({ id: z.uuid() }));
    const plant = async (label: string, inn: string): Promise<string> => {
      await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
      const [act] = made.parse(
        await ask(`SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[]) AS id`, [
          'create_entity',
          JSON.stringify({ type: 'company', label }),
        ]),
      );
      await ask('RESET SESSION AUTHORIZATION');
      const [row] = made.parse(
        await ask(
          `INSERT INTO public.entities (type, label, attrs, sources, promoted_from)
           VALUES ('company', $1, jsonb_build_object('tax_id', jsonb_build_object('v', $2::text, 'src', jsonb_build_array('manual'))),
                   ARRAY['manual']::doc_id[], $3) RETURNING id`,
          [label, inn, act?.id],
        ),
      );
      if (row === undefined) throw new Error('no entity came back');
      return row.id;
    };
    const inn = `99${randomUUID().replaceAll('-', '').slice(0, 10)}`.toUpperCase();
    const a = await plant('Dup A', inn);
    const b = await plant('Dup B', inn);
    await plant('Other', `${inn}0`);
    const found = z
      .object({
        groups: z.array(
          z.object({
            key: z.string(),
            value: z.string(),
            entities: z.array(z.object({ id: z.uuid() })),
          }),
        ),
      })
      .parse(await output(ask, 'read_duplicate_identifiers', {}));
    const mine = found.groups.filter((group) => group.value === inn);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.key).toBe('tax_id');
    expect(mine[0]?.entities.map((one) => one.id).sort()).toStrictEqual([a, b].sort());
  });
});

// ------------------------------------------------------ read_event_pairs ---

test('read_event_pairs flags a Latin and a Cyrillic event of one site and day', async () => {
  await rolledBack('superuser', async (ask) => {
    const made = z.array(z.object({ id: z.uuid() }));
    const plant = async (label: string): Promise<string> => {
      await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
      const [act] = made.parse(
        await ask(`SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[]) AS id`, [
          'create_entity',
          JSON.stringify({ type: 'event', label }),
        ]),
      );
      await ask('RESET SESSION AUTHORIZATION');
      const [row] = made.parse(
        await ask(
          `INSERT INTO public.entities (type, label, attrs, sources, promoted_from)
           VALUES ('event', $1, '{}'::jsonb, ARRAY['manual']::doc_id[], $2) RETURNING id`,
          [label, act?.id],
        ),
      );
      if (row === undefined) throw new Error('no entity came back');
      return row.id;
    };
    const a = await plant('fire — Volgograd — 2031-01-02');
    const b = await plant('fire — Волгоград — 2031-01-02');
    await plant('fire — Волгоград — 2031-01-03');
    const found = z
      .object({
        pairs: z.array(z.object({ day: z.string(), events: z.array(z.object({ id: z.uuid() })) })),
      })
      .parse(await output(ask, 'read_event_pairs', {}));
    const mine = found.pairs.filter((pair) => pair.day === '2031-01-02');
    expect(mine).toHaveLength(1);
    expect(mine[0]?.events.map((one) => one.id).sort()).toStrictEqual([a, b].sort());
  });
});
