// A doubted unit joins a unit that waits (ADR 0029). Each test runs inside a transaction that rolls
// back. A refused call runs behind a savepoint, so the test can read what the refusal left.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { as, refusal } from './author-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const GENERAL_STAFF = 'doc_join_unit_staff';
const AGENCY = 'doc_join_unit_agency';
const SITE_NEWS = 'doc_join_unit_site';
const EXTRACTOR = 'join-unit-test@1';
const PAGE = 'A drone attack hit the Plant refinery overnight. The fire burned for hours.';
const PLANT = 'claimed attack — Plant — 2026-05-15';

const PUT = `SELECT public.put_document($1, 'file', 'A test of the join', $2, NULL, NULL,
  NULL, 'application/pdf', '2026-10-06'::date)`;
const TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';
const CALL = `SELECT public.record_model_call('extractor', 'v2', 'openrouter', 'a-model', $1, 120,
  'ok', NULL, 'a-model', 10, 5) AS id`;
const BATCH = 'SELECT proposal_id FROM public.propose_batch($1::jsonb)';
const JOIN = 'SELECT public.ai_join_unit($1::uuid, $2::uuid, $3) AS said';
const WHY = 'The two passages state the same drone attack on the same refinery.';

const seed = async (ask: Ask): Promise<string> => {
  for (const document of [GENERAL_STAFF, AGENCY, SITE_NEWS]) {
    await ask(PUT, [document, `raw/${document}.pdf`]);
    await ask(TEXT, [document, JSON.stringify([PAGE]), EXTRACTOR]);
  }
  const [call] = z
    .array(z.object({ id: z.uuid() }))
    .parse(await as(ask, 'gabriel_agent', () => ask(CALL, ['e'.repeat(64)])));
  if (call === undefined) throw new Error('the door recorded no call');
  return call.id;
};

interface Unit {
  readonly label?: string;
  readonly type?: string;
  readonly document: string;
  readonly originator: string;
  readonly modality?: string;
  /** A dispute makes the unit a doubt. */
  readonly doubt?: boolean;
  readonly span?: readonly [number, number];
  /** A second document that the unit cites. */
  readonly also?: string;
}

// One event, proposed by the back end. The unit is the act itself.
const propose = async (ask: Ask, call: string, unit: Unit): Promise<string> => {
  const id = randomUUID();
  const [start, end] = unit.span ?? [2, 13];
  const documents = unit.also === undefined ? [unit.document] : [unit.document, unit.also];
  const rows = await as(ask, 'gabriel_agent', () =>
    ask(BATCH, [
      JSON.stringify([
        {
          id,
          op: 'create_entity',
          payload: {
            type: unit.type ?? 'event',
            label: unit.label ?? PLANT,
            sources: documents,
          },
          src: documents,
          names: [],
          model_call_id: call,
          originator: unit.originator,
          modality: unit.modality ?? 'asserts',
          ...(unit.doubt === true ? { dissent: true, dissent_reason: 'two readings differ' } : {}),
          citations: documents.map((document) => ({
            document,
            text_extractor: EXTRACTOR,
            page: 1,
            start,
            end,
          })),
        },
      ]),
    ]),
  );
  const [row] = z.array(z.object({ proposal_id: z.uuid() })).parse(rows);
  if (row === undefined) throw new Error('the door wrote no act');
  return row.proposal_id;
};

const join = (ask: Ask, doubted: string, waiting: string, why = WHY) =>
  as(ask, 'gabriel_research', () => ask(JOIN, [doubted, waiting, why]));

const documentsOf = async (ask: Ask, act: string): Promise<string[]> =>
  z
    .array(z.object({ doc_id: z.string() }))
    .parse(
      await ask('SELECT doc_id FROM public.citation WHERE claim_id = $1::uuid ORDER BY doc_id', [
        act,
      ]),
    )
    .map((one) => one.doc_id);

const stateOf = async (ask: Ask, act: string) => {
  const [row] = z
    .array(
      z.object({
        status: z.string(),
        reject_reason: z.string().nullable(),
        reject_note: z.string().nullable(),
        decision_origin: z.string().nullable(),
        decision_reason: z.string().nullable(),
        decided_as: z.string().nullable(),
        src: z.array(z.string()),
      }),
    )
    .parse(
      await ask(
        `SELECT status, reject_reason, reject_note, decision_origin, decision_reason, decided_as,
                src::text[] AS src
           FROM public.proposals WHERE id = $1::uuid`,
        [act],
      ),
    );
  if (row === undefined) throw new Error('the record holds no such act');
  return row;
};

const ruleOf = async (ask: Ask, unit: string): Promise<string | null> => {
  const [row] = z
    .array(z.object({ rule: z.string().nullable() }))
    .parse(await ask('SELECT public.unit_rule($1::uuid) AS rule', [unit]));
  return row?.rule ?? null;
};

// The queue as the page reads it: the units that wait, with their lane.
const queued = async (ask: Ask, unit: string): Promise<boolean> => {
  const [row] = z.array(z.object({ found: z.boolean() })).parse(
    await ask(
      `SELECT EXISTS (SELECT 1 FROM public.proposals
                         WHERE unit_id = $1::uuid AND status = 'pending') AS found`,
      [unit],
    ),
  );
  return row?.found === true;
};

const pair = async (
  ask: Ask,
  change: { doubted?: Partial<Unit>; waiting?: Partial<Unit> } = {},
) => {
  const call = await seed(ask);
  const waiting = await propose(ask, call, {
    document: GENERAL_STAFF,
    originator: 'The general staff',
    ...change.waiting,
  });
  const doubted = await propose(ask, call, {
    document: AGENCY,
    originator: 'Reuters',
    doubt: true,
    ...change.doubted,
  });
  return { call, waiting, doubted };
};

test('the doubted unit is a doubt and the other unit waits', async () => {
  await rolledBack('superuser', async (ask) => {
    const { waiting, doubted } = await pair(ask);
    expect(await ruleOf(ask, doubted)).toBe('doubt');
    expect(await ruleOf(ask, waiting)).toBe('weak_sources');
  });
});

test('the waiting unit takes the documents and the passage, and the doubted unit is closed', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { waiting, doubted } = await pair(ask);
    const said = await join(ask, doubted, waiting);
    return {
      said,
      waiting: await stateOf(ask, waiting),
      doubted: await stateOf(ask, doubted),
      waitingDocuments: await documentsOf(ask, waiting),
      queuedDoubted: await queued(ask, doubted),
      queuedWaiting: await queued(ask, waiting),
      doubtedRule: await ruleOf(ask, doubted),
      ids: { waiting, doubted },
    };
  });
  expect(found.said).toStrictEqual([
    {
      said: {
        name: PLANT,
        doubted: found.ids.doubted,
        waiting: found.ids.waiting,
        documents: 1,
        passages: 1,
      },
    },
  ]);
  expect(found.waitingDocuments).toStrictEqual([AGENCY, GENERAL_STAFF]);
  // The other fields of the waiting unit stay as they are, and it stays in the queue.
  expect(found.waiting).toMatchObject({ status: 'pending', src: [GENERAL_STAFF] });
  expect(found.queuedWaiting).toBe(true);
  // The doubted unit is closed as joined, with the record of the waiting unit, and not queued.
  expect(found.doubted).toStrictEqual({
    status: 'rejected',
    reject_reason: 'duplicate',
    reject_note: `joined into the unit ${found.ids.waiting}; it was a doubt: a fault of the check`,
    decision_origin: 'decided by an AI reviewer',
    decision_reason: WHY,
    decided_as: 'unit',
    src: [AGENCY],
  });
  expect(found.queuedDoubted).toBe(false);
  expect(found.doubtedRule).toBeNull();
});

test('a second run on the same pair is refused and changes nothing', async () => {
  await rolledBack('superuser', async (ask) => {
    const { waiting, doubted } = await pair(ask);
    await join(ask, doubted, waiting);
    const before = await documentsOf(ask, waiting);
    const said = await refusal(ask, () => join(ask, doubted, waiting));
    expect(said).toMatch(/no unit that waits for a decision/u);
    expect(await documentsOf(ask, waiting)).toStrictEqual(before);
  });
});

interface Refusal {
  readonly name: string;
  readonly change: { doubted?: Partial<Unit>; waiting?: Partial<Unit> };
  readonly said: RegExp;
}

const REFUSALS: readonly Refusal[] = [
  {
    name: 'another site',
    change: { doubted: { label: 'claimed attack — Other plant — 2026-05-15' } },
    said: /not for the same kind of event, at the same site, on the same day/u,
  },
  {
    name: 'another day',
    change: { doubted: { label: 'claimed attack — Plant — 2026-05-16' } },
    said: /not for the same kind of event, at the same site, on the same day/u,
  },
  {
    name: 'another kind of event',
    change: { doubted: { label: 'fire — Plant — 2026-05-15' } },
    said: /not for the same kind of event, at the same site, on the same day/u,
  },
  {
    name: 'a doubted unit that is no doubt',
    change: { doubted: { doubt: false, originator: 'Reuters' } },
    said: /is no doubt/u,
  },
  {
    name: 'a waiting unit that is a doubt of its own',
    change: { waiting: { doubt: true } },
    said: /is a doubt of its own, or it is no unit/u,
  },
  {
    name: 'a unit that is no event',
    change: {
      doubted: { type: 'vessel', label: 'Plant' },
      waiting: { type: 'vessel', label: 'Plant' },
    },
    said: /is no new event/u,
  },
  {
    name: 'two modalities',
    change: { doubted: { modality: 'alleges' } },
    said: /two modalities/u,
  },
];

test.each(REFUSALS)('the join is refused for $name, and it changes nothing', async (given) => {
  await rolledBack('superuser', async (ask) => {
    const { waiting, doubted } = await pair(ask, given.change);
    const before = {
      waiting: await documentsOf(ask, waiting),
      doubted: await documentsOf(ask, doubted),
      doubtedState: await stateOf(ask, doubted),
      waitingState: await stateOf(ask, waiting),
    };
    const said = await refusal(ask, () => join(ask, doubted, waiting));
    expect(said).toMatch(given.said);
    expect(await documentsOf(ask, waiting)).toStrictEqual(before.waiting);
    expect(await documentsOf(ask, doubted)).toStrictEqual(before.doubted);
    expect(await stateOf(ask, doubted)).toStrictEqual(before.doubtedState);
    expect(await stateOf(ask, waiting)).toStrictEqual(before.waitingState);
  });
});

test('the join is refused when the waiting unit cites each document already', async () => {
  await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const waiting = await propose(ask, call, {
      document: GENERAL_STAFF,
      originator: 'The general staff',
    });
    const doubted = await propose(ask, call, {
      document: GENERAL_STAFF,
      originator: 'Reuters',
      doubt: true,
      span: [14, 25],
    });
    const before = await documentsOf(ask, waiting);
    const said = await refusal(ask, () => join(ask, doubted, waiting));
    expect(said).toMatch(/cites each of these documents already/u);
    expect(await documentsOf(ask, waiting)).toStrictEqual(before);
    expect((await stateOf(ask, doubted)).status).toBe('pending');
  });
});

test('the join leaves no state where the documents are in both units or in none', async () => {
  // A waiting unit that is a doubt of its own is found after the passages are copied, so the
  // refusal must undo the copy. The savepoint of the call holds that the step is one step.
  await rolledBack('superuser', async (ask) => {
    const { waiting, doubted } = await pair(ask, { waiting: { doubt: true } });
    const copied = await refusal(ask, () => join(ask, doubted, waiting));
    expect(copied).toMatch(/is a doubt of its own, or it is no unit/u);
    expect(await documentsOf(ask, waiting)).toStrictEqual([GENERAL_STAFF]);
    expect(await documentsOf(ask, doubted)).toStrictEqual([AGENCY]);
    expect((await stateOf(ask, doubted)).status).toBe('pending');
  });
});

test('the join takes the documents that the waiting unit lacks, and only them', async () => {
  await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const waiting = await propose(ask, call, {
      document: GENERAL_STAFF,
      originator: 'The general staff',
    });
    // The doubted unit cites the document that the waiting unit cites, and a new one.
    const doubted = await propose(ask, call, {
      document: GENERAL_STAFF,
      also: SITE_NEWS,
      originator: 'A news site',
      doubt: true,
      span: [14, 25],
    });
    const said = await join(ask, doubted, waiting);
    expect(said).toMatchObject([{ said: { documents: 1, passages: 1 } }]);
    expect(await documentsOf(ask, waiting)).toStrictEqual([SITE_NEWS, GENERAL_STAFF].sort());
  });
});

test('the join names a unit that does not exist, the same unit twice, or no reason', async () => {
  await rolledBack('superuser', async (ask) => {
    const { waiting, doubted } = await pair(ask);
    expect(await refusal(ask, () => join(ask, randomUUID(), waiting))).toMatch(
      /no unit that waits/u,
    );
    expect(await refusal(ask, () => join(ask, doubted, randomUUID()))).toMatch(
      /no unit that waits/u,
    );
    expect(await refusal(ask, () => join(ask, doubted, doubted))).toMatch(/names two units/u);
    expect(await refusal(ask, () => join(ask, doubted, waiting, '  '))).toMatch(
      /gives the reason of its decision/u,
    );
  });
});

test('the hint of a refusal names the field to correct', async () => {
  await rolledBack('superuser', async (ask) => {
    const { waiting, doubted } = await pair(ask);
    const hints: unknown[] = [];
    for (const [first, second, why] of [
      [randomUUID(), waiting, WHY],
      [doubted, randomUUID(), WHY],
      [doubted, waiting, ' '],
    ] as const) {
      await ask('SAVEPOINT hint');
      try {
        await join(ask, first, second, why);
      } catch (cause) {
        hints.push(cause instanceof Error && 'hint' in cause ? cause.hint : null);
      }
      await ask('ROLLBACK TO SAVEPOINT hint');
    }
    expect(hints).toStrictEqual(['unitId', 'waitingId', 'why']);
  });
});

test('the research role holds the door of the join, and the reviewer of a doubt only', async () => {
  await rolledBack('agent', async (ask) => {
    const said = await refusal(ask, () => ask(JOIN, [randomUUID(), randomUUID(), WHY]));
    expect(said).toMatch(/permission denied/u);
  });
});

// An event of the record, and the occurred_at relation of it that waits for a better source.
const recorded = async (ask: Ask, type: string, label: string): Promise<string> => {
  const [act] = z
    .array(z.object({ id: z.uuid() }))
    .parse(
      await as(ask, 'gabriel_app', () =>
        ask(
          `SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id`,
          [JSON.stringify({ type, label })],
        ),
      ),
    );
  const [row] = z.array(z.object({ id: z.uuid() })).parse(
    await ask(
      `INSERT INTO public.entities (type, label, sources, promoted_from)
       VALUES ($1, $2, ARRAY['manual']::doc_id[], $3::uuid) RETURNING id`,
      [type, label, act?.id],
    ),
  );
  if (row === undefined) throw new Error('the record kept no entity');
  return row.id;
};

const waitingRelation = async (ask: Ask, call: string): Promise<string> =>
  (await waitingRelationAt(ask, call)).id;

const waitingRelationAt = async (ask: Ask, call: string): Promise<{ id: string; site: string }> => {
  const event = await recorded(ask, 'event', PLANT);
  const site = await recorded(ask, 'facility', 'Plant');
  const id = randomUUID();
  await as(ask, 'gabriel_agent', () =>
    ask(BATCH, [
      JSON.stringify([
        {
          id,
          op: 'create_relation',
          payload: { type: 'occurred_at', src_id: event, dst_id: site, sources: [GENERAL_STAFF] },
          src: [GENERAL_STAFF],
          names: [event, site],
          model_call_id: call,
          originator: 'The general staff',
          modality: 'asserts',
          citations: [
            { document: GENERAL_STAFF, text_extractor: EXTRACTOR, page: 1, start: 2, end: 13 },
          ],
        },
      ]),
    ]),
  );
  return { id, site };
};

test('a doubted event joins the occurred_at relation of an event of the record that waits', async () => {
  await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const waiting = await waitingRelation(ask, call);
    const doubted = await propose(ask, call, {
      document: AGENCY,
      originator: 'Reuters',
      doubt: true,
    });
    expect(await ruleOf(ask, waiting)).toBe('weak_sources');
    const said = await join(ask, doubted, waiting);
    expect(said).toMatchObject([{ said: { name: PLANT, waiting, documents: 1, passages: 1 } }]);
    expect(await documentsOf(ask, waiting)).toStrictEqual([AGENCY, GENERAL_STAFF]);
    expect((await stateOf(ask, doubted)).status).toBe('rejected');
    // The relation keeps its type and its ends.
    expect(await queued(ask, waiting)).toBe(true);
  });
});

test('a doubted event does not join a waiting relation of another day', async () => {
  await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const waiting = await waitingRelation(ask, call);
    const doubted = await propose(ask, call, {
      document: AGENCY,
      originator: 'Reuters',
      doubt: true,
      label: 'claimed attack — Plant — 2026-05-16',
    });
    expect(await refusal(ask, () => join(ask, doubted, waiting))).toMatch(/not for the same kind/u);
  });
});

// A new event and its occurred_at link to a site of the record, in one unit of two acts.
const eventWithLink = async (ask: Ask, call: string, label: string, site: string) => {
  const event = randomUUID();
  const link = randomUUID();
  const base = {
    src: [AGENCY],
    model_call_id: call,
    originator: 'Reuters',
    modality: 'asserts',
    citations: [{ document: AGENCY, text_extractor: EXTRACTOR, page: 1, start: 2, end: 13 }],
  };
  await as(ask, 'gabriel_agent', () =>
    ask(BATCH, [
      JSON.stringify([
        {
          ...base,
          id: event,
          op: 'create_entity',
          payload: { type: 'event', label, sources: [AGENCY] },
          names: [],
          dissent: true,
          dissent_reason: 'two readings differ',
        },
        {
          ...base,
          id: link,
          op: 'create_relation',
          payload: { type: 'occurred_at', src_id: event, dst_id: site, sources: [AGENCY] },
          names: [event, site],
        },
      ]),
    ]),
  );
  return { event, link };
};

test('a doubted event with its link joins a waiting relation that ends at the same site', async () => {
  await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const waiting = await waitingRelationAt(ask, call);
    // The record writes the site as "Plant"; the doubted event writes it otherwise.
    const { event, link } = await eventWithLink(
      ask,
      call,
      'claimed attack — Plant refinery — 2026-05-15',
      waiting.site,
    );
    const said = await join(ask, event, waiting.id);
    expect(said).toMatchObject([{ said: { waiting: waiting.id, documents: 1 } }]);
    expect(await documentsOf(ask, waiting.id)).toStrictEqual([AGENCY, GENERAL_STAFF]);
    expect((await stateOf(ask, event)).status).toBe('rejected');
    expect((await stateOf(ask, link)).status).toBe('rejected');
    expect((await stateOf(ask, waiting.id)).status).toBe('pending');
  });
});

test('a doubted event with a link to another site does not join a waiting relation', async () => {
  await rolledBack('superuser', async (ask) => {
    const call = await seed(ask);
    const waiting = await waitingRelationAt(ask, call);
    const other = await recorded(ask, 'facility', 'Other plant');
    const { event, link } = await eventWithLink(
      ask,
      call,
      'claimed attack — Plant refinery — 2026-05-15',
      other,
    );
    expect(await refusal(ask, () => join(ask, event, waiting.id))).toMatch(
      /not for the same kind of event|another act waits/u,
    );
    expect((await stateOf(ask, event)).status).toBe('pending');
    expect((await stateOf(ask, link)).status).toBe('pending');
  });
});
