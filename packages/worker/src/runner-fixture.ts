// The stubs of the runner tests: a gateway that answers from a script, a stub agent that reads
// chunks and proposes one entity for each, and the deps with a clock and a sleep that cost no
// time. No code outside a test imports this file.

import { createHash } from 'node:crypto';

import { openModel, type AgentModel, type Model, type Send } from '@gab/model';
import { CATALOGUE } from '@gab/tools/catalogue';
import { callTool, type Session } from '@gab/tools/tool';
import { z } from 'zod';

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

/** The 429 that names a spent quota. */
export const quotaSpentResponse = (): Response =>
  new Response(JSON.stringify({ error: { message: 'daily quota exhausted' } }), { status: 429 });

/** What the quota read answers when some pool holds the given number of calls. */
export const forecastOf = (remaining: number): Response =>
  new Response(
    JSON.stringify({
      pools: [
        {
          platform: 'a-platform',
          pool: 'a-pool',
          remaining,
          limit: 100,
          reset_at: null,
          low_balance: remaining === 0,
        },
      ],
    }),
    { status: 200 },
  );

export interface StubGateway {
  readonly send: Send;
  readonly chats: () => number;
  readonly reads: () => number;
}

/** A gateway that answers each chat call from `chat` and each quota read from `forecast`. */
export const gatewayOf = (
  chat: (call: number) => Response,
  forecast: () => Response = () => forecastOf(50),
): StubGateway => {
  let chats = 0;
  let reads = 0;
  return {
    send: (url) => {
      if (url.endsWith('/quota-forecast')) {
        reads += 1;
        return Promise.resolve(forecast());
      }
      chats += 1;
      return Promise.resolve(chat(chats));
    },
    chats: () => chats,
    reads: () => reads,
  };
};

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const CLAIM = z.object({ claim: z.string().min(1) });

const sessionOf = (db: Queryable): Session => ({
  query: (text, values) => db.query(text, values),
});

const proposeTool = CATALOGUE.find((tool) => tool.name === 'propose_change');

export interface StubAgentOptions {
  readonly kind?: RunnerAgent['kind'];
  readonly chunks?: readonly string[];
  /** Throws after the proposals of the first run are written, as a worker that dies would. */
  readonly stopsAfterWriting?: boolean;
  readonly seen?: (status: string) => Promise<void>;
}

/** An agent that asks one question for each chunk and proposes the claim that the model gives. */
export const stubAgent = (options: StubAgentOptions = {}): RunnerAgent => {
  const chunks = options.chunks ?? ['the first chunk'];
  let runs = 0;
  return {
    name: 'stub',
    version: 'v1',
    kind: options.kind ?? 'extract_text',
    settings: STUB_MODEL,
    questionsPerJob: chunks.length,
    tokenCap: 10_000,
    run: async (context) => {
      runs += 1;
      if (proposeTool === undefined) throw new Error('the catalogue holds no propose_change');
      if (options.seen !== undefined) {
        const rows = z
          .array(z.object({ status: z.string() }))
          .parse(
            (
              await context.db.query('SELECT status FROM public.jobs WHERE id = $1', [
                context.job.id,
              ])
            ).rows,
          );
        await options.seen(rows[0]?.status ?? 'absent');
      }
      for (const chunk of chunks) {
        const asked = await context.ask({
          messages: [
            { role: 'system', content: 'Read the chunk and give one claim as JSON.' },
            { role: 'user', content: chunk },
          ],
          shape: CLAIM,
        });
        if (asked.kind !== 'value') throw new Error('the stub asks no tool');
        const outcome = await callTool(proposeTool, sessionOf(context.db), {
          act: { op: 'create_entity', type: 'vessel', label: asked.value.claim },
          documents: [context.job.documentId],
          modelCallId: asked.callId,
          idempotencyKey: context.keyOf({
            chunkHash: sha256(chunk),
            servedModel: asked.served,
            inputForm: 'page-text',
            promptHash: asked.promptHash,
          }),
        });
        if (!outcome.ok) throw new Error(outcome.refusal);
      }
      if (options.stopsAfterWriting === true && runs === 1)
        throw new Error('the worker stopped after it wrote');
    },
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
