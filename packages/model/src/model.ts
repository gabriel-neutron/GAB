import { createHash } from 'node:crypto';

import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import {
  AISDKError,
  APICallError,
  generateText,
  tool,
  wrapLanguageModel,
  type LanguageModelMiddleware,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import { z } from 'zod';

import type { Budget } from './budget.ts';
import { failureOf, REASON, sentenceOf, type Failure, type ReasonKind } from './failure.ts';
import { GATEWAY } from './gateway.ts';
import { refusalOf } from './refusal.ts';

// Origin of the numbers: decided, not calibrated. The transport gets one attempt and three retries,
// and a refusal of the boundary gets one retry with the fault. They bound one question only: when
// the chain ends, the job fails at once, outside this adapter.
const NETWORK_RETRIES = 3;
const SHAPE_RETRIES = 1;

const NO_CREDITS = 402;
const BAD_REQUEST = 400;
const TOO_MANY = 429;
const QUOTA = 'quota';
const CONTEXT_FULL = 'context_length_exceeded';

// Node fires a timer above this number at once, so a longer wait is no wait at all.
const LONGEST_WAIT_MS = 2_147_483_647;

// The stable word holds at any status. A provider that gives no stable word names the window in
// the sentence, and only a bad request is read that way: a rate limit must stay a rate limit.
const FULL_SHAPES = ['context length', 'context_length', 'maximum context', 'prompt is too long'];
const RETRY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const SECOND_MS = 1000;

// Every value here is calibrated on real traffic, so no code constant gives one. The bound on the
// wait is required: the service can name a wait longer than the job can hold.
const line = z.object({
  firstWaitMs: z.number().int().positive(),
  waitGrowth: z.number().min(1),
  maxWaitMs: z.number().int().positive().max(LONGEST_WAIT_MS),
  timeoutMs: z.number().int().positive(),
  maxAnswerTokens: z.number().int().positive(),
});

/** How the adapter reaches the model: the waits, the timeout and the longest answer. */
export type ModelLine = z.infer<typeof line>;

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType;
}

/** One tool call of the model, with its input checked by the tool. */
export interface ToolUse {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

/** One message of a conversation. A tool answer names the call that it answers. */
export type Message =
  | { readonly role: 'system' | 'user' | 'assistant'; readonly content: string }
  | { readonly role: 'assistant'; readonly call: ToolUse }
  | { readonly role: 'tool'; readonly call: ToolUse; readonly content: string };

// One budget serves one question at a time. Two questions that share one budget each count the
// tokens of both, and the cap then stops a question that spent little.
export interface Question<T> {
  readonly messages: readonly Message[];
  readonly shape: z.ZodType<T>;
  readonly budget: Budget;
  readonly tools?: readonly Tool[];
}

/** The record of one question. The prompt is kept as a digest only, because it can quote an
 * untrusted document. */
export interface CallRecord {
  readonly requested: string;
  readonly served: string | undefined;
  readonly promptSha256: string;
  readonly latencyMs: number;
  readonly outcome: 'ok' | ReasonKind;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ModelOptions {
  /** Writes the record of one question and gives its identifier. The adapter returns no answer
   * before the record is written, so a proposal that follows can name it. */
  readonly record: (call: CallRecord) => Promise<string>;
  readonly sleep?: (ms: number) => Promise<void>;
  /** The clock in milliseconds, read to time each question. */
  readonly now?: () => number;
}

// `tokens` counts the calls of this question alone, and the budget holds the job total.
// `served` is absent when no answer arrived.
export type Answer<T> = (
  | { readonly ok: true; readonly value: T }
  | { readonly ok: true; readonly call: ToolUse }
  | { readonly ok: false; readonly failure: Failure }
) & {
  readonly callId: string;
  readonly tokens: number;
  readonly served: string | undefined;
};

export interface Model {
  readonly ask: <T>(question: Question<T>) => Promise<Answer<T>>;
}

interface RawCall {
  readonly id: string;
  readonly name: string;
  readonly args: string;
}

interface Said {
  readonly text: string;
  readonly calls: readonly RawCall[];
}

// What one question spends and how many times it reaches the service.
interface Run {
  readonly budget: Budget;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  served: string | undefined;
}

// What the middleware heard in one call, as the gateway sent it.
interface Heard {
  said?: Said;
}

/** A stop that the middleware decides from an answer, before the answer is read. */
class Stopped extends Error {
  readonly kind: ReasonKind;
  readonly detail: string | undefined;

  constructor(kind: ReasonKind, detail?: string) {
    super(kind);
    this.kind = kind;
    this.detail = detail;
  }
}

type Step =
  | { readonly done: 'said'; readonly said: Said }
  | { readonly done: 'stop'; readonly kind: ReasonKind; readonly cause: unknown }
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

type Tried<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: Failure };

// The middleware sees each answer before the library reads it. It counts the tokens first,
// because a refused answer costs tokens too. It judges the served model next: another model made
// the answer, and nothing of it is kept, so no tool runs on it.
const middlewareOf = (pinned: string, run: Run, heard: Heard): LanguageModelMiddleware => ({
  transformParams: ({ params }) => Promise.resolve({ ...params, responseFormat: { type: 'json' } }),
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();
    const input = result.usage.inputTokens.total;
    const output = result.usage.outputTokens.total;
    if (input === undefined && output === undefined)
      console.error('the model answered and gave no token count');
    run.inputTokens += input ?? 0;
    run.outputTokens += output ?? 0;
    run.budget.add((input ?? 0) + (output ?? 0));

    run.served = result.response?.modelId;
    if (run.served !== pinned) throw new Stopped(REASON.servedOther, run.served ?? 'no model');
    if (result.finishReason.unified === 'length') throw new Stopped(REASON.truncated);
    if (result.finishReason.unified === 'content-filter') throw new Stopped(REASON.refused);

    const text = result.content.flatMap((part) => (part.type === 'text' ? [part.text] : []));
    const calls = result.content.flatMap((part) =>
      part.type === 'tool-call'
        ? [{ id: part.toolCallId, name: part.toolName, args: part.input }]
        : [],
    );
    heard.said = { text: text.join(''), calls };
    return result;
  },
});

// The service names the wait in seconds or as a date. An empty header names nothing, and the
// step then takes the wait that grows.
const afterOf = (headers: Readonly<Record<string, string>> | undefined): number | undefined => {
  const header = headers?.['retry-after']?.trim() ?? '';
  if (header === '') return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * SECOND_MS : undefined;

  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(at - Date.now(), 0);
};

const asJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
};

// The adapter tries again only after a fault that time mends. The sentence is read on a bad
// request alone, so a rate limit stays a rate limit, except one that names a spent quota: no wait
// inside one job mends it.
const fromStatus = (error: APICallError, status: number): Step => {
  const text = error.responseBody ?? '';
  const read = asJson(text);
  const { word, said } = refusalOf(read.ok ? read.value : null);
  if (status === NO_CREDITS) return stop(REASON.credits, text);
  if (word === CONTEXT_FULL) return stop(REASON.tooLong, text);
  if (status === BAD_REQUEST && FULL_SHAPES.some((shape) => said.includes(shape)))
    return stop(REASON.tooLong, text);
  if (status === TOO_MANY && (word.includes(QUOTA) || said.includes(QUOTA)))
    return stop(REASON.quota, text);
  if (RETRY_STATUS.has(status)) return again(REASON.network, text, afterOf(error.responseHeaders));
  return stop(REASON.configuration, text);
};

// A fault that this adapter does not know is a fault of the code, and it is thrown.
const stepOf = (cause: unknown): Step => {
  if (cause instanceof Stopped) return stop(cause.kind, cause.detail);
  if (APICallError.isInstance(cause)) {
    const status = cause.statusCode;
    if (status === undefined) return again(REASON.network, sentenceOf(cause));
    if (status < 300) return again(REASON.unreadable, cause.message);
    return fromStatus(cause, status);
  }
  if (cause instanceof Error && ['TimeoutError', 'AbortError'].includes(cause.name))
    return again(REASON.network, cause.message);
  if (AISDKError.isInstance(cause)) return again(REASON.unreadable, cause.message);
  throw cause;
};

const issuesOf = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.map((part) => String(part)).join('.')}: ${issue.message}`)
    .join('; ');

// The boundary wrote the fault, and the model reads it. This is the whole of what the adapter
// says on its own, and every other word of a conversation comes from the caller.
const feedback = (issues: string): string =>
  `The schema refuses the last answer. These are the faults: ${issues}`;

const inputOf = (args: string): unknown => {
  const read = asJson(args.trim() === '' ? '{}' : args);
  return read.ok ? read.value : args;
};

const wireOf = (message: Message): ModelMessage => {
  if (message.role === 'tool')
    return {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: message.call.id,
          toolName: message.call.name,
          output: { type: 'text', value: message.content },
        },
      ],
    };
  if ('call' in message)
    return {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: message.call.id,
          toolName: message.call.name,
          input: message.call.input,
        },
      ],
    };
  return { role: message.role, content: message.content };
};

// A gateway refuses an assistant message with tool calls that has no answer for each call, so a
// bad call is answered on the tool role, one message for each call.
const retryAfter = (said: Said, issues: string): readonly Message[] => {
  if (said.calls.length === 0)
    return [
      { role: 'assistant', content: said.text },
      { role: 'user', content: feedback(issues) },
    ];
  return said.calls.flatMap((raw): Message[] => {
    const call = { id: raw.id, name: raw.name, input: inputOf(raw.args) };
    return [
      { role: 'assistant', call },
      { role: 'tool', call, content: feedback(issues) },
    ];
  });
};

type Judged<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: string };

type Settled<T> =
  { readonly kind: 'value'; readonly value: T } | { readonly kind: 'call'; readonly call: ToolUse };

// The model answers with JSON text, and the shape of the caller judges the value.
const judged = <T>(shape: z.ZodType<T>, text: string): Judged<T> => {
  const read = asJson(text);
  if (!read.ok) return { ok: false, issues: 'the answer is not JSON text' };
  const held = shape.safeParse(read.value);
  return held.success
    ? { ok: true, value: held.data }
    : { ok: false, issues: issuesOf(held.error) };
};

// One tool call per answer, so each call of a job is checked and counted alone.
const judgedCall = (tools: readonly Tool[], calls: readonly RawCall[]): Judged<ToolUse> => {
  const [first, ...more] = calls;
  if (first === undefined) return { ok: false, issues: 'the answer holds no tool call' };
  if (more.length > 0)
    return { ok: false, issues: 'the answer holds more than one tool call. Call one tool' };

  const offered = tools.find((one) => one.name === first.name);
  if (offered === undefined) return { ok: false, issues: `the tool ${first.name} does not exist` };

  const read = asJson(first.args.trim() === '' ? '{}' : first.args);
  if (!read.ok) return { ok: false, issues: 'the arguments are not JSON text' };
  const held = offered.input.safeParse(read.value);
  if (!held.success) return { ok: false, issues: issuesOf(held.error) };
  return { ok: true, value: { id: first.id, name: first.name, input: held.data } };
};

const judgedSaid = <T>(question: Question<T>, said: Said): Judged<Settled<T>> => {
  if (said.calls.length > 0) {
    const call = judgedCall(question.tools ?? [], said.calls);
    return call.ok ? { ok: true, value: { kind: 'call', call: call.value } } : call;
  }
  if (said.text.trim() === '') return { ok: false, issues: 'the answer is empty' };
  const value = judged(question.shape, said.text);
  return value.ok ? { ok: true, value: { kind: 'value', value: value.value } } : value;
};

// The JSON Schema of a tool comes from its Zod input, so the two cannot differ. The adapter
// checks the raw input itself, so a bad call goes back to the model with its fault.
const toolSetOf = (tools: readonly Tool[]): ToolSet =>
  Object.fromEntries(
    tools.map((one) => [one.name, tool({ description: one.description, inputSchema: one.input })]),
  );

/** The one way to reach a model. It takes only a chat model of the free-model gateway, so no
 * call can go to a paid router. */
export const openModel = (
  model: OpenAICompatibleChatLanguageModel,
  given: ModelLine,
  options: ModelOptions,
): Model => {
  if (!(model instanceof OpenAICompatibleChatLanguageModel) || model.provider !== `${GATEWAY}.chat`)
    throw new Error('the adapter takes a model of the free-model gateway only');
  const settings = line.parse(given);
  const pinned = model.modelId;
  const sleep =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((done) => {
        setTimeout(done, ms);
      }));
  const now = options.now ?? (() => performance.now());

  const oneStep = async <T>(
    question: Question<T>,
    messages: readonly Message[],
    run: Run,
  ): Promise<Step | { done: 'spent' }> => {
    // Every call starts here, and the cap stops each one: a test at the door alone stops none of
    // the calls after the first.
    if (run.budget.left() <= 0) return { done: 'spent' };
    run.calls += 1;
    const heard: Heard = {};
    const tools = question.tools ?? [];
    try {
      await generateText({
        model: wrapLanguageModel({ model, middleware: middlewareOf(pinned, run, heard) }),
        messages: messages.map(wireOf),
        allowSystemInMessages: true,
        maxRetries: 0,
        // The library sends no event to a telemetry hook. A prompt can quote an untrusted
        // document, and no reader outside this adapter gets it.
        telemetry: { isEnabled: false },
        maxOutputTokens: settings.maxAnswerTokens,
        abortSignal: AbortSignal.timeout(settings.timeoutMs),
        ...(tools.length > 0 ? { tools: toolSetOf(tools) } : {}),
      });
    } catch (cause) {
      return stepOf(cause);
    }
    const { said } = heard;
    if (said === undefined) return again(REASON.unreadable, 'the library gave no answer');
    if (said.calls.length > 0 && tools.length === 0)
      return again(REASON.unreadable, 'a tool call on a question that offered no tool');
    return { done: 'said', said };
  };

  const waitOf = (afterMs: number | undefined, tried: number): number =>
    Math.min(afterMs ?? settings.firstWaitMs * settings.waitGrowth ** tried, settings.maxWaitMs);

  const roundTrip = async <T>(
    question: Question<T>,
    messages: readonly Message[],
    run: Run,
  ): Promise<Tried<Said>> => {
    let kind: ReasonKind = REASON.network;
    let why = '';
    for (let tried = 0; tried <= NETWORK_RETRIES; tried += 1) {
      const step = await oneStep(question, messages, run);
      if (step.done === 'said') return { ok: true, value: step.said };
      if (step.done === 'spent')
        return { ok: false, failure: failureOf(REASON.overCap, run.calls) };
      if (step.done === 'stop')
        return { ok: false, failure: failureOf(step.kind, run.calls, step.cause) };
      kind = step.kind;
      why = step.why;
      if (tried < NETWORK_RETRIES) await sleep(waitOf(step.afterMs, tried));
    }
    return { ok: false, failure: failureOf(kind, run.calls, why) };
  };

  const attempt = async <T>(
    question: Question<T>,
    run: Run,
    messages: readonly Message[],
    left: number,
  ): Promise<Tried<Settled<T>>> => {
    const raw = await roundTrip(question, messages, run);
    if (!raw.ok) return raw;

    const judgement = judgedSaid(question, raw.value);
    if (judgement.ok) return { ok: true, value: judgement.value };
    if (left === 0) {
      const cause = raw.value.calls.length > 0 ? JSON.stringify(raw.value.calls) : raw.value.text;
      return {
        ok: false,
        failure: failureOf(REASON.rejected, run.calls, cause, judgement.issues),
      };
    }
    return attempt(
      question,
      run,
      [...messages, ...retryAfter(raw.value, judgement.issues)],
      left - 1,
    );
  };

  return {
    ask: async <T>(question: Question<T>): Promise<Answer<T>> => {
      const run: Run = {
        budget: question.budget,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        served: undefined,
      };
      const started = now();
      const got = await attempt(question, run, question.messages, SHAPE_RETRIES);
      const callId = await options.record({
        requested: pinned,
        served: run.served,
        promptSha256: createHash('sha256').update(JSON.stringify(question.messages)).digest('hex'),
        latencyMs: Math.max(0, Math.round(now() - started)),
        outcome: got.ok ? 'ok' : got.failure.kind,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
      });
      const common = { callId, tokens: run.inputTokens + run.outputTokens, served: run.served };
      if (!got.ok) return { ok: false, failure: got.failure, ...common };
      return got.value.kind === 'value'
        ? { ok: true, value: got.value.value, ...common }
        : { ok: true, call: got.value.call, ...common };
    },
  };
};
