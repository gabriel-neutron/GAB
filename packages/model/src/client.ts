import { z } from 'zod';

import type { Budget } from './budget.ts';
import { completion, refusalOf } from './envelope.ts';
import { failureOf, sentenceOf, type Failure } from './failure.ts';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// One attempt and three retries answer a fault of the transport. One retry answers an answer
// the boundary refuses, and that retry carries the validation fault back to the model.
const NETWORK_RETRIES = 3;
const VALIDATION_RETRIES = 1;

const NO_CREDITS = 402;
const CONTEXT_FULL = 'context_length_exceeded';
const CUT_AT_LIMIT = 'length';

// The stable word above is the first test. A provider that gives no word still says it in the
// sentence, and a refusal read wrong sends the operator to look at the wrong thing.
const FULL_SHAPES = ['context length', 'context_length', 'maximum context', 'prompt is too long'];
const AGAIN = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const SECOND_MS = 1000;

const secrets = z.object({ OPENROUTER_API_KEY: z.string().trim().min(1) });

// The model, the first wait, the deadline and the answer limit are configuration, one set per
// agent. No code constant names a model, and no code constant bounds an answer.
const settings = z.object({
  model: z.string().trim().min(1),
  firstWaitMs: z.number().int().nonnegative(),
  timeoutMs: z.number().int().positive(),
  maxAnswerTokens: z.number().int().positive(),
});

export type AgentModel = z.infer<typeof settings>;

export interface Message {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface Question<T> {
  readonly messages: readonly Message[];
  readonly shape: z.ZodType<T>;
  readonly budget: Budget;
}

export type Answer<T> =
  | { readonly ok: true; readonly value: T; readonly tokens: number }
  | { readonly ok: false; readonly failure: Failure };

export type Send = (url: string, init: RequestInit) => Promise<Response>;

export interface Model {
  readonly ask: <T>(question: Question<T>) => Promise<Answer<T>>;
}

interface Said {
  readonly text: string;
  readonly tokens: number;
}

type Step =
  | { readonly done: 'said'; readonly said: Said }
  | { readonly done: 'stop'; readonly failure: Failure }
  | { readonly done: 'again'; readonly afterMs: number | undefined; readonly why: string };

type Got =
  { readonly ok: true; readonly said: Said } | { readonly ok: false; readonly failure: Failure };

const keyOf = (env: Record<string, string | undefined>): string => {
  const held = secrets.safeParse(env);
  if (!held.success)
    throw new Error('OPENROUTER_API_KEY is empty or absent. Set it in the environment file.');
  return held.data.OPENROUTER_API_KEY;
};

const asJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const wait = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

// The service compresses a prompt that fills the window, and a compressed prompt is a document
// read in part with nothing on a screen that says so. The plugin stays off on every call.
const bodyOf = (agent: AgentModel, messages: readonly Message[], limit: number): string =>
  JSON.stringify({
    model: agent.model,
    messages,
    max_tokens: limit,
    plugins: [{ id: 'context-compression', enabled: false }],
  });

const afterOf = (response: Response): number | undefined => {
  const header = response.headers.get('retry-after');
  const seconds = Number(header ?? '');
  return header !== null && Number.isFinite(seconds) && seconds >= 0
    ? seconds * SECOND_MS
    : undefined;
};

// A refusal of the service, read by its status. Only a fault that time can mend is tried again.
const fromStatus = (response: Response, body: unknown, text: string): Step => {
  const { word, said } = refusalOf(body);
  if (response.status === NO_CREDITS)
    return { done: 'stop', failure: failureOf('credits', 1, text) };
  if (word === CONTEXT_FULL || FULL_SHAPES.some((shape) => said.includes(shape)))
    return { done: 'stop', failure: failureOf('too_long', 1, text) };
  if (AGAIN.has(response.status)) return { done: 'again', afterMs: afterOf(response), why: text };
  return { done: 'stop', failure: failureOf('configuration', 1, text) };
};

// The tokens are counted before the answer is judged, because a cut answer is paid for too.
const fromBody = (body: unknown, budget: Budget, text: string): Step => {
  const held = completion.safeParse(body);
  if (!held.success) return { done: 'again', afterMs: undefined, why: text };

  budget.add(held.data.usage.total_tokens);
  const choice = held.data.choices[0];
  if (choice === undefined) return { done: 'again', afterMs: undefined, why: text };

  const refusal = choice.message.refusal ?? '';
  if (refusal !== '') return { done: 'stop', failure: failureOf('refused', 1, refusal) };
  if (choice.finish_reason === CUT_AT_LIMIT)
    return { done: 'stop', failure: failureOf('truncated', 1) };

  const content = choice.message.content ?? '';
  if (content.trim() === '') return { done: 'again', afterMs: undefined, why: text };
  return { done: 'said', said: { text: content, tokens: held.data.usage.total_tokens } };
};

const oneStep = async (
  send: Send,
  key: string,
  agent: AgentModel,
  messages: readonly Message[],
  budget: Budget,
): Promise<Step> => {
  const limit = Math.min(agent.maxAnswerTokens, budget.left());

  try {
    const response = await send(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: bodyOf(agent, messages, limit),
      signal: AbortSignal.timeout(agent.timeoutMs),
    });
    const text = await response.text();
    const body = asJson(text);
    return response.ok ? fromBody(body, budget, text) : fromStatus(response, body, text);
  } catch (cause) {
    return { done: 'again', afterMs: undefined, why: sentenceOf(cause) };
  }
};

// One round trip. The wait doubles on each retry, and the service can name a longer one.
const roundTrip = async (
  send: Send,
  key: string,
  agent: AgentModel,
  messages: readonly Message[],
  budget: Budget,
): Promise<Got> => {
  let why = '';
  let tried = 0;

  while (tried <= NETWORK_RETRIES) {
    const step = await oneStep(send, key, agent, messages, budget);
    if (step.done === 'said') return { ok: true, said: step.said };
    if (step.done === 'stop')
      return { ok: false, failure: { ...step.failure, attempts: tried + 1 } };
    why = step.why;
    if (tried < NETWORK_RETRIES) await wait(step.afterMs ?? agent.firstWaitMs * 2 ** tried);
    tried += 1;
  }

  return { ok: false, failure: failureOf('network', tried, why) };
};

const issuesOf = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.map((part) => String(part)).join('.')}: ${issue.message}`)
    .join('; ');

// The fault goes back to the model as the boundary wrote it. This is the whole of what the
// client says on its own, and every other word of a conversation comes from the caller.
const feedback = (issues: string): readonly Message[] => [
  { role: 'user', content: `Your last answer was refused by the schema: ${issues}` },
];

const attempt = async <T>(
  send: Send,
  key: string,
  agent: AgentModel,
  question: Question<T>,
  messages: readonly Message[],
  left: number,
): Promise<Answer<T>> => {
  const got = await roundTrip(send, key, agent, messages, question.budget);
  if (!got.ok) return { ok: false, failure: got.failure };

  const held = question.shape.safeParse(asJson(got.said.text));
  if (held.success) return { ok: true, value: held.data, tokens: got.said.tokens };

  const issues = issuesOf(held.error);
  if (left === 0)
    return { ok: false, failure: failureOf('rejected', VALIDATION_RETRIES + 1, undefined, issues) };

  const said: Message = { role: 'assistant', content: got.said.text };
  return attempt(send, key, agent, question, [...messages, said, ...feedback(issues)], left - 1);
};

/** The one way to reach the model. It throws when the key is empty or absent. */
export const openModel = (given: AgentModel, send: Send = fetch, env = process.env): Model => {
  const agent = settings.parse(given);
  const key = keyOf(env);

  return {
    ask: async <T>(question: Question<T>): Promise<Answer<T>> => {
      if (question.budget.left() === 0) return { ok: false, failure: failureOf('over_cap', 0) };
      return attempt(send, key, agent, question, question.messages, VALIDATION_RETRIES);
    },
  };
};
