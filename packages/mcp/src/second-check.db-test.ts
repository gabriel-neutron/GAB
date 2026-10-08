// The check of a research batch by a second model, through the server, against the disposable
// database. Each test runs in one transaction that rolls back, on one connection that signs as
// the owner to seed and to read, and as gabriel_research while the server works. Each model call
// goes to the stub router of the worker tests: no test reaches a model.

import { randomUUID } from 'node:crypto';

import { openrouterModel } from '@gab/model';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { reference } from '../../../tools/author-fixture.ts';
import { rolledBack, type Ask } from '../../../tools/probe.ts';
import {
  CHECKER,
  claimsOf,
  completionOf,
  routerOf,
  verdictsOf,
  type StubRouter,
} from '@gab/worker/runner-fixture';
import type { SecondCheck } from './second-check.ts';
import { createServer, type SessionPool } from './server.ts';

const SHA = 'f'.repeat(64);
const DOC = `doc_${SHA.slice(0, 12)}`;

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';
const PAGE = 'The tanker Nayara left Sikka on 2 May. Rosneft owns the tanker Nayara.';

const STUB_ENV = { OPENROUTER_API_KEY: 'a-stub-key' };

// Origin: decided. The cap holds a batch of two short items with the prompt and the answer.
const ROOMY_CAP = 20_000;

const itemOf = (ref: string, label: string, type: string, excerpt: string) => ({
  ref,
  act: { op: 'create_entity', type, label },
  originator: 'The port authority',
  modality: 'asserts',
  evidence: [{ document: DOC, page: 1, excerpt }],
});

const NAYARA = itemOf('nayara', 'Nayara', 'vessel', 'The tanker Nayara left Sikka');
const ROSNEFT = itemOf('rosneft', 'Rosneft', 'company', 'Rosneft owns the tanker Nayara');

const checkOf = (router: StubRouter, tokenCap = ROOMY_CAP): SecondCheck => ({
  ready: true,
  setup: {
    checker: CHECKER,
    tokenCap,
    open: (model) => openrouterModel(model, STUB_ENV, router.send),
  },
});

const answer = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  isError: z.boolean().optional(),
});

const outcome = z.object({
  proposals: z.array(z.object({ ref: z.string(), proposalId: z.uuid(), disputed: z.boolean() })),
  checkFailure: z.string().optional(),
});

const acts = z.array(
  z.object({
    label: z.string(),
    dissent: z.boolean(),
    dissent_reason: z.string().nullable(),
    checker_model: z.string().nullable(),
    checker_family: z.string().nullable(),
    reader_family: z.string().nullable(),
    verdict: z.string().nullable(),
    passed: z.boolean().nullable(),
  }),
);

const ACTS = `SELECT p.payload ->> 'label' AS label, p.dissent, p.dissent_reason, k.checker_model,
                     k.checker_family, k.reader_family, k.verdict, k.passed
                FROM public.proposals p LEFT JOIN public.act_check k ON k.proposal_id = p.id
               WHERE $1 = ANY (p.src::text[]) ORDER BY p.payload ->> 'label'`;

const CALLS = `SELECT count(*)::int AS n FROM public.model_call
                WHERE agent = 'research-check' AND requested_model = $1`;

interface Run {
  /** The answer of the last call. */
  readonly output: z.output<typeof outcome>;
  readonly acts: z.output<typeof acts>;
  readonly calls: number;
  /** The rule of the unit of each act after each call. */
  readonly rules: readonly (readonly (string | null)[])[];
  /** The status of each act at the end. */
  readonly statuses: readonly string[];
}

const RULES = `SELECT public.unit_rule(p.unit_id) AS rule, p.status FROM public.proposals p
                WHERE $1 = ANY (p.src::text[]) ORDER BY p.payload ->> 'label'`;

// Every call of the server takes the one session of the test, as gabriel_research.
const poolOf = (ask: Ask): SessionPool => ({
  connect: () =>
    Promise.resolve({
      query: async (text: string, values: unknown[]) => ({ rows: await ask(text, values) }),
      release: () => undefined,
    }),
});

// One call of propose with the same batch for each check, in one transaction, through a server
// whose client gives the name `client`.
const proposeThrough = (
  checks: SecondCheck | readonly SecondCheck[],
  items: readonly unknown[],
  client = 'claude-code',
  before: (ask: Ask) => Promise<unknown> = () => Promise.resolve(),
): Promise<Run> =>
  rolledBack('superuser', async (ask) => {
    await ask(STORE, [
      'url',
      'A port report',
      `raw/${SHA}`,
      'https://example.org/port-report',
      SHA,
      'application/pdf',
      '2026-10-01',
      null,
    ]);
    await ask(WRITE_TEXT, [DOC, JSON.stringify([PAGE]), 'second-check-test-1']);
    await before(ask);
    let last: { rule: string | null; status: string }[] = [];
    let text = '';
    const rules: (string | null)[][] = [];
    const rounds: readonly SecondCheck[] = 'ready' in checks ? [checks] : checks;
    for (const check of rounds) {
      await ask('SET LOCAL SESSION AUTHORIZATION gabriel_research');
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
      await createServer(poolOf(ask), undefined, check).connect(serverSide);
      const mcp = new Client({ name: client, version: '0.0.0' });
      await mcp.connect(clientSide);
      try {
        const called = answer.parse(await mcp.callTool({ name: 'propose', arguments: { items } }));
        text = called.content.map((part) => part.text).join('');
        if (called.isError === true) throw new Error(`the server refused the batch: ${text}`);
      } finally {
        await mcp.close();
      }
      await ask('RESET SESSION AUTHORIZATION');
      last = z
        .array(z.object({ rule: z.string().nullable(), status: z.string() }))
        .parse(await ask(RULES, [DOC]));
      rules.push(last.map((row) => row.rule));
    }
    const [counted] = z.array(z.object({ n: z.number() })).parse(await ask(CALLS, [CHECKER.model]));
    return {
      output: outcome.parse(JSON.parse(text)),
      acts: acts.parse(await ask(ACTS, [DOC])),
      calls: counted?.n ?? 0,
      rules,
      statuses: last.map((row) => row.status),
    };
  });

const passedCheck = {
  checker_model: CHECKER.model,
  checker_family: CHECKER.family,
  reader_family: 'anthropic',
};

test('a batch that its passages support gets one call and a passed check on each act', async () => {
  const router = routerOf(() => {
    throw new Error('the research check asks no reader');
  });
  const run = await proposeThrough(checkOf(router), [NAYARA, ROSNEFT]);

  expect(router.checks()).toBe(1);
  expect(run.calls).toBe(1);
  expect(run.output.checkFailure).toBeUndefined();
  expect(run.acts).toStrictEqual([
    {
      label: 'Nayara',
      dissent: false,
      dissent_reason: null,
      ...passedCheck,
      verdict: 'supported',
      passed: true,
    },
    {
      label: 'Rosneft',
      dissent: false,
      dissent_reason: null,
      ...passedCheck,
      verdict: 'supported',
      passed: true,
    },
  ]);
});

test('a fact that its passage does not support is disputed with the reason of the checker', async () => {
  const router = routerOf(
    () => {
      throw new Error('the research check asks no reader');
    },
    (_call, body) =>
      completionOf(
        JSON.stringify({
          verdicts: claimsOf(body).map((ref) =>
            ref === 'rosneft'
              ? { ref, verdict: 'not_supported', reason: 'The passage names no owner.' }
              : { ref, verdict: 'supported' },
          ),
        }),
        CHECKER.model,
      ),
  );
  const run = await proposeThrough(checkOf(router), [NAYARA, ROSNEFT]);

  expect(router.checks()).toBe(1);
  expect(run.output.proposals.map((one) => [one.ref, one.disputed])).toStrictEqual([
    ['nayara', false],
    ['rosneft', true],
  ]);
  expect(run.acts[1]).toStrictEqual({
    label: 'Rosneft',
    dissent: true,
    dissent_reason: 'the checker says not_supported: The passage names no owner.',
    ...passedCheck,
    verdict: 'not_supported',
    passed: false,
  });
});

const NO_CHECK = { dissent: false, dissent_reason: null, verdict: null, passed: null };

const failing = (): StubRouter =>
  routerOf(
    () => {
      throw new Error('the research check asks no reader');
    },
    () => new Response('{"error":{"message":"no credit"}}', { status: 402 }),
  );

test('a checker that fails gives no dispute and no check, and the unit waits', async () => {
  const router = failing();
  const run = await proposeThrough(checkOf(router), [NAYARA, ROSNEFT]);

  expect(router.checks()).toBe(1);
  expect(run.calls).toBe(1);
  expect(run.output.checkFailure).toBe('the checker failed: the model account has no credit left');
  expect(run.output.proposals.map((one) => one.disputed)).toStrictEqual([false, false]);
  for (const act of run.acts) expect(act).toMatchObject(NO_CHECK);
  expect(run.rules).toStrictEqual([['weak_sources', 'weak_sources']]);
});

test('the same batch sent again with the checker up gets its check, and the unit can pass', async () => {
  const down = failing();
  const up = routerOf(() => {
    throw new Error('the research check asks no reader');
  });
  const author = `Port authority ${randomUUID()}`;
  const run = await proposeThrough(
    [checkOf(down), checkOf(up)],
    [{ ...NAYARA, originator: author }],
    'claude-code',
    (ask) => reference(ask, author, 'A'),
  );

  expect([down.checks(), up.checks()]).toStrictEqual([1, 1]);
  expect(run.output.checkFailure).toBeUndefined();
  expect(run.acts).toStrictEqual([
    {
      label: 'Nayara',
      dissent: false,
      dissent_reason: null,
      ...passedCheck,
      verdict: 'supported',
      passed: true,
    },
  ]);
  // A source A waits for the check alone. After the check, the strong rule accepts the unit.
  expect(run.rules[0]).toStrictEqual(['weak_sources']);
  expect(run.statuses).toStrictEqual(['accepted']);
});

test('an unclear verdict is kept as a check that does not pass, with no dispute', async () => {
  const router = routerOf(
    () => {
      throw new Error('the research check asks no reader');
    },
    () => verdictsOf([['nayara', 'unclear']]),
  );
  const run = await proposeThrough(checkOf(router), [NAYARA]);

  expect(run.acts[0]).toMatchObject({ dissent: false, verdict: 'unclear', passed: false });
  expect(run.rules).toStrictEqual([['weak_sources']]);
});

test('an answer that names no item gives no check and no dispute', async () => {
  const router = routerOf(
    () => {
      throw new Error('the research check asks no reader');
    },
    () => verdictsOf([['someone_else', 'supported']]),
  );
  const run = await proposeThrough(checkOf(router), [NAYARA]);

  expect(run.acts).toStrictEqual([expect.objectContaining(NO_CHECK)]);
});

test('a batch above the token cap asks no model, and its items wait with no check', async () => {
  const router = routerOf(() => {
    throw new Error('the research check asks no reader');
  });
  const run = await proposeThrough(checkOf(router, 300), [NAYARA, ROSNEFT]);

  expect(router.checks()).toBe(0);
  expect(run.calls).toBe(0);
  expect(run.output.checkFailure).toMatch(/^the batch needs about \d+ tokens, above the cap/u);
  for (const act of run.acts) expect(act).toMatchObject(NO_CHECK);
});

test('a client of an unknown family asks no model, and its items wait with no check', async () => {
  const router = routerOf(() => {
    throw new Error('the research check asks no reader');
  });
  const run = await proposeThrough(checkOf(router), [NAYARA], 'a-client');

  expect(router.checks()).toBe(0);
  expect(run.output.checkFailure).toBe(
    'the server does not know the model family of the research AI',
  );
  expect(run.acts[0]).toMatchObject(NO_CHECK);
});

test('a server with no checker asks no model, and says why in the answer', async () => {
  const run = await proposeThrough(
    { ready: false, reason: 'OPENROUTER_API_KEY is empty, absent or wrong.' },
    [NAYARA],
  );

  expect(run.calls).toBe(0);
  expect(run.output.checkFailure).toBe(
    'the server has no checker: OPENROUTER_API_KEY is empty, absent or wrong.',
  );
  expect(run.acts[0]).toMatchObject(NO_CHECK);
});
