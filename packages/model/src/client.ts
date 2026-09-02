import { z } from 'zod';

import type { Budget } from './budget.ts';
import { completion, refusalOf, tokensOf } from './envelope.ts';
import { failureOf, REASON, sentenceOf, type Failure, type ReasonKind } from './failure.ts';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// One attempt and three retries answer a fault of the transport. One retry answers a refusal of
// the boundary, and that retry carries the fault of the shape back to the model.
const NETWORK_RETRIES = 3;
const VALIDATION_RETRIES = 1;

const NO_CREDITS = 402;
const CONTEXT_FULL = 'context_length_exceeded';
const CUT_AT_LIMIT = 'length';

// The stable word is the first test. A provider that gives no stable word names the full window
// in the sentence. The client reads the sentence too, or the operator looks in the wrong place.
const FULL_SHAPES = ['context length', 'context_length', 'maximum context', 'prompt is too long'];
const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const SECOND_MS = 1000;

const secrets = z.object({ OPENROUTER_API_KEY: z.string().trim().min(1) });

// The model, the waits, the deadline and the answer limit are configuration, one set per agent.
// The longest wait is configuration too, and it is absent until the operator measures one.
// No code constant names a model, and no code constant bounds a wait or an answer.
const settings = z.object({
  model: z.string().trim().min(1),
  firstWaitMs: z.number().int().nonnegative(),
  maxWaitMs: z.number().int().positive().optional(),
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

// `tokens` counts every round trip of one question, and a question that stops counts too. The
// budget holds the same figure already. A caller that adds this number to the same budget
// counts one question twice.
export type Answer<T> =
  | { readonly ok: true; readonly value: T; readonly tokens: number }
  | { readonly ok: false; readonly failure: Failure; readonly tokens: number };

export type Send = (url: string, init: RequestInit) => Promise<Response>;

export interface Model {
  readonly ask: <T>(question: Question<T>) => Promise<Answer<T>>;
}

// The send function, the key and the agent settings do not change inside one question.
interface Line {
  readonly send: Send;
  readonly key: string;
  readonly agent: AgentModel;
}

type Step =
  | { readonly done: 'said'; readonly text: string }
  | { readonly done: 'stop'; readonly kind: ReasonKind; readonly cause: unknown }
  | { readonly done: 'spent' }
  | { readonly done: 'again'; readonly afterMs: number | undefined; readonly why: string };

// A step that stops names the kind and the cause of the stop. The loop counts the attempts, so
// no step carries a number that it cannot know.
const stop = (kind: ReasonKind, cause?: unknown): Step => ({ done: 'stop', kind, cause });
const again = (why: string, afterMs?: number): Step => ({ done: 'again', afterMs, why });

// The count of one question belongs to the one function that sees the whole question. `attempt`
// calls itself, so it gives the value alone.
type Tried<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: Failure };

const keyOf = (env: Record<string, string | undefined>): string => {
  const held = secrets.safeParse(env);
  if (!held.success)
    throw new Error('OPENROUTER_API_KEY is empty or absent. Set it in the environment file.');
  return held.data.OPENROUTER_API_KEY;
};

// A text that is not JSON and the JSON value `null` are two answers. One `null` for both hides
// the fault from every shape that takes a null value.
type Read = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

const asJson = (text: string): Read => {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
};

const wait = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

// The service compresses a prompt that fills the window. A compressed prompt is a document read
// in part, and nothing on a screen says so. The plugin stays off on every call.
const bodyOf = (agent: AgentModel, messages: readonly Message[], limit: number): string =>
  JSON.stringify({
    model: agent.model,
    messages,
    max_tokens: limit,
    plugins: [{ id: 'context-compression', enabled: false }],
  });

// The service names the wait in seconds or as a date. An empty header names nothing, and the
// step then takes the wait that grows.
const afterOf = (response: Response): number | undefined => {
  const header = response.headers.get('retry-after')?.trim() ?? '';
  if (header === '') return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * SECOND_MS : undefined;

  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(at - Date.now(), 0);
};

// The status names the kind of refusal. The client tries again only after a fault that time mends.
const fromStatus = (response: Response, body: unknown, text: string): Step => {
  const { word, said } = refusalOf(body);
  if (response.status === NO_CREDITS) return stop(REASON.credits, text);
  if (word === CONTEXT_FULL || FULL_SHAPES.some((shape) => said.includes(shape)))
    return stop(REASON.tooLong, text);
  if (RETRY_STATUS.has(response.status)) return again(text, afterOf(response));
  return stop(REASON.configuration, text);
};

// An answer the shape of the service refuses is paid for, and the figure is the one the service
// gives. This code makes no estimate. A body with no figure gives no count, and the log says so.
const countPaid = (body: unknown, budget: Budget): void => {
  const tokens = tokensOf(body);
  if (tokens === 0) console.error('the model answered and gave no token count');
  budget.add(tokens);
};

// The client counts the tokens before it reads the answer, because a cut answer costs tokens too.
const fromBody = (body: unknown, budget: Budget, text: string): Step => {
  const held = completion.safeParse(body);
  if (!held.success) {
    countPaid(body, budget);
    return again(text);
  }

  budget.add(held.data.usage.total_tokens);
  const choice = held.data.choices[0];
  if (choice === undefined) return again(text);

  const refusal = choice.message.refusal ?? '';
  if (refusal !== '') return stop(REASON.refused, refusal);
  if (choice.finish_reason === CUT_AT_LIMIT) return stop(REASON.truncated);

  const content = choice.message.content ?? '';
  if (content.trim() === '') return again(text);
  return { done: 'said', text: content };
};

const oneStep = async (line: Line, messages: readonly Message[], budget: Budget): Promise<Step> => {
  const { send, key, agent } = line;

  // Every call to the service starts here, and the cap stops each one. One test before the first
  // call does not stop the calls that follow it, because one question makes many calls.
  if (budget.left() === 0) return { done: 'spent' };
  const limit = Math.min(agent.maxAnswerTokens, budget.left());

  try {
    const response = await send(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: bodyOf(agent, messages, limit),
      signal: AbortSignal.timeout(agent.timeoutMs),
    });
    const text = await response.text();
    const read = asJson(text);
    const body = read.ok ? read.value : null;
    return response.ok ? fromBody(body, budget, text) : fromStatus(response, body, text);
  } catch (cause) {
    return again(sentenceOf(cause));
  }
};

// The service can name a wait of any length, and a wait longer than the job holds the job. The
// caller gives the bound, and the client bounds nothing on its own.
const waitOf = (agent: AgentModel, afterMs: number | undefined, tried: number): number => {
  const asked = afterMs ?? agent.firstWaitMs * 2 ** tried;
  return agent.maxWaitMs === undefined ? asked : Math.min(asked, agent.maxWaitMs);
};

// One round trip, and the text the model said. The wait grows after each fault, and the service
// can name a longer wait.
const roundTrip = async (
  line: Line,
  messages: readonly Message[],
  budget: Budget,
): Promise<Tried<string>> => {
  let why = '';
  let tried = 0;

  while (tried <= NETWORK_RETRIES) {
    const step = await oneStep(line, messages, budget);
    if (step.done === 'said') return { ok: true, value: step.text };
    if (step.done === 'stop')
      return { ok: false, failure: failureOf(step.kind, tried + 1, step.cause) };
    if (step.done === 'spent') return { ok: false, failure: failureOf(REASON.overCap, tried) };
    why = step.why;
    if (tried < NETWORK_RETRIES) await wait(waitOf(line.agent, step.afterMs, tried));
    tried += 1;
  }

  return { ok: false, failure: failureOf(REASON.network, tried, why) };
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

type Judged<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: string };

// The model answers with JSON text, and the shape of the caller judges the value. A text that is
// not JSON is a fault of the model, and the model reads its own sentence for that fault.
const judged = <T>(shape: z.ZodType<T>, text: string): Judged<T> => {
  const read = asJson(text);
  if (!read.ok) return { ok: false, issues: 'the answer is not JSON text' };

  const held = shape.safeParse(read.value);
  if (!held.success) return { ok: false, issues: issuesOf(held.error) };
  return { ok: true, value: held.data };
};

const attempt = async <T>(
  line: Line,
  question: Question<T>,
  messages: readonly Message[],
  left: number,
): Promise<Tried<T>> => {
  const raw = await roundTrip(line, messages, question.budget);
  if (!raw.ok) return raw;

  const judgement = judged(question.shape, raw.value);
  if (judgement.ok) return { ok: true, value: judgement.value };

  const { issues } = judgement;
  if (left === 0)
    return {
      ok: false,
      failure: failureOf(REASON.rejected, VALIDATION_RETRIES + 1, raw.value, issues),
    };

  const said: Message = { role: 'assistant', content: raw.value };
  return attempt(line, question, [...messages, said, ...feedback(issues)], left - 1);
};

/** The one way to reach the model. It throws when the key is empty or absent. */
export const openModel = (given: AgentModel, send: Send = fetch, env = process.env): Model => {
  const agent = settings.parse(given);
  const key = keyOf(env);
  const line: Line = { send, key, agent };

  return {
    // The tokens of an answer are the tokens of the whole question. A retry makes a second call,
    // and the caller pays for both calls.
    ask: async <T>(question: Question<T>): Promise<Answer<T>> => {
      const before = question.budget.spent();
      const got = await attempt(line, question, question.messages, VALIDATION_RETRIES);
      const tokens = question.budget.spent() - before;
      return got.ok
        ? { ok: true, value: got.value, tokens }
        : { ok: false, failure: got.failure, tokens };
    },
  };
};
