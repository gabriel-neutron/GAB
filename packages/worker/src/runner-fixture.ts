// The stubs of the extractor tests: a gateway that answers from a script, and the deps with a
// clock and a sleep that cost no time. No code outside a test imports this file.

import { openModel, type AgentModel, type Model, type Send } from '@gab/model';

import type { RunnerAgent } from './agents.ts';
import type { Queryable } from './queryable.ts';
import type { RunnerDeps } from './runner.ts';

export const STUB_MODEL: AgentModel = {
  endpoint: 'freellmapi',
  model: 'stub-family/stub-model',
  firstWaitMs: 1,
  waitGrowth: 1,
  maxWaitMs: 1,
  timeoutMs: 1000,
  maxAnswerTokens: 200,
};

const ENV = { FREELLMAPI_API_KEY: 'a-stub-key', FREELLMAPI_BASE_URL: 'http://100.64.0.1:4001/v1' };

/** A completion as the gateway words it. */
export const completionOf = (content: string, model = STUB_MODEL.model): Response =>
  new Response(
    JSON.stringify({
      model,
      choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    }),
    { status: 200 },
  );

export interface StubGateway {
  readonly send: Send;
  readonly chats: () => number;
}

/** A gateway that answers each chat call from `chat`, which reads the body that was sent. */
export const gatewayOf = (chat: (call: number, body: string) => Response): StubGateway => {
  let chats = 0;
  return {
    send: (_url, init) => {
      chats += 1;
      return Promise.resolve(chat(chats, typeof init.body === 'string' ? init.body : ''));
    },
    chats: () => chats,
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
      open: (settings): Model => openModel(settings, gateway.send, ENV),
    },
  };
};
