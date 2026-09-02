import { z } from 'zod';

import type { Budget } from './budget.ts';
import { completion, refusalOf, tokensOf } from './envelope.ts';
import { failureOf, REASON, sentenceOf, type Failure, type ReasonKind } from './failure.ts';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Both counts are decided and neither is calibrated. The transport gets one attempt and three
// retries. A refusal of the boundary gets one retry, and that retry carries the fault back.
const NETWORK_RETRIES = 3;
const VALIDATION_RETRIES = 1;

const NO_CREDITS = 402;
const BAD_REQUEST = 400;
const CONTEXT_FULL = 'context_length_exceeded';
const CUT_AT_LIMIT = 'length';

// Node fires a timer above this number at once, so a longer wait is no wait at all.
const LONGEST_WAIT_MS = 2_147_483_647;

// The stable word holds at any status. A provider that gives no stable word names the window in
// the sentence, and only a bad request is read that way: a rate limit must stay a rate limit.
const FULL_SHAPES = ['context length', 'context_length', 'maximum context', 'prompt is too long'];
const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const SECOND_MS = 1000;

const secrets = z.object({ OPENROUTER_API_KEY: z.string().trim().min(1) });

// Every value here is calibrated on real traffic, so no code constant gives one. The three
// optional values stay absent until the operator measures them.
const settings = z.object({
  model: z.string().trim().min(1),
  firstWaitMs: z.number().int().positive(),
  waitGrowth: z.number().min(1),
  maxWaitMs: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive(),
  deadlineMs: z.number().int().positive().optional(),
  maxAnswerTokens: z.number().int().positive(),
  minCallTokens: z.number().int().positive().optional(),
});

export type AgentModel = z.infer<typeof settings>;

export interface Message {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

// One budget serves one question at a time. Two questions that share one budget each report the
// tokens of both, and the cap then stops a question that spent little.
export interface Question<T> {
  readonly messages: readonly Message[];
  readonly shape: z.ZodType<T>;
  readonly budget: Budget;
}

// `tokens` counts the calls of this question alone, and a question that stops counts too. The
// budget holds the total of the job, so a caller that adds this number to it counts twice.
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

// What one question spends, how many times it reaches the service, and when it starts no more
// calls. `attempts` on every failure is `calls`, so the number means one thing for every kind.
interface Run {
  readonly budget: Budget;
  readonly until: number | undefined;
  calls: number;
  tokens: number;
}

type Step =
  | { readonly done: 'said'; readonly text: string }
  | { readonly done: 'stop'; readonly kind: ReasonKind; readonly cause: unknown }
  | { readonly done: 'spent' }
  | {
      readonly done: 'again';
      readonly kind: ReasonKind;
      readonly afterMs: number | undefined;
      readonly why: string;
    };

const stop = (kind: ReasonKind, cause?: unknown): Step => ({ done: 'stop', kind, cause });

// A step that asks again names the kind it becomes when no retry is left. A transport that did
// not answer and an answer nobody can read are two faults, and they take two sentences.
const again = (kind: ReasonKind, why: string, afterMs?: number): Step => ({
  done: 'again',
  kind,
  afterMs,
  why,
});

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
const bodyOf = (agent: AgentModel, messages: readonly Message[]): string =>
  JSON.stringify({
    model: agent.model,
    messages,
    max_tokens: agent.maxAnswerTokens,
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

// The status names the kind of refusal, and the client tries again only after a fault that time
// mends. The sentence is read on a bad request alone, so a rate limit stays a rate limit.
const fromStatus = (response: Response, body: unknown, text: string): Step => {
  const { word, said } = refusalOf(body);
  if (response.status === NO_CREDITS) return stop(REASON.credits, text);
  if (word === CONTEXT_FULL) return stop(REASON.tooLong, text);
  if (response.status === BAD_REQUEST && FULL_SHAPES.some((shape) => said.includes(shape)))
    return stop(REASON.tooLong, text);
  if (RETRY_STATUS.has(response.status)) return again(REASON.network, text, afterOf(response));
  return stop(REASON.configuration, text);
};

const paidFor = (run: Run, tokens: number): void => {
  run.budget.add(tokens);
  run.tokens += tokens;
};

// An answer the shape of the service refuses is paid for, and the figure is the one the service
// gives. This code makes no estimate. A body with no figure gives no count, and the log says so.
const countPaid = (body: unknown, run: Run): void => {
  const tokens = tokensOf(body);
  if (tokens === 0) console.error('the model answered and gave no token count');
  paidFor(run, tokens);
};

// The client counts the tokens before it reads the answer, because a cut answer costs tokens too.
const fromBody = (body: unknown, run: Run, text: string): Step => {
  const held = completion.safeParse(body);
  if (!held.success) {
    countPaid(body, run);
    return again(REASON.unreadable, text);
  }

  paidFor(run, held.data.usage.total_tokens);
  const choice = held.data.choices[0];
  if (choice === undefined) return again(REASON.unreadable, text);

  const refusal = choice.message.refusal ?? '';
  if (refusal !== '') return stop(REASON.refused, refusal);
  if (choice.finish_reason === CUT_AT_LIMIT) return stop(REASON.truncated);

  const content = choice.message.content ?? '';
  if (content.trim() === '') return again(REASON.unreadable, text);
  return { done: 'said', text: content };
};

type Fetched =
  | { readonly ok: true; readonly response: Response; readonly text: string }
  | { readonly ok: false; readonly why: string };

// The call and the reading of the body are the two acts that throw for a fault of the transport.
// Nothing that counts a token stands inside this guard, so a fault of the count is never hidden.
const fetched = async (line: Line, messages: readonly Message[]): Promise<Fetched> => {
  try {
    const response = await line.send(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${line.key}`, 'content-type': 'application/json' },
      body: bodyOf(line.agent, messages),
      signal: AbortSignal.timeout(line.agent.timeoutMs),
    });
    return { ok: true, response, text: await response.text() };
  } catch (cause) {
    return { ok: false, why: sentenceOf(cause) };
  }
};

const oneStep = async (line: Line, messages: readonly Message[], run: Run): Promise<Step> => {
  // Every call starts here, and the cap stops each one. The floor is what the caller says a call
  // is worth: a call the cap cannot pay for comes back cut, and a cut answer buys nothing.
  const floor = line.agent.minCallTokens ?? 1;
  if (run.budget.left() < floor) return { done: 'spent' };

  run.calls += 1;
  const got = await fetched(line, messages);
  if (!got.ok) return again(REASON.network, got.why);

  const read = asJson(got.text);
  const body = read.ok ? read.value : null;
  return got.response.ok ? fromBody(body, run, got.text) : fromStatus(got.response, body, got.text);
};

// The service can name a wait of any length, and a wait longer than the job holds the job. The
// caller gives the growth and the bound, and the client holds neither of its own.
const waitOf = (agent: AgentModel, afterMs: number | undefined, tried: number): number => {
  const asked = afterMs ?? agent.firstWaitMs * agent.waitGrowth ** tried;
  return Math.min(asked, agent.maxWaitMs ?? LONGEST_WAIT_MS, LONGEST_WAIT_MS);
};

// A question stops between two calls and never inside one, so every question reaches the service
// at least once. A deadline that has passed already does not cancel the first call.
const outOfTime = (run: Run): boolean => run.until !== undefined && Date.now() >= run.until;

// One round trip, and the text the model said. The wait grows after each fault, and the service
// can name a longer wait.
const roundTrip = async (
  line: Line,
  messages: readonly Message[],
  run: Run,
): Promise<Tried<string>> => {
  let kind: ReasonKind = REASON.network;
  let why = '';
  let tried = 0;

  while (tried <= NETWORK_RETRIES) {
    const step = await oneStep(line, messages, run);
    if (step.done === 'said') return { ok: true, value: step.text };
    if (step.done === 'stop')
      return { ok: false, failure: failureOf(step.kind, run.calls, step.cause) };
    if (step.done === 'spent') return { ok: false, failure: failureOf(REASON.overCap, run.calls) };
    kind = step.kind;
    why = step.why;
    if (tried === NETWORK_RETRIES || outOfTime(run)) break;
    await wait(waitOf(line.agent, step.afterMs, tried));
    tried += 1;
  }

  return { ok: false, failure: failureOf(kind, run.calls, why) };
};

const issuesOf = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.map((part) => String(part)).join('.')}: ${issue.message}`)
    .join('; ');

// The boundary wrote the fault, and the model reads it. This is the whole of what the client
// says on its own, and every other word of a conversation comes from the caller.
const feedback = (issues: string): readonly Message[] => [
  { role: 'user', content: `The schema refuses the last answer. These are the faults: ${issues}` },
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
  run: Run,
  messages: readonly Message[],
  left: number,
): Promise<Tried<T>> => {
  const raw = await roundTrip(line, messages, run);
  if (!raw.ok) return raw;

  const judgement = judged(question.shape, raw.value);
  if (judgement.ok) return { ok: true, value: judgement.value };

  const { issues } = judgement;
  if (left === 0 || outOfTime(run))
    return { ok: false, failure: failureOf(REASON.rejected, run.calls, raw.value, issues) };

  const said: Message = { role: 'assistant', content: raw.value };
  return attempt(line, question, run, [...messages, said, ...feedback(issues)], left - 1);
};

/** The one way to reach the model. It throws when the key is empty or absent. */
export const openModel = (given: AgentModel, send: Send = fetch, env = process.env): Model => {
  const agent = settings.parse(given);
  const key = keyOf(env);
  const line: Line = { send, key, agent };

  return {
    ask: async <T>(question: Question<T>): Promise<Answer<T>> => {
      const until = agent.deadlineMs === undefined ? undefined : Date.now() + agent.deadlineMs;
      const run: Run = { budget: question.budget, until, calls: 0, tokens: 0 };
      const got = await attempt(line, question, run, question.messages, VALIDATION_RETRIES);
      return got.ok
        ? { ok: true, value: got.value, tokens: run.tokens }
        : { ok: false, failure: got.failure, tokens: run.tokens };
    },
  };
};
