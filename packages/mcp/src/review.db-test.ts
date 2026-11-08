// The research role reads the review page and decides as an AI reviewer, through the server. Each
// case runs inside one transaction that rolls back, because the ledger refuses a delete. An act
// is never decided by the transaction that proposed it, so each case dates its acts back with the
// freeze trigger off, as the tests of the faults do.

import { randomUUID } from 'node:crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { createServer, type SessionPool } from './server.ts';

const DOC = 'doc_ai_reviewer';
const EXTRACTOR = 'ai-reviewer-test@1';
const PAGE = 'The tanker Baltic Star is owned by Nordic Holding, a company of Riga.';

const answer = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  isError: z.boolean().optional(),
});

const poolOf = (ask: Ask): SessionPool => ({
  connect: () =>
    Promise.resolve({
      query: async (text: string, values: unknown[]) => ({ rows: await ask(text, values) }),
      release: () => undefined,
    }),
});

interface Called {
  readonly refused: boolean;
  readonly text: string;
}

type Call = (name: string, args: Record<string, unknown>) => Promise<Called>;

// The server runs as gabriel_research on the session of the test. Each other step of a case runs
// as the superuser.
const asResearch = async <T>(ask: Ask, work: (call: Call) => Promise<T>): Promise<T> => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(poolOf(ask)).connect(serverSide);
  const client = new Client({ name: 'claude-code', version: '0.0.0' });
  await client.connect(clientSide);
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
  try {
    // A refused call ends the statement with an error, so each call has a savepoint that a
    // refusal rolls back to, and the transaction goes on.
    return await work(async (name, args) => {
      await ask('SAVEPOINT call');
      const result = answer.parse(await client.callTool({ name, arguments: args }));
      await ask(result.isError === true ? 'ROLLBACK TO SAVEPOINT call' : 'RELEASE SAVEPOINT call');
      return {
        refused: result.isError === true,
        text: result.content.map((part) => part.text).join(''),
      };
    });
  } finally {
    await ask('RESET SESSION AUTHORIZATION');
    await client.close();
  }
};

const outputOf = (called: Called): unknown => {
  if (called.refused) throw new Error(`the server refused the call: ${called.text}`);
  return JSON.parse(called.text);
};

const PUT = `SELECT public.put_document($1, 'file', 'raw/ai-reviewer.txt', 'A page of the AI
  reviewer test', NULL, NULL, NULL, 'text/plain', '2026-10-08'::date)`;
const TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';
const BATCH = 'SELECT proposal_id FROM public.propose_batch($1::jsonb) ORDER BY item';

type Item = Record<string, unknown>;

const cited = (change: Item, words: string): Item => ({
  src: [DOC],
  names: [],
  model_call_id: null,
  originator: 'A shipping register',
  modality: 'asserts',
  citations: [
    {
      document: DOC,
      text_extractor: EXTRACTOR,
      page: 1,
      start: PAGE.indexOf(words),
      end: PAGE.indexOf(words) + words.length,
    },
  ],
  ...change,
});

const entity = (id: string, type: string, label: string): Item =>
  cited({ id, op: 'create_entity', payload: { type, label, sources: [DOC] } }, label);

const relation = (id: string, src: string, dst: string): Item =>
  cited(
    {
      id,
      op: 'create_relation',
      payload: { type: 'owns', src_id: src, dst_id: dst, sources: [DOC] },
      names: [src, dst],
    },
    'is owned by Nordic Holding',
  );

// Each batch is a proposal of the research role, from a session that is not the reviewer.
const proposed = async (ask: Ask, items: readonly Item[]): Promise<void> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
  await ask(BATCH, [JSON.stringify(items)]);
  await ask('RESET SESSION AUTHORIZATION');
};

const fromAnEarlierTransaction = async (ask: Ask): Promise<void> => {
  await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
  await ask("UPDATE public.proposals SET xact = '1'::xid8 WHERE xact = pg_current_xact_id()");
  await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
};

interface Units {
  readonly owner: string;
  readonly vessel: string;
  readonly link: string;
}

// A second model disputes each act, so each unit is a doubt: an AI reviewer decides a doubt only.
// The dispute of a check is no fault, so a unit stays clean for the group action.
const doubted = async (ask: Ask, acts: readonly string[]): Promise<void> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_checker');
  for (const act of acts)
    await ask('SELECT public.record_research_check($1::uuid, $2, $3, $4, $5)', [
      act,
      'a-checker',
      'openai',
      'anthropic',
      'not_supported',
    ]);
  await ask('RESET SESSION AUTHORIZATION');
};

// A company in one batch. A vessel and the link from the company to the vessel in a second
// batch, so the link is a unit of its own that waits for the company. Each unit is a doubt, or
// waits for a better source when `doubt` is false.
const seeded = async (ask: Ask, doubt = true): Promise<Units> => {
  const units = { owner: randomUUID(), vessel: randomUUID(), link: randomUUID() };
  await ask(PUT, [DOC]);
  await ask(TEXT, [DOC, JSON.stringify([PAGE]), EXTRACTOR]);
  await proposed(ask, [entity(units.owner, 'company', 'Nordic Holding')]);
  await proposed(ask, [
    entity(units.vessel, 'vessel', 'Baltic Star'),
    relation(units.link, units.owner, units.vessel),
  ]);
  if (doubt) await doubted(ask, [units.owner, units.vessel, units.link]);
  await fromAnEarlierTransaction(ask);
  return units;
};

const DECIDED = `SELECT id::text AS id, status, decided_as, decision_origin, decision_reason,
         reject_reason, reject_note
    FROM public.proposals WHERE id = ANY ($1::uuid[]) ORDER BY id`;

const decided = z.array(
  z.object({
    id: z.uuid(),
    status: z.string(),
    decided_as: z.string().nullable(),
    decision_origin: z.string().nullable(),
    decision_reason: z.string().nullable(),
    reject_reason: z.string().nullable(),
    reject_note: z.string().nullable(),
  }),
);

const rowsOf = async (ask: Ask, ids: readonly string[]) =>
  new Map(decided.parse(await ask(DECIDED, [ids])).map((row) => [row.id, row] as const));

const WHY = 'The cited passage names the vessel and its owner.';

const AI = 'decided by an AI reviewer';

// --------------------------------------------------------------------------------- reads ---

test('the research role reads the unit, its cited passage and its list as the review page does', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { vessel } = await seeded(ask, false);
    return asResearch(ask, async (call) => ({
      vessel,
      unit: z
        .object({
          unit: z.object({
            unit: z.uuid(),
            lane: z.string().nullable(),
            passages: z.array(z.object({ text: z.string(), document: z.string() })),
          }),
        })
        .parse(outputOf(await call('read_unit', { unitId: vessel }))).unit,
      waiting: z
        .object({ units: z.array(z.object({ unit: z.uuid() })) })
        .parse(outputOf(await call('read_waiting', { size: 200 }))),
      doubts: z
        .object({ counts: z.object({ doubt: z.number() }) })
        .parse(outputOf(await call('read_doubts', {}))),
    }));
  });
  expect(read.unit.unit).toBe(read.vessel);
  expect(read.unit.passages).toContainEqual(
    expect.objectContaining({ document: DOC, text: 'Baltic Star' }),
  );
  // A research fact with no check of a second model waits for a source.
  expect(read.unit.lane).toBe('waiting');
  expect(read.waiting.units.map((one) => one.unit)).toContain(read.unit.unit);
  expect(read.doubts.counts.doubt).toBeGreaterThanOrEqual(0);
});

test('the research role reads the groups, one group, the decided acts and the leads', async () => {
  const read = await rolledBack('superuser', async (ask) => {
    const { vessel } = await seeded(ask);
    const [group] = z
      .array(z.object({ batch_id: z.uuid() }))
      .parse(await ask('SELECT batch_id::text FROM public.proposals WHERE id = $1', [vessel]));
    return asResearch(ask, async (call) => ({
      groups: z
        .object({ groups: z.array(z.object({ id: z.uuid() })) })
        .parse(outputOf(await call('read_groups', {}))),
      group: z
        .object({ id: z.uuid(), units: z.array(z.object({ unit: z.uuid() })) })
        .parse(outputOf(await call('read_group', { groupId: group?.batch_id }))),
      decided: z
        .object({ acts: z.array(z.unknown()) })
        .parse(outputOf(await call('read_decided', { size: 5 }))),
      leads: z
        .object({ leads: z.array(z.unknown()) })
        .parse(outputOf(await call('read_leads', {}))),
      batch: group?.batch_id,
    }));
  });
  expect(read.groups.groups.map((one) => one.id)).toContain(read.batch);
  expect(read.group.units.map((one) => one.unit).length).toBeGreaterThan(0);
  expect(read.decided.acts.length).toBeLessThanOrEqual(5);
  expect(Array.isArray(read.leads.leads)).toBe(true);
});

// ----------------------------------------------------------------------------- decisions ---

test('a promotion by the research role records "decided by an AI reviewer" and its reason', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { owner } = await seeded(ask);
    const said = await asResearch(ask, async (call) =>
      outputOf(await call('promote_unit', { unitId: owner, why: WHY })),
    );
    const decidedRead = await asResearch(ask, async (call) =>
      z
        .object({
          acts: z.array(
            z.object({
              id: z.uuid(),
              decisionOrigin: z.string().nullable(),
              decisionReason: z.string().nullable(),
            }),
          ),
        })
        .parse(outputOf(await call('read_decided', { size: 10 }))),
    );
    return { said, row: (await rowsOf(ask, [owner])).get(owner), decidedRead, owner };
  });
  expect(found.said).toStrictEqual({
    name: 'Nordic Holding',
    entities: 1,
    relations: 0,
    others: 0,
    origin: AI,
  });
  expect(found.row).toMatchObject({
    status: 'accepted',
    decided_as: 'unit',
    decision_origin: AI,
    decision_reason: WHY,
  });
  expect(found.decidedRead.acts).toContainEqual({
    id: found.owner,
    decisionOrigin: AI,
    decisionReason: WHY,
  });
});

test('a rejection of a unit by the research role keeps the reason, the note and the reason of the AI', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { vessel } = await seeded(ask);
    const said = await asResearch(ask, async (call) =>
      outputOf(
        await call('reject_unit', {
          unitId: vessel,
          reason: 'not_in_source',
          note: 'The page names no flag.',
          why: WHY,
        }),
      ),
    );
    return { said, row: (await rowsOf(ask, [vessel])).get(vessel) };
  });
  expect(found.said).toMatchObject({ name: 'Baltic Star', entities: 1, origin: AI });
  expect(found.row).toMatchObject({
    status: 'rejected',
    decided_as: 'unit',
    decision_origin: AI,
    decision_reason: WHY,
    reject_reason: 'not_in_source',
    reject_note: 'The page names no flag.',
  });
});

test('a rejection of one relation by the research role leaves the rest of the queue', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await seeded(ask);
    const said = await asResearch(ask, async (call) =>
      outputOf(
        await call('reject_relation', { relationId: units.link, reason: 'wrong_type', why: WHY }),
      ),
    );
    return { said, rows: await rowsOf(ask, [units.link, units.vessel, units.owner]), units };
  });
  expect(found.said).toMatchObject({ relations: 1, entities: 0, origin: AI });
  expect(found.rows.get(found.units.link)).toMatchObject({
    status: 'rejected',
    decided_as: 'relation',
    decision_origin: AI,
    decision_reason: WHY,
    reject_reason: 'wrong_type',
  });
  expect(found.rows.get(found.units.vessel)?.status).toBe('pending');
  expect(found.rows.get(found.units.owner)?.status).toBe('pending');
});

test('the research role cannot promote a unit with an impossible link, and the refusal names the field', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await seeded(ask);
    return asResearch(ask, async (call) => {
      outputOf(
        await call('reject_unit', { unitId: units.owner, reason: 'out_of_scope', why: WHY }),
      );
      return {
        refused: await call('promote_unit', { unitId: units.link, why: WHY }),
        units,
      };
    });
  });
  expect(found.refused.refused).toBe(true);
  expect(found.refused.text).toMatch(
    /^the record refused the call: unitId: nothing of the unit is promoted: /u,
  );
  expect(found.refused.text).toContain('Nordic Holding');
});

test('a refusal of the record reaches the AI reviewer with its reason and its field', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const { vessel } = await seeded(ask);
    return asResearch(ask, async (call) => [
      await call('reject_unit', { unitId: vessel, reason: 'other', why: WHY }),
      await call('reject_unit', { unitId: vessel, reason: 'a guess', why: WHY }),
      await call('promote_unit', { unitId: randomUUID(), why: WHY }),
    ]);
  });
  expect(found).toStrictEqual([
    {
      refused: true,
      text: 'the record refused the call: note: a rejection for another reason says that reason in its note',
    },
    {
      refused: true,
      text: expect.stringMatching(
        /^the record refused the call: reason: a rejection names one reason: /u,
      ) as string,
    },
    {
      refused: true,
      text: expect.stringMatching(
        /^the record refused the call: unitId: the record holds no unit /u,
      ) as string,
    },
  ]);
});

test('a decision of the research role never reads as a rule or as the operator', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await seeded(ask);
    await asResearch(ask, async (call) => {
      outputOf(await call('promote_unit', { unitId: units.owner, why: WHY }));
      outputOf(await call('reject_unit', { unitId: units.vessel, reason: 'duplicate', why: WHY }));
    });
    return rowsOf(ask, [units.owner, units.vessel]);
  });
  for (const row of found.values()) {
    expect(row.decision_origin).toBe(AI);
    expect(row.decided_as).not.toBe('rule');
  }
});

test('the group action of the research role writes each clean unit as a decision of an AI reviewer, and refuses the others', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await seeded(ask);
    const [group] = z
      .array(z.object({ batch_id: z.uuid() }))
      .parse(
        await ask('SELECT batch_id::text FROM public.proposals WHERE id = $1', [units.vessel]),
      );
    const said = await asResearch(ask, async (call) =>
      z
        .object({
          results: z.array(
            z.object({ unit: z.uuid(), outcome: z.string(), said: z.string().nullable() }),
          ),
          origin: z.string(),
        })
        .parse(
          outputOf(
            await call('promote_clean_proposals', {
              groupId: group?.batch_id,
              unitIds: [units.vessel, units.link, units.owner],
              why: WHY,
            }),
          ),
        ),
    );
    return { said, rows: await rowsOf(ask, [units.vessel, units.link, units.owner]), units };
  });
  expect(found.said.origin).toBe(AI);
  const outcome = new Map(found.said.results.map((one) => [one.unit, one] as const));
  expect(outcome.get(found.units.vessel)).toMatchObject({ outcome: 'promoted', said: null });
  // The page would not write these two: the link is blocked, and the owner is in another group.
  expect(outcome.get(found.units.link)?.outcome).toBe('refused');
  expect(outcome.get(found.units.owner)).toMatchObject({
    outcome: 'refused',
    said: 'The unit is not in this group',
  });
  expect(found.rows.get(found.units.vessel)).toMatchObject({
    status: 'accepted',
    decided_as: 'group',
    decision_origin: AI,
    decision_reason: WHY,
  });
  expect(found.rows.get(found.units.link)?.status).toBe('pending');
  expect(found.rows.get(found.units.owner)?.status).toBe('pending');
});

test('the group action of the research role needs its reason, and the refusal names the field', async () => {
  const called = await rolledBack('superuser', async (ask) => {
    const { vessel } = await seeded(ask);
    return asResearch(ask, (call) =>
      call('promote_clean_proposals', { groupId: randomUUID(), unitIds: [vessel], why: ' ' }),
    );
  });
  expect(called.refused).toBe(true);
  expect(called.text).toMatch(/^why: /u);
});

// ----------------------------------------------------------------------------- perimeter ---

// The steps of the rules and of the decisions stand in the database for the doors to call, and
// the research role holds none of them.
const STEPS = [
  'public.apply_rules(gen_random_uuid())',
  'public.run_rules(ARRAY[gen_random_uuid()])',
  "public.write_unit_as(gen_random_uuid(), 'a test', 'rule', 'rule strong_sources v1')",
  "public.promote_unit_as(gen_random_uuid(), 'a test', 'rule strong_sources v1', NULL)",
  "public.reject_unit_as(gen_random_uuid(), 'duplicate', NULL, 'a test', 'rule impossible v1', NULL)",
  "public.ai_decision('promote', gen_random_uuid(), NULL, NULL, 'a test')",
  "public.promote_group_as(gen_random_uuid(), ARRAY[gen_random_uuid()], 'a test', NULL, NULL)",
] as const;

for (const step of STEPS)
  test(`the research role is refused when it calls ${step}`, async () => {
    await expect(rolledBack('research', (ask) => ask(`SELECT ${step}`))).rejects.toMatchObject({
      code: '42501',
    });
  });

test('the research role cannot write the decision of an act directly', async () => {
  await expect(
    rolledBack('research', (ask) =>
      ask(`UPDATE public.proposals SET status = 'accepted', decision_origin = 'rule strong_sources v1'
            WHERE status = 'pending'`),
    ),
  ).rejects.toMatchObject({ code: '42501' });
});

test('a decision of an AI reviewer needs its reason, and no other decision holds one', async () => {
  const refused = async (origin: string, reason: string | null): Promise<unknown> =>
    rolledBack('superuser', async (ask) => {
      const { owner } = await seeded(ask);
      return ask(
        `UPDATE public.proposals SET status = 'accepted', decided_at = now(), decided_by = 'a test',
           decision_origin = $2, decision_reason = $3 WHERE id = $1`,
        [owner, origin, reason],
      );
    });
  await expect(refused(AI, null)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_decision_reason',
  });
  await expect(refused('validated manually by the operator', WHY)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_decision_reason',
  });
});

test('the research role joins a doubted event to an event that waits, through the server', async () => {
  const other = 'doc_ai_reviewer_second';
  const event = (id: string, originator: string, document: string, doubt: boolean): Item =>
    cited(
      {
        id,
        op: 'create_entity',
        payload: {
          type: 'event',
          label: 'claimed attack — Riga — 2026-05-15',
          sources: [document],
        },
        src: [document],
        originator,
        citations: [{ document, text_extractor: EXTRACTOR, page: 1, start: 4, end: 10 }],
        ...(doubt ? { dissent: true, dissent_reason: 'two readings differ' } : {}),
      },
      'tanker',
    );
  const found = await rolledBack('superuser', async (ask) => {
    const waiting = randomUUID();
    const doubted = randomUUID();
    for (const document of [DOC, other]) {
      await ask(PUT, [document]);
      await ask(TEXT, [document, JSON.stringify([PAGE]), EXTRACTOR]);
    }
    await proposed(ask, [event(waiting, 'The general staff', DOC, false)]);
    await proposed(ask, [event(doubted, 'A news agency', other, true)]);
    await fromAnEarlierTransaction(ask);
    const calls = await asResearch(ask, async (call) => ({
      backwards: await call('join_unit', { unitId: waiting, waitingId: doubted, why: WHY }),
      joined: await call('join_unit', { unitId: doubted, waitingId: waiting, why: WHY }),
      again: await call('join_unit', { unitId: doubted, waitingId: waiting, why: WHY }),
    }));
    const rows = await rowsOf(ask, [waiting, doubted]);
    return { calls, rows, waiting, doubted };
  });
  expect(found.calls.backwards.refused).toBe(true);
  expect(found.calls.backwards.text).toMatch(/^the record refused the call: unitId: /u);
  expect(outputOf(found.calls.joined)).toStrictEqual({
    name: 'claimed attack — Riga — 2026-05-15',
    doubted: found.doubted,
    waiting: found.waiting,
    documents: 1,
    passages: 1,
    origin: AI,
  });
  expect(found.calls.again.refused).toBe(true);
  expect(found.rows.get(found.doubted)).toMatchObject({
    status: 'rejected',
    decision_origin: AI,
    decision_reason: WHY,
  });
  expect(found.rows.get(found.waiting)).toMatchObject({ status: 'pending' });
});

// ---------------------------------------------------------------- the lane of a reviewer ---

const WAITING_LANE =
  'the unit is in the lane "waiting", and the rule "a waiting unit is not for a reviewer" ' +
  'applies: an AI reviewer decides a doubt only, and the rules or the operator decide this unit';

test('an AI reviewer cannot promote a unit of the lane "waiting", alone or in a group', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await seeded(ask, false);
    const [group] = z
      .array(z.object({ batch_id: z.uuid() }))
      .parse(
        await ask('SELECT batch_id::text FROM public.proposals WHERE id = $1', [units.vessel]),
      );
    const calls = await asResearch(ask, async (call) => ({
      one: await call('promote_unit', { unitId: units.owner, why: WHY }),
      group: z
        .object({
          results: z.array(
            z.object({
              unit: z.uuid(),
              name: z.string(),
              outcome: z.string(),
              said: z.string().nullable(),
            }),
          ),
        })
        .parse(
          outputOf(
            await call('promote_clean_proposals', {
              groupId: group?.batch_id,
              unitIds: [units.vessel],
              why: WHY,
            }),
          ),
        ),
    }));
    return { calls, rows: await rowsOf(ask, [units.owner, units.vessel]), units };
  });
  expect(found.calls.one).toStrictEqual({
    refused: true,
    text: `the record refused the call: unitId: ${WAITING_LANE}`,
  });
  expect(found.calls.group.results).toStrictEqual([
    { unit: found.units.vessel, name: 'Baltic Star', outcome: 'refused', said: WAITING_LANE },
  ]);
  expect(found.rows.get(found.units.owner)?.status).toBe('pending');
  expect(found.rows.get(found.units.vessel)?.status).toBe('pending');
});

// ------------------------------------------------------- a removal and a join of the record ---

// The three units of `seeded`, in the record, from a review of an earlier transaction.
const promoted = async (ask: Ask): Promise<Units> => {
  const units = await seeded(ask);
  await asResearch(ask, async (call) => {
    for (const unit of [units.owner, units.vessel, units.link])
      outputOf(await call('promote_unit', { unitId: unit, why: WHY }));
  });
  return units;
};

const REMOVED = `SELECT p.removed_by::text AS removed_by, x.removed_by AS who, x.decision_origin,
         x.decision_reason, (SELECT count(*)::int FROM public.citation c
                              WHERE c.claim_id = x.removal_id) AS passages
    FROM api.proposal p JOIN public.removed_act x ON x.act_id = p.id WHERE p.id = $1`;

const ACCEPTED = `SELECT count(*)::int AS n FROM api.proposal
   WHERE status = 'accepted' AND removed_by IS NULL AND id = ANY ($1::uuid[])`;

const count = z.array(z.object({ n: z.number().int() }));

test('an AI reviewer removes an accepted relation: it leaves the read, the export and the count', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await promoted(ask);
    const ids = [units.owner, units.vessel, units.link];
    const before = count.parse(await ask(ACCEPTED, [ids]))[0]?.n;
    const passage = { document: DOC, page: 1, excerpt: 'is owned by Nordic Holding' };
    const calls = await asResearch(ask, async (call) => ({
      removed: z
        .object({ removal: z.uuid(), act: z.uuid(), name: z.string(), origin: z.string() })
        .parse(outputOf(await call('remove_act', { actId: units.link, passage, why: WHY }))),
      again: await call('remove_act', { actId: units.link, passage, why: WHY }),
      entity: await call('remove_act', { actId: units.owner, passage, why: WHY }),
      walk: z
        .object({ entities: z.array(z.object({ id: z.uuid() })) })
        .parse(outputOf(await call('neighbourhood', { root: units.owner, depth: 1 }))),
    }));
    return {
      units,
      calls,
      before,
      after: count.parse(await ask(ACCEPTED, [ids]))[0]?.n,
      relation: await ask('SELECT id FROM api.relation WHERE id = $1', [units.link]),
      trace: await ask(REMOVED, [units.link]),
      removal: (await rowsOf(ask, [calls.removed.removal])).get(calls.removed.removal),
    };
  });
  expect(found.calls.removed).toMatchObject({ act: found.units.link, origin: AI });
  expect(found.calls.again.text).toMatch(/^the record refused the call: actId: .*removed already/u);
  expect(found.calls.entity.text).toMatch(
    /^the record refused the call: actId: .*only a new relation or a change of the values/u,
  );
  // The read of the graph and the export read api.relation: the relation is gone.
  expect(found.relation).toStrictEqual([]);
  expect(found.calls.walk.entities.map((one) => one.id)).toStrictEqual([found.units.owner]);
  expect(found.before).toBe(3);
  expect(found.after).toBe(2);
  expect(found.trace).toStrictEqual([
    {
      removed_by: found.calls.removed.removal,
      who: 'an AI reviewer, through the MCP server',
      decision_origin: AI,
      decision_reason: WHY,
      passages: 1,
    },
  ]);
  expect(found.removal).toMatchObject({ status: 'accepted', decision_origin: AI });
});

test('an AI reviewer removes an accepted value, and the value before it comes back', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await promoted(ask);
    const value = (act: string, imo: string): Item =>
      cited(
        {
          id: act,
          op: 'update_attrs',
          target_kind: 'entity',
          target_id: units.vessel,
          payload: { attrs: { imo: { v: imo, src: [DOC] } } },
        },
        'Baltic Star',
      );
    const first = randomUUID();
    const second = randomUUID();
    await proposed(ask, [value(first, '9074729')]);
    await doubted(ask, [first]);
    await fromAnEarlierTransaction(ask);
    await asResearch(ask, async (call) =>
      outputOf(await call('promote_unit', { unitId: first, why: WHY })),
    );
    // The test runs in one transaction, so the first decision is dated back an hour.
    await ask('ALTER TABLE public.proposals DISABLE TRIGGER proposals_append_only');
    await ask(
      "UPDATE public.proposals SET decided_at = decided_at - interval '1 hour' WHERE id = $1",
      [first],
    );
    await ask('ALTER TABLE public.proposals ENABLE ALWAYS TRIGGER proposals_append_only');
    await proposed(ask, [value(second, '9321483')]);
    await doubted(ask, [second]);
    await fromAnEarlierTransaction(ask);
    const passage = { document: DOC, page: 1, excerpt: 'Baltic Star' };
    const calls = await asResearch(ask, async (call) => {
      outputOf(await call('promote_unit', { unitId: second, why: WHY }));
      return {
        early: await call('remove_act', { actId: first, passage, why: WHY }),
        late: await call('remove_act', { actId: second, passage, why: WHY }),
      };
    });
    const imo = z
      .array(z.object({ imo: z.unknown(), label: z.unknown() }))
      .parse(
        await ask(
          "SELECT attrs->'imo'->'v' AS imo, attr_labels->>'imo' AS label FROM api.entity " +
            'WHERE id = $1',
          [units.vessel],
        ),
      );
    return { calls, imo };
  });
  expect(found.calls.early.text).toMatch(/^the record refused the call: actId: a later act set/u);
  expect(found.calls.late.refused).toBe(false);
  // The value and its label come from the first act again.
  expect(found.imo).toStrictEqual([
    { imo: '9074729', label: expect.stringMatching(/^Accepted by an AI reviewer/u) as string },
  ]);
});

const ENTITY = `SELECT id::text AS id, attrs->'former_names'->'v' AS former FROM public.entities
   WHERE id = ANY ($1::uuid[]) ORDER BY id`;

test('an AI reviewer joins two entities of one firm: the older one takes the relations and the name', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await promoted(ask);
    const twin = randomUUID();
    // The test runs in one transaction, so the owner is dated back a day: it is the older one.
    await ask(
      "UPDATE public.entities SET created_at = created_at - interval '1 day' WHERE id = $1",
      [units.owner],
    );
    await proposed(ask, [entity(twin, 'company', 'Holding')]);
    await doubted(ask, [twin]);
    await fromAnEarlierTransaction(ask);
    const passage = { document: DOC, page: 1, excerpt: 'Nordic Holding, a company of Riga' };
    const calls = await asResearch(ask, async (call) => {
      outputOf(await call('promote_unit', { unitId: twin, why: WHY }));
      return {
        joined: z
          .object({ join: z.uuid(), kept: z.uuid(), absorbed: z.uuid(), origin: z.string() })
          .parse(
            outputOf(
              await call('join_entities', {
                entityIds: [twin, units.owner],
                passage,
                why: WHY,
              }),
            ),
          ),
      };
    });
    return {
      units,
      twin,
      calls,
      entities: await ask(ENTITY, [[units.owner, twin]]),
      relation: await ask('SELECT src_id::text AS src FROM public.relations WHERE id = $1', [
        units.link,
      ]),
      alias: await ask(
        'SELECT survivor_id::text AS survivor, merged_by::text AS act FROM public.entity_alias ' +
          'WHERE absorbed_id = $1',
        [twin],
      ),
      act: (await rowsOf(ask, [calls.joined.join])).get(calls.joined.join),
      undo: await ask(
        "SELECT has_function_privilege('gabriel_research', 'public.undo_merge(text,uuid)', " +
          "'EXECUTE') AS held",
      ),
    };
  });
  // The owner is the older entity, so it stays.
  expect(found.calls.joined).toMatchObject({
    kept: found.units.owner,
    absorbed: found.twin,
    origin: AI,
  });
  expect(found.entities).toStrictEqual([{ id: found.units.owner, former: ['Holding'] }]);
  expect(found.relation).toStrictEqual([{ src: found.units.owner }]);
  expect(found.alias).toStrictEqual([
    { survivor: found.units.owner, act: found.calls.joined.join },
  ]);
  expect(found.act).toMatchObject({
    status: 'accepted',
    decision_origin: AI,
    decision_reason: WHY,
  });
  expect(found.undo).toStrictEqual([{ held: false }]);
});

test('an AI reviewer cannot join two entities of two types, or one entity with itself', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await promoted(ask);
    const passage = { document: DOC, page: 1, excerpt: 'Baltic Star' };
    return asResearch(ask, async (call) => ({
      types: await call('join_entities', {
        entityIds: [units.owner, units.vessel],
        passage,
        why: WHY,
      }),
      itself: await call('join_entities', {
        entityIds: [units.owner, units.owner],
        passage,
        why: WHY,
      }),
      count: await call('neighbourhood', { root: units.owner, depth: 1 }),
    }));
  });
  expect(found.types.text).toBe(
    'the record refused the call: entityIds: the two entities have two types, company and ' +
      'vessel, and a join takes two entities of one type',
  );
  expect(found.itself.text).toBe(
    'the record refused the call: entityIds: a join names two entities, and the two ' +
      'identifiers name one entity',
  );
  expect(found.count.refused).toBe(false);
});

test('an AI reviewer cannot remove an act that waits, or a relation that an act in the queue names', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await seeded(ask);
    const passage = { document: DOC, page: 1, excerpt: 'Baltic Star' };
    await asResearch(ask, async (call) => {
      for (const unit of [units.owner, units.vessel, units.link])
        outputOf(await call('promote_unit', { unitId: unit, why: WHY }));
    });
    // An end date of the relation waits in the queue.
    const change = randomUUID();
    await proposed(ask, [
      cited(
        {
          id: change,
          op: 'update_relation',
          target_kind: 'relation',
          target_id: units.link,
          payload: { valid_to: '2026-01-01' },
        },
        'is owned by Nordic Holding',
      ),
    ]);
    return asResearch(ask, async (call) => ({
      waits: await call('remove_act', { actId: change, passage, why: WHY }),
      named: await call('remove_act', { actId: units.link, passage, why: WHY }),
    }));
  });
  expect(found.waits.text).toMatch(/^the record refused the call: actId: .*only an accepted act/u);
  expect(found.named.text).toMatch(
    /^the record refused the call: actId: an act in the queue names the relation/u,
  );
});

test('an AI reviewer removes a value of an entity that a join absorbed, on the entity that stays', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await promoted(ask);
    await ask(
      "UPDATE public.entities SET created_at = created_at - interval '1 day' WHERE id = $1",
      [units.owner],
    );
    const twin = randomUUID();
    const value = randomUUID();
    await proposed(ask, [entity(twin, 'company', 'Holding')]);
    await doubted(ask, [twin]);
    await fromAnEarlierTransaction(ask);
    await asResearch(ask, async (call) =>
      outputOf(await call('promote_unit', { unitId: twin, why: WHY })),
    );
    await proposed(ask, [
      cited(
        {
          id: value,
          op: 'update_attrs',
          target_kind: 'entity',
          target_id: twin,
          payload: { attrs: { lei: { v: '5493001KJTIIGC8Y1R12', src: [DOC] } } },
        },
        'Nordic Holding',
      ),
    ]);
    await doubted(ask, [value]);
    await fromAnEarlierTransaction(ask);
    const passage = { document: DOC, page: 1, excerpt: 'Nordic Holding, a company of Riga' };
    const calls = await asResearch(ask, async (call) => {
      outputOf(await call('promote_unit', { unitId: value, why: WHY }));
      outputOf(await call('join_entities', { entityIds: [units.owner, twin], passage, why: WHY }));
      return call('remove_act', { actId: value, passage, why: WHY });
    });
    const lei = await ask("SELECT attrs ? 'lei' AS held FROM public.entities WHERE id = $1", [
      units.owner,
    ]);
    return { calls, lei };
  });
  expect(found.calls.refused).toBe(false);
  expect(found.lei).toStrictEqual([{ held: false }]);
});

test('a removed relation takes each accepted change of it out of the count', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const units = await promoted(ask);
    const end = randomUUID();
    await proposed(ask, [
      cited(
        {
          id: end,
          op: 'update_relation',
          target_kind: 'relation',
          target_id: units.link,
          payload: { valid_to: '2026-01-01' },
        },
        'is owned by Nordic Holding',
      ),
    ]);
    await doubted(ask, [end]);
    await fromAnEarlierTransaction(ask);
    const passage = { document: DOC, page: 1, excerpt: 'is owned by Nordic Holding' };
    const removal = await asResearch(ask, async (call) => {
      outputOf(await call('promote_unit', { unitId: end, why: WHY }));
      return z
        .object({ removal: z.uuid() })
        .parse(outputOf(await call('remove_act', { actId: units.link, passage, why: WHY })))
        .removal;
    });
    return {
      removal,
      rows: await ask(
        'SELECT id::text AS id, removed_by::text AS removed_by FROM api.proposal ' +
          'WHERE id = ANY ($1::uuid[]) ORDER BY id',
        [[units.link, end].sort()],
      ),
      ids: [units.link, end].sort(),
    };
  });
  expect(found.rows).toStrictEqual(found.ids.map((id) => ({ id, removed_by: found.removal })));
});
