// The rules of the batch door that a caller other than the propose tool could break: the door
// holds them, and the tool only finds the excerpt. Each gesture runs inside a transaction that
// rolls back, so the census tests count the same rows before and after.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_propose_batch';
const OTHER = 'doc_propose_batch_other';
const IMAGE = 'doc_propose_batch_image';
const EXTRACTOR = 'propose-batch-test@1';
const PAGE = 'The tanker Nayara left Sikka on 3 May 2026.';

const PUT = `SELECT public.put_document($1, 'file', 'A test of the batch door', $2, NULL, NULL,
  NULL, 'application/pdf', '2026-10-06'::date)`;
const PUT_IMAGE = `SELECT public.put_document($1, 'file', 'A unit tree of the batch door', $2,
  NULL, NULL, NULL, 'image/png', '2026-10-09'::date)`;
const TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';
const CALL = `SELECT public.record_model_call('extractor', 'v2', 'openrouter', 'a-model', $1, 120,
  'ok', NULL, 'a-model', 10, 5) AS id`;
const BATCH =
  'SELECT item, proposal_id, written FROM public.propose_batch($1::jsonb) ORDER BY item';

const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

const seed = async (ask: Ask): Promise<string> => {
  await ask(PUT, [DOC, 'raw/propose-batch.pdf']);
  await ask(PUT, [OTHER, 'raw/propose-batch-other.pdf']);
  await ask(TEXT, [DOC, JSON.stringify([PAGE]), EXTRACTOR]);
  await ask(PUT_IMAGE, [IMAGE, 'raw/propose-batch.png']);
  await ask(TEXT, [IMAGE, JSON.stringify(['Nayara Sikka']), EXTRACTOR]);
  const [call] = z
    .array(z.object({ id: z.uuid() }))
    .parse(await as(ask, 'gabriel_agent', () => ask(CALL, ['d'.repeat(64)])));
  if (call === undefined) throw new Error('the door recorded no call');
  return call.id;
};

type Item = Record<string, unknown>;

const itemOf = (call: string | null, change: Item = {}): Item => ({
  id: randomUUID(),
  op: 'create_entity',
  payload: { type: 'vessel', label: 'Nayara', sources: [DOC] },
  src: [DOC],
  names: [],
  model_call_id: call,
  originator: 'The port authority',
  modality: 'asserts',
  citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, start: 11, end: 17 }],
  ...change,
});

const batchAs = (ask: Ask, role: string, items: readonly Item[]) =>
  as(ask, role, () => ask(BATCH, [JSON.stringify(items)]));

const refusalOf = async (role: string, change: (call: string) => readonly Item[]) =>
  rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    return batchAs(ask, role, change(call));
  }).then(
    () => null,
    (cause: unknown) => cause,
  );

const REFUSALS: readonly (readonly [string, (call: string) => Item, RegExp])[] = [
  ['no citation', (call) => itemOf(call, { citations: [] }), /^item 1: .*cites at least one page/u],
  [
    'a page that does not exist',
    (call) =>
      itemOf(call, {
        citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 2, start: 0, end: 4 }],
      }),
    /^item 1: page 2 .* does not exist/u,
  ],
  [
    'a span past the end of the page',
    (call) =>
      itemOf(call, {
        citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, start: 40, end: 400 }],
      }),
    /^item 1: the span 40 to 400 lies outside page 1/u,
  ],
  [
    'a document that is not a source of the act',
    (call) =>
      itemOf(call, {
        citations: [{ document: OTHER, text_extractor: EXTRACTOR, page: 1, start: 0, end: 4 }],
      }),
    /^item 1: .*not a source of the act/u,
  ],
  [
    'a transcription of a document that is no image',
    (call) =>
      itemOf(call, {
        dissent: true,
        citations: [{ document: DOC, text_extractor: EXTRACTOR, page: 1, transcription: 'Nayara' }],
      }),
    /^item 1: document doc_propose_batch is no PNG or JPEG image/u,
  ],
  [
    'a transcription and a span in one citation',
    (call) =>
      itemOf(call, {
        src: [IMAGE],
        payload: { type: 'vessel', label: 'Nayara', sources: [IMAGE] },
        dissent: true,
        citations: [
          {
            document: IMAGE,
            text_extractor: EXTRACTOR,
            page: 1,
            start: 0,
            end: 6,
            transcription: 'Nayara',
          },
        ],
      }),
    /^item 1: .*gives a span or a transcription, and never both/u,
  ],
  [
    'a transcription and no dispute',
    (call) =>
      itemOf(call, {
        src: [IMAGE],
        payload: { type: 'vessel', label: 'Nayara', sources: [IMAGE] },
        citations: [
          { document: IMAGE, text_extractor: EXTRACTOR, page: 1, transcription: 'Nayara' },
        ],
      }),
    /^item 1: an act that cites words read from an image is disputed/u,
  ],
  [
    'a blank transcription',
    (call) =>
      itemOf(call, {
        src: [IMAGE],
        payload: { type: 'vessel', label: 'Nayara', sources: [IMAGE] },
        dissent: true,
        citations: [{ document: IMAGE, text_extractor: EXTRACTOR, page: 1, transcription: ' ' }],
      }),
    /^item 1: a transcription of page 1 .* is a text of 1 to 600 characters/u,
  ],
  [
    'a transcription from a back-end agent',
    (call) =>
      itemOf(call, {
        src: [IMAGE],
        payload: { type: 'vessel', label: 'Nayara', sources: [IMAGE] },
        dissent: true,
        citations: [
          { document: IMAGE, text_extractor: EXTRACTOR, page: 1, transcription: 'Nayara' },
        ],
      }),
    /^item 1: an agent cites the stored text, and never words read from an image/u,
  ],
  ['no originator', (call) => itemOf(call, { originator: ' ' }), /^item 1: .*first stated it/u],
  ['no model call', () => itemOf(null), /^item 1: .*names the model call/u],
  ['a modality outside the list', (call) => itemOf(call, { modality: 'hints' }), /^item 1: /u],
  ...(['update_entity', 'delete_entity', 'delete_relation'] as const).map(
    (op) =>
      [
        `the operation ${op}`,
        (call: string) =>
          itemOf(call, { op, target_kind: op === 'delete_relation' ? 'relation' : 'entity' }),
        /^item 1: a machine proposes a new entity, a new relation or new attributes/u,
      ] as const,
  ),
];

test.each(REFUSALS)(
  'the door refuses an act with %s, and names the item',
  async (_, given, said) => {
    const cause = await refusalOf('gabriel_agent', (call) => [given(call)]);
    expect(cause).toMatchObject({ code: '22023', message: expect.stringMatching(said) as string });
  },
);

test('a refused operation names the field to correct', async () => {
  const cause = await refusalOf('gabriel_research', () => [
    itemOf(null, { op: 'delete_entity', target_kind: 'entity', target_id: randomUUID() }),
  ]);
  expect(cause).toMatchObject({ code: '22023', hint: 'op' });
});

test('the operator holds no grant on the batch door', async () => {
  const cause = await refusalOf('gabriel_app', (call) => [itemOf(call)]);
  expect(cause).toMatchObject({ code: '42501' });
});

test('a machine role holds no grant on the door of the operator', async () => {
  for (const role of ['gabriel_agent', 'gabriel_research'])
    await expect(
      rolledBack('superuser', async (ask) => {
        await seed(ask);
        return as(ask, role, () =>
          ask(
            `SELECT public.propose_change('create_entity', '{"type":"vessel","label":"X"}',
            ARRAY[$1]::text[])`,
            [DOC],
          ),
        );
      }),
    ).rejects.toMatchObject({ code: '42501' });
});

test('a citation is written once, and never changed or deleted', async () => {
  for (const change of ['UPDATE public.citation SET page = 1', 'DELETE FROM public.citation'])
    await expect(
      rolledBack('superuser', async (ask) => {
        const call = await seed(ask);
        await batchAs(ask, 'gabriel_agent', [itemOf(call)]);
        return ask(change);
      }),
    ).rejects.toThrow(/a citation is never/u);
});

test('the read role and the machine roles cannot read a citation', async () => {
  for (const identity of ['read', 'research', 'agent'] as const)
    await expect(
      rolledBack(identity, (ask) => ask('SELECT count(*) FROM public.citation')),
    ).rejects.toMatchObject({ code: '42501' });
});

test('no view of the api schema reads a citation', async () => {
  const views = await rolledBack('superuser', (ask) =>
    ask(
      `SELECT DISTINCT v.relname AS name
         FROM pg_catalog.pg_depend d
         JOIN pg_catalog.pg_rewrite r ON r.oid = d.objid
         JOIN pg_catalog.pg_class v ON v.oid = r.ev_class
         JOIN pg_catalog.pg_namespace n ON n.oid = v.relnamespace
        WHERE n.nspname = 'api' AND d.refobjid = 'public.citation'::regclass`,
    ),
  );
  expect(views).toStrictEqual([]);
});

const outcomes = z.array(
  z.object({ item: z.number(), proposal_id: z.uuid(), written: z.boolean() }),
);

const citedCount = async (ask: Ask, id: string | undefined): Promise<number> =>
  z
    .array(z.object({ n: z.number() }))
    .parse(
      await ask('SELECT count(*)::int AS n FROM public.citation WHERE claim_id = $1::uuid', [id]),
    )[0]?.n ?? -1;

// Two roles are two witnesses of one fact. A merge into the act that waits would lose the second
// witness and its citation.
test('the same act of another role is a second act', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const [agent] = outcomes.parse(await batchAs(ask, 'gabriel_agent', [itemOf(call)]));
    const [research] = outcomes.parse(await batchAs(ask, 'gabriel_research', [itemOf(null)]));
    return { agent, research, cited: await citedCount(ask, research?.proposal_id) };
  });
  expect(found.research?.written).toBe(true);
  expect(found.research?.proposal_id).not.toBe(found.agent?.proposal_id);
  expect(found.cited).toBe(1);
});

// New attributes of an entity of the record. Their target and their payload identify the fact,
// so a second passage of the same act joins the act that waits.
const KEYED = `SELECT e.id::text AS id, k.key, e.attrs -> k.key -> 'v' #>> '{}' AS value
  FROM api.entity e CROSS JOIN LATERAL jsonb_object_keys(e.attrs) AS k(key)
  WHERE jsonb_typeof(e.attrs -> k.key -> 'v') = 'string'
  ORDER BY e.id, k.key LIMIT 1`;

const attrsOf = async (ask: Ask, call: string, change: Item = {}): Promise<Item> => {
  const [held] = z
    .array(z.object({ id: z.uuid(), key: z.string(), value: z.string() }))
    .parse(await ask(KEYED));
  if (held === undefined) throw new Error('the fixture holds no string attribute');
  return itemOf(call, {
    op: 'update_attrs',
    target_kind: 'entity',
    target_id: held.id,
    payload: { attrs: { [held.key]: { v: held.value, src: [DOC] } } },
    ...change,
  });
};

// A model words the originator in its own way, so the same claim of one role is one act. The act
// that waits keeps the originator that it was written with, and takes the new passage.
test('the same act with another wording of its originator is one act', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const [first] = outcomes.parse(
      await batchAs(ask, 'gabriel_agent', [
        await attrsOf(ask, call, { originator: 'Port authority' }),
      ]),
    );
    const [again] = outcomes.parse(
      await batchAs(ask, 'gabriel_agent', [
        await attrsOf(ask, call, {
          originator: 'The port authority',
          citations: [
            { document: DOC, text_extractor: EXTRACTOR, page: 1, start: 11, end: 17 },
            { document: DOC, text_extractor: EXTRACTOR, page: 1, start: 0, end: 17 },
          ],
        }),
      ]),
    );
    const held = z
      .array(z.object({ originator: z.string() }))
      .parse(
        await ask('SELECT originator FROM public.proposals WHERE id = $1::uuid', [
          first?.proposal_id,
        ]),
      );
    return { first, again, held, cited: await citedCount(ask, first?.proposal_id) };
  });
  expect(found.again).toMatchObject({ proposal_id: found.first?.proposal_id, written: false });
  expect(found.held).toStrictEqual([{ originator: 'Port authority' }]);
  expect(found.cited).toBe(2);
});

test('a retry with a second passage adds its citation to the act that waits, once', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const first = { document: DOC, text_extractor: EXTRACTOR, page: 1, start: 11, end: 17 };
    const second = { document: DOC, text_extractor: EXTRACTOR, page: 1, start: 0, end: 17 };
    const [written] = outcomes.parse(
      await batchAs(ask, 'gabriel_agent', [await attrsOf(ask, call)]),
    );
    const both = await attrsOf(ask, call, { citations: [first, second] });
    const [again] = outcomes.parse(await batchAs(ask, 'gabriel_agent', [both]));
    await batchAs(ask, 'gabriel_agent', [{ ...both, id: randomUUID() }]);
    return { written, again, cited: await citedCount(ask, written?.proposal_id) };
  });
  expect(found.again).toMatchObject({ proposal_id: found.written?.proposal_id, written: false });
  expect(found.cited).toBe(2);
});

// A label does not identify a unit: one page can name two units with one label, each under a
// different parent. So a new entity that cites another passage is a second act, and a retry of
// the same passage returns the act that waits.
test('a new entity with the same label that cites another passage is a second act', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const other = { document: DOC, text_extractor: EXTRACTOR, page: 1, start: 0, end: 17 };
    const [first] = outcomes.parse(await batchAs(ask, 'gabriel_agent', [itemOf(call)]));
    const [second] = outcomes.parse(
      await batchAs(ask, 'gabriel_agent', [itemOf(call, { citations: [other] })]),
    );
    const [again] = outcomes.parse(await batchAs(ask, 'gabriel_agent', [itemOf(call)]));
    return { first, second, again, cited: await citedCount(ask, first?.proposal_id) };
  });
  expect(found.second?.written).toBe(true);
  expect(found.second?.proposal_id).not.toBe(found.first?.proposal_id);
  expect(found.again).toMatchObject({ proposal_id: found.first?.proposal_id, written: false });
  expect(found.cited).toBe(1);
});

test('the door refuses an identifier that a row of the record already holds', async () => {
  const cause = await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const [entity] = z
      .array(z.object({ id: z.uuid() }))
      .parse(await ask('SELECT id::text AS id FROM public.entities LIMIT 1'));
    return batchAs(ask, 'gabriel_agent', [itemOf(call, { id: entity?.id })]);
  }).then(
    () => null,
    (error: unknown) => error,
  );
  expect(cause).toMatchObject({
    code: '22023',
    message: expect.stringMatching(
      /^item 1: the identifier .* is already the identifier/u,
    ) as string,
  });
});

test('a transcription is quoted as it is, marked as read from the image, and gives its words', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await seed(ask);
    const transcribed = itemOf(null, {
      src: [IMAGE],
      payload: { type: 'vessel', label: 'Nayara', sources: [IMAGE] },
      dissent: true,
      dissent_reason: 'an excerpt is read from the image by the AI',
      citations: [
        { document: IMAGE, text_extractor: EXTRACTOR, page: 1, transcription: 'Nayara > Sikka' },
      ],
    });
    await batchAs(ask, 'gabriel_research', [transcribed]);
    return {
      quoted: await ask(
        `SELECT q.doc_id, q.page, q.before, q.cited, q.after, q.transcribed
           FROM public.cited_passages(ARRAY[$1::uuid]) AS q`,
        [transcribed['id']],
      ),
      words: await ask(
        `SELECT s.words FROM public.citation c, public.citation_source(c.id) AS s
          WHERE c.claim_id = $1::uuid`,
        [transcribed['id']],
      ),
    };
  });
  expect(found.quoted).toStrictEqual([
    { doc_id: IMAGE, page: 1, before: '', cited: 'Nayara > Sikka', after: '', transcribed: true },
  ]);
  expect(found.words).toStrictEqual([{ words: ['nayara', 'sikka'] }]);
});

// A rated author whose one passed check makes a fact strong under the letter C.
const RATED = `WITH a AS (
    INSERT INTO public.author (name_key, letter, model, reason, reference_authors)
    VALUES (public.name_key('The port authority'), 'C', 'a-model', 'a test', ARRAY['x'])
    RETURNING id)
  INSERT INTO public.author_name (name_key, author_id)
  SELECT public.name_key('The port authority'), id FROM a`;
const PASSED = `INSERT INTO public.act_check (proposal_id, checker_model, checker_family, reader_family,
  verdict) VALUES ($1::uuid, 'a-checker', 'family-one', 'family-two', 'supported')`;
const STRONG = `SELECT public.fact_is_strong(p.claim_key, 'C', 'C', 'C') AS strong
  FROM public.proposals p WHERE p.id = $1::uuid`;

test('a passed check of words read from an image makes no fact strong while the act waits', async () => {
  const strongOf = (change: Item) =>
    rolledBack('superuser', async (ask) => {
      await seed(ask);
      await ask(RATED);
      const act = itemOf(null, change);
      await batchAs(ask, 'gabriel_research', [act]);
      await ask(PASSED, [act['id']]);
      return ask(STRONG, [act['id']]);
    });
  expect(await strongOf({})).toStrictEqual([{ strong: true }]);
  expect(
    await strongOf({
      src: [IMAGE],
      payload: { type: 'vessel', label: 'Nayara', sources: [IMAGE] },
      dissent: true,
      citations: [{ document: IMAGE, text_extractor: EXTRACTOR, page: 1, transcription: 'Nayara' }],
    }),
  ).toStrictEqual([{ strong: false }]);
});

test('a machine act that names an entity that a merge absorbed is refused, and names the survivor', async () => {
  const refusal = await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const made = z.array(z.object({ target_id: z.uuid() }));
    const ids = await as(ask, 'gabriel_app', async () => {
      const created = [];
      for (const label of ['Nayara survivor', 'Nayara absorbed'])
        created.push(
          made.parse(
            await ask(
              `SELECT target_id FROM public.sign_change('a test', 'create_entity', $1::jsonb,
                 ARRAY['manual'], NULL, NULL, '{}')`,
              [JSON.stringify({ type: 'vessel', label, sources: ['manual'] })],
            ),
          )[0]?.target_id ?? '',
        );
      await ask(`SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid)`, created);
      return created;
    });
    const [survivor, absorbed] = ids;
    return batchAs(ask, 'gabriel_agent', [
      itemOf(call, {
        op: 'update_attrs',
        target_kind: 'entity',
        target_id: absorbed,
        payload: { attrs: { call_sign: { v: 'Nayara', src: [DOC] } } },
      }),
    ]).then(
      () => null,
      (cause: unknown) => ({ cause, survivor }),
    );
  });
  const said = z.object({ constraint: z.string(), message: z.string() }).parse(refusal?.cause);
  expect(said.constraint).toBe('entity_merged');
  expect(said.message).toContain(`into the entity ${refusal?.survivor ?? ''}`);
});
