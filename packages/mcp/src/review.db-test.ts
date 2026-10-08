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

// A company in one batch. A vessel and the link from the company to the vessel in a second
// batch, so the link is a unit of its own that waits for the company.
const seeded = async (ask: Ask): Promise<Units> => {
  const units = { owner: randomUUID(), vessel: randomUUID(), link: randomUUID() };
  await ask(PUT, [DOC]);
  await ask(TEXT, [DOC, JSON.stringify([PAGE]), EXTRACTOR]);
  await proposed(ask, [entity(units.owner, 'company', 'Nordic Holding')]);
  await proposed(ask, [
    entity(units.vessel, 'vessel', 'Baltic Star'),
    relation(units.link, units.owner, units.vessel),
  ]);
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
    const { vessel } = await seeded(ask);
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
