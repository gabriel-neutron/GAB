import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { openBudget } from './budget.ts';
import {
  openModel,
  worstQuestionMs,
  type AgentModel,
  type Message,
  type Send,
  type Tool,
} from './client.ts';

const AGENT: AgentModel = {
  endpoint: 'openrouter',
  model: 'a-family/a-model',
  firstWaitMs: 1,
  waitGrowth: 2,
  maxWaitMs: 10_000,
  timeoutMs: 1000,
  maxAnswerTokens: 500,
};

// A wait of one millisecond hides the growth of the wait. Every test of a wait uses this agent.
const PATIENT: AgentModel = { ...AGENT, firstWaitMs: 100 };
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const ENV = { OPENROUTER_API_KEY: 'a-key' };
const FREE_BASE = 'http://100.64.0.1:4001/v1';
const FREE_ENV = { FREELLMAPI_API_KEY: 'a-free-key', FREELLMAPI_BASE_URL: FREE_BASE };
const FREE: AgentModel = { ...AGENT, endpoint: 'freellmapi' };
const SHAPE = z.object({ claim: z.string() });

type Stub = ReturnType<typeof vi.fn<Send>>;

const said = (content: string, finish = 'stop', total = 12, model = AGENT.model): string =>
  JSON.stringify({
    model,
    choices: [{ message: { role: 'assistant', content }, finish_reason: finish }],
    usage: { prompt_tokens: total - 2, completion_tokens: 2, total_tokens: total },
  });

const answer = (body: string, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(body, { status, headers });

const called = (calls: readonly [string, string, string][], model = AGENT.model): string =>
  JSON.stringify({
    model,
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: calls.map(([id, name, args]) => ({
            id,
            type: 'function',
            function: { name, arguments: args },
          })),
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  });

const refusalBody = (word: string): string =>
  JSON.stringify({ error: { message: 'no', metadata: { error_type: word } } });

const always = (body: string, status = 200, headers: Record<string, string> = {}): Stub =>
  vi.fn<Send>(() => Promise.resolve(answer(body, status, headers)));

const GO: readonly Message[] = [{ role: 'user', content: 'go' }];

const sent = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
});

const bodiesOf = (send: Stub): unknown[] =>
  send.mock.calls.map(([, init]): unknown =>
    JSON.parse(typeof init.body === 'string' ? init.body : ''),
  );

const ask = (send: Stub, cap = 1000, agent: AgentModel = AGENT, tools?: readonly Tool[]) => {
  const budget = openBudget(cap);
  const model = openModel(agent, send, agent.endpoint === 'openrouter' ? ENV : FREE_ENV);
  return {
    budget,
    run: () =>
      model.ask({ messages: GO, shape: SHAPE, budget, ...(tools === undefined ? {} : { tools }) }),
  };
};

const LOOK: Tool = {
  name: 'look_up',
  description: 'Look a name up.',
  input: z.object({ name: z.string() }),
};

const silenced = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);
let logged: ReturnType<typeof silenced>;

beforeEach(() => {
  logged = silenced();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('a good answer', () => {
  it('gives the parsed value and counts the tokens', async () => {
    const send = always(said('{"claim":"a ship"}'));
    const { budget, run } = ask(send);
    const got = await run();

    expect(got).toEqual({
      ok: true,
      value: { claim: 'a ship' },
      tokens: 12,
      served: AGENT.model,
    });
    expect(budget.spent()).toBe(12);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps the compression plugin off, so a long document is never cut in silence', async () => {
    const send = always(said('{"claim":"a ship"}'));
    await ask(send).run();

    expect(bodiesOf(send)[0]).toMatchObject({
      model: AGENT.model,
      plugins: [{ id: 'context-compression', enabled: false }],
    });
  });

  it('asks for the whole answer limit, because the cap counts a prompt and an answer', async () => {
    const send = always(said('{"claim":"a ship"}'));
    await ask(send, 40).run();

    expect(bodiesOf(send)[0]).toMatchObject({ max_tokens: AGENT.maxAnswerTokens });
  });

  it('asks the service for JSON output, so the model gives no answer in a fence', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    await ask(send).run();

    const json = { response_format: { type: 'json_object' } };
    expect(bodiesOf(send)).toEqual([expect.objectContaining(json), expect.objectContaining(json)]);
  });

  it('keeps the compression plugin off on the retry too', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    await ask(send).run();

    const off = { model: AGENT.model, plugins: [{ id: 'context-compression', enabled: false }] };
    expect(bodiesOf(send)).toEqual([expect.objectContaining(off), expect.objectContaining(off)]);
  });
});

describe('the network fails', () => {
  it('tries once and retries three times, then fails with nothing written', async () => {
    const send = vi.fn<Send>(() => Promise.reject(new Error('socket closed')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(4);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'network', attempts: 4 } });
  });

  it('retries a status that time can mend', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer('{}', 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: true });
  });

  it('waits longer after each fault of the transport', async () => {
    vi.useFakeTimers();
    const send = vi.fn<Send>(() => Promise.reject(new Error('socket closed')));
    const got = ask(send, 1000, PATIENT).run();

    await vi.advanceTimersByTimeAsync(99);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(199);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(399);
    expect(send).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(4);
    await expect(got).resolves.toMatchObject({ ok: false, failure: { kind: 'network' } });
  });

  it('waits the time the service names, and never a shorter time', async () => {
    vi.useFakeTimers();
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer('{}', 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = ask(send, 1000, PATIENT).run();

    await vi.advanceTimersByTimeAsync(1999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await expect(got).resolves.toMatchObject({ ok: true });
  });

  it('retries an answer that does not agree with the shape of the service', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer('{"choices":[]}'))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: true });
  });

  it('counts an answer the shape of the service refuses, because it is paid for', async () => {
    const body = JSON.stringify({
      choices: [],
      usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 },
    });
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(body))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const { budget, run } = ask(send);
    const got = await run();

    expect(got).toMatchObject({ ok: true });
    expect(budget.spent()).toBe(22);
  });

  it('never keeps an empty answer, and asks again', async () => {
    const send = always(said(''));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(4);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'unreadable', attempts: 4 } });
  });

  it('never says the service did not answer when the service answered', async () => {
    const paid = { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 };
    const send = always(JSON.stringify({ choices: [], usage: paid }));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(4);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'unreadable', attempts: 4 } });
  });

  it('retries a rate limit whose sentence names the window, and never reads it as too long', async () => {
    const body = JSON.stringify({ error: { message: 'maximum context reached, slow down' } });
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(body, 429))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: true });
  });

  it('takes the growth of the wait from the caller, and holds no growth of its own', async () => {
    vi.useFakeTimers();
    const send = vi.fn<Send>(() => Promise.reject(new Error('socket closed')));
    const got = ask(send, 1000, { ...PATIENT, waitGrowth: 1 }).run();

    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(4);
    await expect(got).resolves.toMatchObject({ ok: false, failure: { kind: 'network' } });
  });

  it('never waits longer than the bound the caller gives', async () => {
    vi.useFakeTimers();
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer('{}', 429, { 'retry-after': '3600' }))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = ask(send, 1000, { ...PATIENT, maxWaitMs: 5 }).run();

    await vi.advanceTimersByTimeAsync(4);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await expect(got).resolves.toMatchObject({ ok: true });
  });

  it('waits until the date the service names', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer('{}', 429, { 'retry-after': 'Thu, 01 Jan 2026 00:00:02 GMT' }))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = ask(send, 1000, PATIENT).run();

    await vi.advanceTimersByTimeAsync(1999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await expect(got).resolves.toMatchObject({ ok: true });
  });

  it('takes the wait that grows when the service names a negative wait', async () => {
    vi.useFakeTimers();
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer('{}', 429, { 'retry-after': '-5' }))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = ask(send, 1000, PATIENT).run();

    await vi.advanceTimersByTimeAsync(99);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await expect(got).resolves.toMatchObject({ ok: true });
  });

  it('carries no word of the service into the failure', async () => {
    const send = always(refusalBody('provider_x_is_busy'), 503);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(4);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'network', attempts: 4 } });
    expect(JSON.stringify(got)).not.toContain('provider_x');
  });
});

describe('the log of a fault of the transport', () => {
  const thrown = (fault: unknown): Stub => vi.fn<Send>().mockRejectedValue(fault);

  it('names the cause under the fault, and keeps it out of the record', async () => {
    const fault = new Error('fetch failed', { cause: new Error('ECONNREFUSED') });
    const got = await ask(thrown(fault)).run();

    expect(logged).toHaveBeenCalledWith('the model service failed', {
      kind: 'network',
      cause: 'fetch failed: ECONNREFUSED',
    });
    expect(JSON.stringify(got)).not.toContain('ECONNREFUSED');
  });

  it('gives the message of the fault alone when the cause under it says nothing', async () => {
    await ask(thrown(new Error('fetch failed', { cause: new Error('') }))).run();

    expect(logged).toHaveBeenCalledWith('the model service failed', {
      kind: 'network',
      cause: 'fetch failed',
    });
  });

  it('gives a thrown text as it is', async () => {
    await ask(thrown('socket closed')).run();

    expect(logged).toHaveBeenCalledWith('the model service failed', {
      kind: 'network',
      cause: 'socket closed',
    });
  });

  it('says so when the fault carries no message', async () => {
    await ask(thrown(7)).run();

    expect(logged).toHaveBeenCalledWith('the model service failed', {
      kind: 'network',
      cause: 'the call ended with no message',
    });
  });
});

describe('the boundary refuses the answer', () => {
  it('retries once, and carries the fault back to the model', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: true, value: { claim: 'a ship' } });

    const second = sent.parse(bodiesOf(send)[1]);
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1]?.role).toBe('assistant');
    expect(second.messages[2]?.content).toContain('The schema refuses the last answer');
  });

  it('feeds back the path the schema refuses, so the model can mend that field', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    await ask(send).run();

    const fault = sent.parse(bodiesOf(send)[1]).messages[2]?.content ?? '';
    expect(fault).toMatch(/faults: claim: \S/u);
  });

  it('keeps the path the schema refuses in the detail of the failure', async () => {
    const got = await ask(always(said('{"claim":7}'))).run();

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.failure.detail).toMatch(/^claim: \S/u);
  });

  it('names a text that is not JSON in the detail of the failure', async () => {
    const got = await ask(always(said('a ship, I think'))).run();

    expect(got).toMatchObject({ ok: false, failure: { detail: 'the answer is not JSON text' } });
  });

  it('counts the tokens of every round trip of one question', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const { budget, run } = ask(send);
    const got = await run();

    expect(got).toEqual({
      ok: true,
      value: { claim: 'a ship' },
      tokens: 24,
      served: AGENT.model,
    });
    expect(budget.spent()).toBe(24);
  });

  it('retries once and never twice, and writes no part answer', async () => {
    const send = always(said('{"claim":7}'));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'rejected', attempts: 2 } });
  });

  it('treats an answer that is not JSON the same way', async () => {
    const send = always(said('a ship, I think'));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'rejected' } });
  });

  it('counts every call of the question, and never the answers it judged', async () => {
    const send = vi
      .fn<Send>()
      .mockRejectedValueOnce(new Error('socket closed'))
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":7}')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(3);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'rejected', attempts: 3 } });
  });
});

describe('the credits run out', () => {
  it('fails at once and never retries', async () => {
    const send = always(refusalBody('insufficient_credits'), 402);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'credits' } });
  });
});

describe('a document longer than the window', () => {
  it('reaches the operator as a refusal, and never as a silent cut', async () => {
    const send = always(refusalBody('context_length_exceeded'), 400);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'too_long' } });
  });

  it('reads the stable word in the case the provider writes it', async () => {
    const send = always(refusalBody('Context_Length_Exceeded'), 400);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'too_long', attempts: 1 } });
  });

  it('reads the stable word at a status that asks for a retry, and never retries', async () => {
    const send = always(refusalBody('context_length_exceeded'), 429);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'too_long', attempts: 1 } });
  });

  it('reads the sentence when the provider gives no stable word', async () => {
    const body = JSON.stringify({ error: { message: 'This model has a maximum context of 8192' } });
    const send = always(body, 400);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'too_long', attempts: 1 } });
  });

  it('never calls another bad request too long, so the operator looks in the right place', async () => {
    const body = JSON.stringify({ error: { message: 'temperature must be a number' } });
    const send = always(body, 400);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'configuration', attempts: 1 } });
  });

  it('refuses an answer the model stopped at the token limit', async () => {
    const send = always(said('{"claim":"a shi', 'length'));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'truncated' } });
  });
});

describe('the spend ceilings', () => {
  it('makes no call when the token cap of the job is spent', async () => {
    const send = always(said('{"claim":"a ship"}', 'stop', 60));
    const budget = openBudget(50);
    const model = openModel(AGENT, send, ENV);
    const one = { messages: GO, shape: SHAPE, budget };

    expect(await model.ask(one)).toMatchObject({ ok: true });
    expect(await model.ask(one)).toMatchObject({ ok: false, failure: { kind: 'over_cap' } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops with the cap when the first answer spends it, and calls no second time', async () => {
    const send = always(said('{"claim":7}', 'stop', 60));
    const { budget, run } = ask(send, 50);
    const got = await run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(budget.spent()).toBe(60);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'over_cap' }, tokens: 60 });
  });

  it('makes the call while the cap still has a token left', async () => {
    const send = always(said('{"claim":"a ship"}', 'stop', 990));
    const budget = openBudget(2000);
    const model = openModel(AGENT, send, ENV);
    const one = { messages: GO, shape: SHAPE, budget };

    expect(await model.ask(one)).toMatchObject({ ok: true });
    expect(await model.ask(one)).toMatchObject({ ok: true });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('counts the tokens of an answer the boundary never keeps', async () => {
    const send = always(said('{"claim":"a shi', 'length', 60));
    const { budget, run } = ask(send);
    const got = await run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'truncated' } });
    expect(budget.spent()).toBe(60);
  });
});

describe('the settings and the key', () => {
  it('throws when the key is absent', () => {
    expect(() => openModel(AGENT, always(said('{}')), {})).toThrow(/OPENROUTER_API_KEY/u);
  });

  it('throws when the key is only blank space', () => {
    const held = { OPENROUTER_API_KEY: '   ' };
    expect(() => openModel(AGENT, always(said('{}')), held)).toThrow(/OPENROUTER_API_KEY/u);
  });

  it('refuses a model name that is empty', () => {
    expect(() => openModel({ ...AGENT, model: ' ' }, always(said('{}')), ENV)).toThrow();
  });

  it('refuses settings that give no bound on the wait', () => {
    const unbounded = Object.fromEntries(
      Object.entries(AGENT).filter(([name]) => name !== 'maxWaitMs'),
    );
    expect(() => openModel(unbounded, always(said('{}')), ENV)).toThrow(/maxWaitMs/u);
  });

  it('refuses a bound longer than the longest timer of Node', () => {
    const agent = { ...AGENT, maxWaitMs: 2 ** 31 };
    expect(() => openModel(agent, always(said('{}')), ENV)).toThrow(/maxWaitMs/u);
  });

  it('reads the key once, and never again during the job', async () => {
    const env = { OPENROUTER_API_KEY: 'a-key' };
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const model = openModel(AGENT, send, env);
    env.OPENROUTER_API_KEY = 'another-key';
    const budget = openBudget(1000);
    await model.ask({ messages: GO, shape: SHAPE, budget });

    const signed = send.mock.calls.map(([, init]) =>
      new Headers(init.headers).get('authorization'),
    );
    expect(signed).toEqual(['Bearer a-key', 'Bearer a-key']);
  });

  it('sends every call to the one endpoint', async () => {
    const send = always(said('{"claim":"a ship"}'));
    await ask(send).run();

    const [call] = send.mock.calls;
    expect(call?.[0]).toBe(ENDPOINT);
  });

  it('stops a call that passes timeoutMs, and tries again as a fault of the network', async () => {
    // Origin: a signal that ignores the deadline of 50 ms lets this answer arrive at 500 ms.
    const late = 500;
    const send = vi.fn<Send>(
      (_url, init) =>
        new Promise<Response>((resolve, reject) => {
          const guard = setTimeout(() => resolve(answer(said('{"claim":"late"}'))), late);
          init.signal?.addEventListener('abort', () => {
            clearTimeout(guard);
            reject(new Error('the deadline stopped the call'));
          });
        }),
    );
    const got = await ask(send, 1000, { ...AGENT, timeoutMs: 50 }).run();

    expect(send).toHaveBeenCalledTimes(4);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'network', attempts: 4 } });
  });

  it('reports a fault of the key or of the model name as a fault of the configuration', async () => {
    const send = always(refusalBody('invalid_api_key'), 401);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'configuration' } });
  });

  it('reports a refusal of the model, and keeps nothing', async () => {
    const send = always(
      JSON.stringify({
        model: AGENT.model,
        choices: [{ message: { role: 'assistant', content: null, refusal: 'no' } }],
        usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
      }),
    );
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'refused', attempts: 1 } });
  });
});

describe('the endpoint of the agent', () => {
  it('refuses settings that name no endpoint, because code holds no default', () => {
    const bare = Object.fromEntries(Object.entries(AGENT).filter(([name]) => name !== 'endpoint'));
    expect(() => openModel(bare, always(said('{}')), ENV)).toThrow(/endpoint/u);
  });

  it('refuses an endpoint it does not know', () => {
    expect(() => openModel({ ...AGENT, endpoint: 'elsewhere' }, always(said('{}')), ENV)).toThrow(
      /endpoint/u,
    );
  });

  it('calls the base address of freellmapi from the environment, with its own key', async () => {
    const send = always(said('{"claim":"a ship"}', 'stop', 12, FREE.model));
    await ask(send, 1000, FREE).run();

    const [call] = send.mock.calls;
    expect(call?.[0]).toBe(`${FREE_BASE}/chat/completions`);
    expect(new Headers(call?.[1].headers).get('authorization')).toBe('Bearer a-free-key');
  });

  it('sends no compression flag to freellmapi, and keeps it on OpenRouter', async () => {
    const free = always(said('{"claim":"a ship"}'));
    await ask(free, 1000, FREE).run();
    const paid = always(said('{"claim":"a ship"}'));
    await ask(paid).run();

    expect(bodiesOf(free)[0]).not.toHaveProperty('plugins');
    expect(bodiesOf(paid)[0]).toHaveProperty('plugins');
  });

  it('throws when the base address or the key of freellmapi is absent', () => {
    const send = always(said('{}'));
    expect(() => openModel(FREE, send, { FREELLMAPI_API_KEY: 'k' })).toThrow(
      /FREELLMAPI_BASE_URL/u,
    );
    expect(() => openModel(FREE, send, { FREELLMAPI_BASE_URL: FREE_BASE })).toThrow(
      /FREELLMAPI_API_KEY/u,
    );
  });

  it('reads a 402 as a fault of the configuration on freellmapi, and as credits on OpenRouter', async () => {
    const free = await ask(always(refusalBody('x'), 402), 1000, FREE).run();
    const paid = await ask(always(refusalBody('x'), 402)).run();

    expect(free).toMatchObject({ ok: false, failure: { kind: 'configuration' } });
    expect(paid).toMatchObject({ ok: false, failure: { kind: 'credits' } });
  });

  it('keeps too_long on freellmapi', async () => {
    const got = await ask(always(refusalBody('context_length_exceeded'), 400), 1000, FREE).run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'too_long', attempts: 1 } });
  });
});

describe('the pinned model', () => {
  it('refuses a model named auto, in any case', () => {
    expect(() => openModel({ ...AGENT, model: 'auto' }, always(said('{}')), ENV)).toThrow(/auto/u);
    expect(() => openModel({ ...AGENT, model: ' Auto ' }, always(said('{}')), ENV)).toThrow(
      /auto/u,
    );
  });

  it('drops an answer of another model, with no retry, and counts its tokens', async () => {
    const send = always(said('{"claim":"a ship"}', 'stop', 12, 'b-family/b-model'));
    const { budget, run } = ask(send);
    const got = await run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({
      ok: false,
      failure: { kind: 'served_other', attempts: 1 },
      tokens: 12,
      served: 'b-family/b-model',
    });
    expect(budget.spent()).toBe(12);
    expect(JSON.stringify(got)).not.toContain('a ship');
  });

  it('reads an answer with no model field as another model', async () => {
    const body = JSON.stringify({
      choices: [{ message: { role: 'assistant', content: '{"claim":"a ship"}' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    const send = always(body);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'served_other' } });
  });

  it('reports the served model on a good answer', async () => {
    const got = await ask(always(said('{"claim":"a ship"}'))).run();

    expect(got).toMatchObject({ ok: true, served: AGENT.model });
  });
});

describe('a tool call', () => {
  it('sends the tools with the JSON Schema of the Zod input', async () => {
    const send = always(said('{"claim":"a ship"}'));
    await ask(send, 1000, AGENT, [LOOK]).run();

    expect(bodiesOf(send)[0]).toMatchObject({
      tools: [
        {
          type: 'function',
          function: {
            name: 'look_up',
            description: 'Look a name up.',
            parameters: { type: 'object', properties: { name: { type: 'string' } } },
          },
        },
      ],
    });
  });

  it('gives a valid call, checked with the input of the tool', async () => {
    const send = always(called([['c1', 'look_up', '{"name":"Ada"}']]));
    const got = await ask(send, 1000, AGENT, [LOOK]).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toEqual({
      ok: true,
      call: { id: 'c1', name: 'look_up', input: { name: 'Ada' } },
      tokens: 12,
      served: AGENT.model,
    });
  });

  it('still gives the final answer when the model calls no tool', async () => {
    const got = await ask(always(said('{"claim":"a ship"}')), 1000, AGENT, [LOOK]).run();

    expect(got).toMatchObject({ ok: true, value: { claim: 'a ship' } });
  });

  it('retries a bad argument once, and answers the call id on the tool role', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(called([['c1', 'look_up', '{"name":7}']])))
      .mockResolvedValueOnce(answer(called([['c2', 'look_up', '{"name":"Ada"}']])));
    const got = await ask(send, 1000, AGENT, [LOOK]).run();

    expect(got).toMatchObject({ ok: true, call: { id: 'c2' }, tokens: 24 });

    const second = z
      .object({ messages: z.array(z.record(z.string(), z.unknown())) })
      .parse(bodiesOf(send)[1]).messages;
    expect(second).toHaveLength(3);
    expect(second[1]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 'c1' }] });
    expect(second[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(String(second[2]?.['content'])).toContain('The schema refuses the last answer');
  });

  it('fails as rejected after the one retry', async () => {
    const send = always(called([['c1', 'look_up', '{"name":7}']]));
    const got = await ask(send, 1000, AGENT, [LOOK]).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'rejected', attempts: 2 } });
  });

  it('rejects a tool the question does not hold, and arguments that are not JSON', async () => {
    const unknown = await ask(always(called([['c1', 'other', '{}']])), 1000, AGENT, [LOOK]).run();
    const broken = await ask(always(called([['c1', 'look_up', '{"na']])), 1000, AGENT, [
      LOOK,
    ]).run();

    expect(unknown).toMatchObject({ ok: false, failure: { kind: 'rejected' } });
    expect(broken).toMatchObject({ ok: false, failure: { kind: 'rejected' } });
  });

  it('rejects more than one call in an answer, and answers every id on the retry', async () => {
    const two = called([
      ['c1', 'look_up', '{"name":"Ada"}'],
      ['c2', 'look_up', '{"name":"Bo"}'],
    ]);
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(two))
      .mockResolvedValueOnce(answer(called([['c3', 'look_up', '{"name":"Ada"}']])));
    const got = await ask(send, 1000, AGENT, [LOOK]).run();

    expect(got).toMatchObject({ ok: true, call: { id: 'c3' } });
    const second = z
      .object({ messages: z.array(z.record(z.string(), z.unknown())) })
      .parse(bodiesOf(send)[1]).messages;
    expect(second.map((one) => one['role'])).toEqual(['user', 'assistant', 'tool', 'tool']);
    expect(second.map((one) => one['tool_call_id'])).toEqual([undefined, undefined, 'c1', 'c2']);
  });

  it('reads a tool call on a question with no tool as unreadable', async () => {
    const send = always(called([['c1', 'look_up', '{"name":"Ada"}']]));
    const got = await ask(send).run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'unreadable' } });
  });
});

describe('the quota is spent', () => {
  it('fails at once as quota, and never as network', async () => {
    const body = JSON.stringify({ error: { message: 'daily quota exhausted' } });
    const send = always(body, 429);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'quota', attempts: 1 } });
  });

  it('reads the stable word of the quota, and it holds on freellmapi too', async () => {
    const body = JSON.stringify({ error: { code: 'insufficient_quota', message: 'no' } });
    const got = await ask(always(body, 429), 1000, FREE).run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'quota' } });
  });
});

describe('the read of the quota that is left', () => {
  const FORECAST = JSON.stringify({
    generated_at: '2026-10-04T00:00:00Z',
    pools: [
      {
        platform: 'groq',
        pool: 'groq::account',
        used: 90,
        remaining: 10,
        limit: 100,
        remaining_pct: 10,
        reset_at: '2026-10-05T00:00:00Z',
        low_balance: true,
        seconds_until_reset: 3600,
      },
      {
        platform: 'google',
        pool: 'google::account',
        used: null,
        remaining: null,
        limit: null,
        remaining_pct: null,
        reset_at: null,
        low_balance: false,
        seconds_until_reset: null,
      },
    ],
  });

  const open = (send: Stub) => openModel(FREE, send, FREE_ENV);

  it('calls the forecast path of freellmapi with the unified key, and parses each pool', async () => {
    const send = always(FORECAST);
    const got = await open(send).quota?.();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBe(`${FREE_BASE}/quota-forecast`);
    expect(send.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      headers: { authorization: 'Bearer a-free-key' },
    });
    expect(got).toEqual({
      ok: true,
      pools: [
        {
          platform: 'groq',
          pool: 'groq::account',
          remaining: 10,
          limit: 100,
          resetAt: '2026-10-05T00:00:00Z',
          low: true,
        },
        {
          platform: 'google',
          pool: 'google::account',
          remaining: null,
          limit: null,
          resetAt: null,
          low: false,
        },
      ],
    });
  });

  it('has no read on openrouter', () => {
    expect(openModel(AGENT, always(FORECAST), ENV).quota).toBeUndefined();
  });

  it('fails as unreadable on a body of another shape, and never retries', async () => {
    const send = always(JSON.stringify({ pools: 'none' }));
    const got = await open(send).quota?.();

    expect(send).toHaveBeenCalledTimes(1);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'unreadable', attempts: 1 } });
  });

  it('fails as configuration on a refused key, and as network on a dead service', async () => {
    const refused = await open(always('{}', 401)).quota?.();
    const down = await open(always('{}', 503)).quota?.();
    const lost = await open(vi.fn<Send>(() => Promise.reject(new Error('gone')))).quota?.();

    expect(refused).toMatchObject({ ok: false, failure: { kind: 'configuration' } });
    expect(down).toMatchObject({ ok: false, failure: { kind: 'network' } });
    expect(lost).toMatchObject({ ok: false, failure: { kind: 'network' } });
  });
});

describe('the longest time of one question', () => {
  it('counts every call and every wait of the worst question the client can make', async () => {
    const down = (): Response => answer('{}', 503);
    const wrong = (): Response => answer(said('{"other":1}'));
    // Each of the two round trips fails on its first three calls and ends on a refused answer.
    const send = vi.fn<Send>();
    send.mockImplementation(() =>
      Promise.resolve(send.mock.calls.length % 4 === 0 ? wrong() : down()),
    );
    const slow: AgentModel = { ...AGENT, maxWaitMs: 1, firstWaitMs: 1, waitGrowth: 1 };

    const got = await ask(send, 1000, slow).run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'rejected', attempts: 8 } });
    const calls = 8;
    const waits = 6;
    expect(worstQuestionMs(slow)).toBe(calls * slow.timeoutMs + waits * slow.maxWaitMs);
  });
});
