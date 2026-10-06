import { z } from 'zod';

import type { Budget } from './budget.ts';
import { completion, refusalOf, tokensOf } from './envelope.ts';
import { failureOf, REASON, sentenceOf, type Failure, type ReasonKind } from './failure.ts';

// Each gateway has one base address and one key variable. The address of freellmapi depends on
// the machine that hosts it, so the environment gives it and no code constant does.
const GATEWAYS = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    baseVar: undefined,
    keyVar: 'OPENROUTER_API_KEY',
  },
  freellmapi: {
    baseUrl: undefined,
    baseVar: 'FREELLMAPI_BASE_URL',
    keyVar: 'FREELLMAPI_API_KEY',
  },
} as const;

const CHAT_PATH = '/chat/completions';

// Origin of the numbers: decided, not calibrated. The transport gets one attempt and three retries,
// and a refusal of the boundary gets one retry with the fault. They bound one question only: when
// the chain ends, the job fails at once, outside this client.
const NETWORK_RETRIES = 3;
const VALIDATION_RETRIES = 1;

const NO_CREDITS = 402;
const BAD_REQUEST = 400;
const TOO_MANY = 429;
const QUOTA = 'quota';
const CONTEXT_FULL = 'context_length_exceeded';
const CUT_AT_LIMIT = 'length';

// Node fires a timer above this number at once, so a longer wait is no wait at all.
const LONGEST_WAIT_MS = 2_147_483_647;

// The stable word holds at any status. A provider that gives no stable word names the window in
// the sentence, and only a bad request is read that way: a rate limit must stay a rate limit.
const FULL_SHAPES = ['context length', 'context_length', 'maximum context', 'prompt is too long'];
const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const SECOND_MS = 1000;

const filled = z.string().trim().min(1);

// Every value here is calibrated on real traffic, so no code constant gives one. The bound on
// the wait is required: the service can name a wait longer than the job can hold.
const settings = z.object({
  endpoint: z.enum(['freellmapi', 'openrouter']),
  // `auto` lets the gateway pick the model for each call, so one job could hold the work of two
  // models. A pinned name is the only name that makes the served model checkable.
  model: z
    .string()
    .trim()
    .min(1)
    .refine((name) => name.toLowerCase() !== 'auto', 'a model is pinned and never `auto`'),
  firstWaitMs: z.number().int().positive(),
  waitGrowth: z.number().min(1),
  maxWaitMs: z.number().int().positive().max(LONGEST_WAIT_MS),
  timeoutMs: z.number().int().positive(),
  maxAnswerTokens: z.number().int().positive(),
});

export type AgentModel = z.infer<typeof settings>;

// The call as the gateway words it. The arguments stay text until a Zod input judges them.
export interface ToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: { readonly name: string; readonly arguments: string };
}

// A gateway answers 400 when an assistant message holds tool calls and a `tool` message for each
// call id does not follow it. The `tool` role carries the fault of a bad call for that reason.
export type Message =
  | { readonly role: 'system' | 'user'; readonly content: string }
  | {
      readonly role: 'assistant';
      readonly content: string;
      readonly tool_calls?: readonly ToolCall[];
    }
  | { readonly role: 'tool'; readonly tool_call_id: string; readonly content: string };

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType;
}

// One budget serves one question at a time. Two questions that share one budget each report the
// tokens of both, and the cap then stops a question that spent little.
export interface Question<T> {
  readonly messages: readonly Message[];
  readonly shape: z.ZodType<T>;
  readonly budget: Budget;
  readonly tools?: readonly Tool[];
}

export interface ToolUse {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

// `tokens` counts the calls of this question alone, and the budget holds the job total, so a
// caller that adds it to the budget counts twice. `served` is absent when no answer arrived. A
// question with tools ends in a value or in one tool call, and `call` tells the two apart.
export type Answer<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly tokens: number;
      readonly served: string | undefined;
    }
  | {
      readonly ok: true;
      readonly call: ToolUse;
      readonly tokens: number;
      readonly served: string | undefined;
    }
  | {
      readonly ok: false;
      readonly failure: Failure;
      readonly tokens: number;
      readonly served: string | undefined;
    };

export type Send = (url: string, init: RequestInit) => Promise<Response>;

export interface Model {
  readonly ask: <T>(question: Question<T>) => Promise<Answer<T>>;
}

// The send function, the key and the agent settings do not change inside one question.
interface Line {
  readonly send: Send;
  readonly key: string;
  readonly url: string;
  readonly agent: AgentModel;
}

// What one question spends and how many times it reaches the service. `attempts` on every
// failure is `calls`, so the number means one thing for every kind.
interface Run {
  readonly budget: Budget;
  calls: number;
  tokens: number;
  served: string | undefined;
}

interface Said {
  readonly text: string;
  readonly calls: readonly ToolCall[];
}

type Step =
  | { readonly done: 'said'; readonly said: Said }
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

type Env = Record<string, string | undefined>;

const keyOf = (env: Env, keyVar: string): string => {
  const read = filled.safeParse(env[keyVar]);
  if (!read.success)
    throw new Error(`${keyVar} is empty or absent. Set it in the environment file.`);
  return read.data;
};

const baseOf = (endpoint: AgentModel['endpoint'], env: Env): string => {
  const gateway = GATEWAYS[endpoint];
  const base = gateway.baseUrl ?? env[gateway.baseVar];
  const read = z.url().safeParse(base?.trim());
  if (!read.success)
    throw new Error(`${String(gateway.baseVar)} is not a URL. Set it in the environment file.`);
  return read.data.replace(/\/+$/u, '');
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

// The JSON Schema of a tool comes from its Zod input, so the two cannot differ.
const wireOf = (tool: Tool): unknown => {
  const { $schema, ...parameters } = z.toJSONSchema(tool.input);
  void $schema;
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters },
  };
};

// The service compresses a prompt that fills the window, and nothing on a screen says so. The
// plugin stays off on every OpenRouter call, and the other gateway has none to name. Each call
// asks for JSON output, because `judged` parses the bare text and not a Markdown fence.
const bodyOf = (agent: AgentModel, messages: readonly Message[], tools: readonly Tool[]): string =>
  JSON.stringify({
    model: agent.model,
    messages,
    max_tokens: agent.maxAnswerTokens,
    response_format: { type: 'json_object' },
    ...(agent.endpoint === 'openrouter'
      ? { plugins: [{ id: 'context-compression', enabled: false }] }
      : {}),
    ...(tools.length > 0 ? { tools: tools.map(wireOf) } : {}),
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

// The client tries again only after a fault that time mends. The sentence is read on a bad
// request alone, so a rate limit stays a rate limit, except one that names a spent quota: no
// wait inside one job mends it.
const fromStatus = (agent: AgentModel, response: Response, body: unknown, text: string): Step => {
  const { word, said } = refusalOf(body);
  if (agent.endpoint === 'openrouter' && response.status === NO_CREDITS)
    return stop(REASON.credits, text);
  if (word === CONTEXT_FULL) return stop(REASON.tooLong, text);
  if (response.status === BAD_REQUEST && FULL_SHAPES.some((shape) => said.includes(shape)))
    return stop(REASON.tooLong, text);
  if (response.status === TOO_MANY && (word.includes(QUOTA) || said.includes(QUOTA)))
    return stop(REASON.quota, text);
  if (RETRY_STATUS.has(response.status)) return again(REASON.network, text, afterOf(response));
  return stop(REASON.configuration, text);
};

const paidFor = (run: Run, tokens: number): void => {
  run.budget.add(tokens);
  run.tokens += tokens;
};

// The client counts the tokens before it reads the answer, because a cut answer costs tokens too.
// The served model is judged next and before the content: another model made the answer, and
// nothing of it is kept.
const fromBody = (
  agent: AgentModel,
  body: unknown,
  run: Run,
  text: string,
  withTools: boolean,
): Step => {
  const read = completion.safeParse(body);
  if (!read.success) {
    // An answer the shape of the service refuses is paid for, and the figure is the one the
    // service gives. A body with no figure gives no count, and the log says so.
    const paid = tokensOf(body);
    if (paid === 0) console.error('the model answered and gave no token count');
    paidFor(run, paid);
    return again(REASON.unreadable, text);
  }

  paidFor(run, read.data.usage.total_tokens);
  run.served = read.data.model ?? undefined;
  if (run.served !== agent.model) return stop(REASON.servedOther, run.served ?? 'no model named');

  const choice = read.data.choices[0];
  if (choice === undefined) return again(REASON.unreadable, text);

  const refusal = choice.message.refusal ?? '';
  if (refusal !== '') return stop(REASON.refused, refusal);
  if (choice.finish_reason === CUT_AT_LIMIT) return stop(REASON.truncated);

  const calls = (choice.message.tool_calls ?? []).map((call): ToolCall => ({
    id: call.id,
    type: 'function',
    function: { name: call.function.name, arguments: call.function.arguments },
  }));
  // A tool call on a question that offered no tool is a body this client cannot place.
  if (calls.length > 0 && !withTools) return again(REASON.unreadable, text);

  const content = choice.message.content ?? '';
  if (content.trim() === '' && calls.length === 0) return again(REASON.unreadable, text);
  return { done: 'said', said: { text: content, calls } };
};

const oneStep = async (
  line: Line,
  messages: readonly Message[],
  tools: readonly Tool[],
  run: Run,
): Promise<Step> => {
  // Every call starts here, and the cap stops each one. One question reaches the service up to
  // eight times, and a test at the door alone stops none of the calls after the first.
  if (run.budget.left() <= 0) return { done: 'spent' };

  run.calls += 1;

  // The call and the reading of the body are the two acts that throw for a fault of the
  // transport. Nothing that counts a token stands inside this guard, so a fault of the count is
  // never reported as a silent fault of the transport.
  let response: Response;
  let text: string;
  try {
    response = await line.send(line.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${line.key}`, 'content-type': 'application/json' },
      body: bodyOf(line.agent, messages, tools),
      signal: AbortSignal.timeout(line.agent.timeoutMs),
    });
    text = await response.text();
  } catch (cause) {
    return again(REASON.network, sentenceOf(cause));
  }

  const read = asJson(text);
  const body = read.ok ? read.value : null;
  return response.ok
    ? fromBody(line.agent, body, run, text, tools.length > 0)
    : fromStatus(line.agent, response, body, text);
};

// The service can name a wait of any length, and a wait longer than the job holds the job. The
// caller gives the growth and the bound, and the client holds neither of its own.
const waitOf = (agent: AgentModel, afterMs: number | undefined, tried: number): number => {
  const asked = afterMs ?? agent.firstWaitMs * agent.waitGrowth ** tried;
  return Math.min(asked, agent.maxWaitMs);
};

// One round trip, and what the model said. The wait grows after each fault, and the service
// can name a longer wait.
const roundTrip = async (
  line: Line,
  messages: readonly Message[],
  tools: readonly Tool[],
  run: Run,
): Promise<Tried<Said>> => {
  let kind: ReasonKind = REASON.network;
  let why = '';
  let tried = 0;

  while (tried <= NETWORK_RETRIES) {
    const step = await oneStep(line, messages, tools, run);
    if (step.done === 'said') return { ok: true, value: step.said };
    if (step.done === 'stop')
      return { ok: false, failure: failureOf(step.kind, run.calls, step.cause) };
    if (step.done === 'spent') return { ok: false, failure: failureOf(REASON.overCap, run.calls) };
    kind = step.kind;
    why = step.why;
    if (tried === NETWORK_RETRIES) break;
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
const feedback = (issues: string): string =>
  `The schema refuses the last answer. These are the faults: ${issues}`;

// A bad tool call is answered on the `tool` role, one message for each call id, and no user
// message follows. A gateway refuses an assistant message with tool calls that has no such reply.
const retryAfter = (said: Said, issues: string): readonly Message[] => {
  if (said.calls.length === 0)
    return [
      { role: 'assistant', content: said.text },
      { role: 'user', content: feedback(issues) },
    ];
  return [
    { role: 'assistant', content: said.text, tool_calls: said.calls },
    ...said.calls.map((call): Message => ({
      role: 'tool',
      tool_call_id: call.id,
      content: feedback(issues),
    })),
  ];
};

type Judged<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: string };

// What a question ends in: the final value of the shape, or one tool call of the model.
type Settled<T> =
  { readonly kind: 'value'; readonly value: T } | { readonly kind: 'call'; readonly call: ToolUse };

// The model answers with JSON text, and the shape of the caller judges the value. A text that is
// not JSON is a fault of the model, and the model reads its own sentence for that fault.
const judged = <T>(shape: z.ZodType<T>, text: string): Judged<T> => {
  const read = asJson(text);
  if (!read.ok) return { ok: false, issues: 'the answer is not JSON text' };

  const held = shape.safeParse(read.value);
  if (!held.success) return { ok: false, issues: issuesOf(held.error) };
  return { ok: true, value: held.data };
};

// One tool call per answer, so each call of a job is checked and counted alone. An empty text for
// the arguments is a call of a tool that takes none.
const judgedCall = (tools: readonly Tool[], calls: readonly ToolCall[]): Judged<ToolUse> => {
  const [first, ...more] = calls;
  if (first === undefined) return { ok: false, issues: 'the answer holds no tool call' };
  if (more.length > 0)
    return { ok: false, issues: 'the answer holds more than one tool call. Call one tool' };

  const { name } = first.function;
  const tool = tools.find((one) => one.name === name);
  if (tool === undefined) return { ok: false, issues: `the tool ${name} does not exist` };

  const given = first.function.arguments.trim();
  const read = asJson(given === '' ? '{}' : given);
  if (!read.ok) return { ok: false, issues: 'the arguments are not JSON text' };

  const held = tool.input.safeParse(read.value);
  if (!held.success) return { ok: false, issues: issuesOf(held.error) };
  return { ok: true, value: { id: first.id, name, input: held.data } };
};

const judgedSaid = <T>(question: Question<T>, said: Said): Judged<Settled<T>> => {
  if (said.calls.length > 0) {
    const call = judgedCall(question.tools ?? [], said.calls);
    return call.ok ? { ok: true, value: { kind: 'call', call: call.value } } : call;
  }
  const value = judged(question.shape, said.text);
  return value.ok ? { ok: true, value: { kind: 'value', value: value.value } } : value;
};

const attempt = async <T>(
  line: Line,
  question: Question<T>,
  run: Run,
  messages: readonly Message[],
  left: number,
): Promise<Tried<Settled<T>>> => {
  const raw = await roundTrip(line, messages, question.tools ?? [], run);
  if (!raw.ok) return raw;

  const judgement = judgedSaid(question, raw.value);
  if (judgement.ok) return { ok: true, value: judgement.value };

  const { issues } = judgement;
  if (left === 0) {
    const cause = raw.value.calls.length > 0 ? JSON.stringify(raw.value.calls) : raw.value.text;
    return { ok: false, failure: failureOf(REASON.rejected, run.calls, cause, issues) };
  }

  return attempt(line, question, run, [...messages, ...retryAfter(raw.value, issues)], left - 1);
};

/** The one way to reach the model. It throws when the key or a setting is bad or absent. */
export const openModel = (given: unknown, send: Send = fetch, env: Env = process.env): Model => {
  const agent = settings.parse(given);
  const key = keyOf(env, GATEWAYS[agent.endpoint].keyVar);
  const base = baseOf(agent.endpoint, env);
  const line: Line = { send, key, url: base + CHAT_PATH, agent };

  return {
    ask: async <T>(question: Question<T>): Promise<Answer<T>> => {
      const run: Run = { budget: question.budget, calls: 0, tokens: 0, served: undefined };
      const got = await attempt(line, question, run, question.messages, VALIDATION_RETRIES);
      const { tokens, served } = run;
      if (!got.ok) return { ok: false, failure: got.failure, tokens, served };
      return got.value.kind === 'value'
        ? { ok: true, value: got.value.value, tokens, served }
        : { ok: true, call: got.value.call, tokens, served };
    },
  };
};
