// Each tool runs against the disposable database as gabriel_research, the role with the narrowest
// grants. Each gesture runs inside a transaction that rolls back, so the corpus stays as it was.

import { expect, test } from 'vitest';
import { IDENTIFIER_KEYS } from '@gab/proposal/identifiers';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { proposeOf } from './propose.ts';
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
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

// The research role stores the document and its text through its own doors.
const withDocument = async (ask: Ask, pages: readonly string[]): Promise<void> => {
  await ask(STORE, [
    'url',
    'A report of the tool test',
    `raw/${SHA}`,
    'https://example.org/report',
    SHA,
    'application/pdf',
    '2026-09-02',
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
      '2026-10-09',
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
