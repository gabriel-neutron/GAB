// The stubs of the extractor tests: a gateway that answers from a script, and the deps with a
// clock and a sleep that cost no time. No code outside a test imports this file.

import { gatewayModel } from '@gab/model';
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

const ENV = { FREELLMAPI_API_KEY: 'a-stub-key', FREELLMAPI_BASE_URL: 'http://100.64.0.1:4001/v1' };

/** A completion as the gateway words it. */
export const completionOf = (content: string, model = READER.model): Response =>
  new Response(
    JSON.stringify({
      model,
      choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    }),
    { status: 200 },
  );

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

export interface StubGateway {
  readonly send: typeof fetch;
  /** The questions to the reader. */
  readonly chats: () => number;
  /** The questions to the checker. */
  readonly checks: () => number;
}

const bodyOf = (init: RequestInit | undefined): string =>
  typeof init?.body === 'string' ? init.body : '';

/** A gateway that answers each question to the reader from `chat`, and each question to the
 * checker from `check`. The default checker supports every claim. */
export const gatewayOf = (
  chat: (call: number, body: string) => Response,
  check: (call: number, body: string) => Response = (_call, body) => supportsAll(body),
): StubGateway => {
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

export interface Stubs {
  readonly deps: RunnerDeps;
  readonly slept: number[];
}

/** The deps with the stub gateway, a clock that moves five milliseconds at each read and a sleep
 * that records its wait and costs nothing. */
export const depsOf = (
  db: Queryable,
  agents: readonly RunnerAgent[],
  gateway: StubGateway,
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
      open: (model) => gatewayModel(model, ENV, gateway.send),
    },
  };
};
