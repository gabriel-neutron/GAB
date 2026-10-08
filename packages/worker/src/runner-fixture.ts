// The stubs of the extractor tests: a router that answers from a script, and the deps with a
// clock and a sleep that cost no time. No code outside a test imports this file.

import { openrouterModel } from '@gab/model';
import { z } from 'zod';

import type { RunnerAgent } from './agents.ts';
import type { Queryable } from './queryable.ts';
import type { ModelConfig } from './reader-config.ts';
import type { RunnerDeps } from './runner.ts';

const LINE = { firstWaitMs: 1, waitGrowth: 1, maxWaitMs: 1, timeoutMs: 1000, maxAnswerTokens: 200 };

export const READER: ModelConfig = {
  model: 'stub-family/stub-model',
  family: 'stub-family',
  line: LINE,
};

export const CHECKER: ModelConfig = {
  model: 'other-family/check-model',
  family: 'other-family',
  line: LINE,
};

const ENV = { OPENROUTER_API_KEY: 'a-stub-key' };

/** A completion as the router words it. */
export const completionOf = (content: string, model = READER.model): Response =>
  new Response(
    JSON.stringify({
      model,
      choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    }),
    { status: 200 },
  );

/** One tool call as the router words it. */
export const toolCallOf = (name: string, input: unknown, id = `call_${name}`): Response =>
  new Response(
    JSON.stringify({
      model: READER.model,
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id, type: 'function', function: { name, arguments: JSON.stringify(input) } },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    }),
    { status: 200 },
  );

const offered = z.object({
  tools: z.array(z.object({ function: z.object({ name: z.string() }) })).default([]),
});

/** The names of the tools that one question offers to the model. */
export const toolsOf = (body: string): string[] =>
  offered.parse(JSON.parse(body)).tools.map((one) => one.function.name);

const sent = z.object({
  model: z.string(),
  messages: z.array(z.object({ role: z.string(), content: z.unknown() })),
});

const question = z.object({ claims: z.array(z.object({ ref: z.string() })) });

/** The refs of the claims that one question to the checker holds. */
export const claimsOf = (body: string): string[] => {
  const last = sent.parse(JSON.parse(body)).messages.at(-1)?.content;
  return question
    .parse(JSON.parse(typeof last === 'string' ? last : '{}'))
    .claims.map((one) => one.ref);
};

/** The checker answers with one verdict for each ref. */
export const verdictsOf = (verdicts: readonly (readonly [string, string])[]): Response =>
  completionOf(
    JSON.stringify({ verdicts: verdicts.map(([ref, verdict]) => ({ ref, verdict })) }),
    CHECKER.model,
  );

const supportsAll = (body: string): Response =>
  verdictsOf(claimsOf(body).map((ref) => [ref, 'supported'] as const));

export interface StubRouter {
  readonly send: typeof fetch;
  /** The questions to the reader. */
  readonly chats: () => number;
  /** The questions to the checker. */
  readonly checks: () => number;
}

const bodyOf = (init: RequestInit | undefined): string =>
  typeof init?.body === 'string' ? init.body : '';

/** A router that answers each question to the reader from `chat`, and each question to the
 * checker from `check`. The default checker supports every claim. */
export const routerOf = (
  chat: (call: number, body: string) => Response,
  check: (call: number, body: string) => Response = (_call, body) => supportsAll(body),
): StubRouter => {
  let chats = 0;
  let checks = 0;
  return {
    send: (_url, init) => {
      const body = bodyOf(init);
      if (sent.parse(JSON.parse(body)).model === CHECKER.model) {
        checks += 1;
        return Promise.resolve(check(checks, body));
      }
      chats += 1;
      return Promise.resolve(chat(chats, body));
    },
    chats: () => chats,
    checks: () => checks,
  };
};

interface Stubs {
  readonly deps: RunnerDeps;
  readonly slept: number[];
}

/** The deps with the stub router, a clock that moves five milliseconds at each read and a sleep
 * that records its wait and costs nothing. */
export const depsOf = (
  db: Queryable,
  agents: readonly RunnerAgent[],
  router: StubRouter,
): Stubs => {
  const slept: number[] = [];
  let clock = 0;
  return {
    slept,
    deps: {
      db,
      agents,
      sleep: (ms) => {
        slept.push(ms);
        return Promise.resolve();
      },
      now: () => {
        clock += 5;
        return clock;
      },
      open: (model) => openrouterModel(model, ENV, router.send),
    },
  };
};
