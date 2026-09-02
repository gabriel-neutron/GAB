import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { openBudget } from './budget.ts';
import { openModel, type AgentModel, type Send } from './client.ts';

const AGENT: AgentModel = {
  model: 'a-family/a-model',
  firstWaitMs: 1,
  waitGrowth: 2,
  timeoutMs: 1000,
  maxAnswerTokens: 500,
};

// A wait of one millisecond hides the growth of the wait. Every test of a wait uses this agent.
const PATIENT: AgentModel = { ...AGENT, firstWaitMs: 100 };
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const ENV = { OPENROUTER_API_KEY: 'a-key' };
const SHAPE = z.object({ claim: z.string() });

type Stub = ReturnType<typeof vi.fn<Send>>;

const said = (content: string, finish = 'stop', total = 12): string =>
  JSON.stringify({
    choices: [{ message: { role: 'assistant', content }, finish_reason: finish }],
    usage: { prompt_tokens: total - 2, completion_tokens: 2, total_tokens: total },
  });

const answer = (body: string, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(body, { status, headers });

const refusalBody = (word: string): string =>
  JSON.stringify({ error: { message: 'no', metadata: { error_type: word } } });

const always = (body: string, status = 200, headers: Record<string, string> = {}): Stub =>
  vi.fn<Send>(() => Promise.resolve(answer(body, status, headers)));

const bodiesOf = (send: Stub): unknown[] =>
  send.mock.calls.map(([, init]) => JSON.parse(init.body as string) as unknown);

const ask = (send: Stub, cap = 1000, agent: AgentModel = AGENT) => {
  const budget = openBudget(cap);
  const model = openModel(agent, send, ENV);
  return {
    budget,
    run: () => model.ask({ messages: [{ role: 'user', content: 'go' }], shape: SHAPE, budget }),
  };
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a good answer', () => {
  it('gives the parsed value and counts the tokens', async () => {
    const send = always(said('{"claim":"a ship"}'));
    const { budget, run } = ask(send);
    const got = await run();

    expect(got).toEqual({ ok: true, value: { claim: 'a ship' }, tokens: 12 });
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

  it('bounds the answer by the agent limit when the cap leaves more', async () => {
    const send = always(said('{"claim":"a ship"}'));
    await ask(send, 1000).run();

    expect(bodiesOf(send)[0]).toMatchObject({ max_tokens: AGENT.maxAnswerTokens });
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
    const got = ask(send, 1000, { ...PATIENT, maxWaitMs: 50 }).run();

    await vi.advanceTimersByTimeAsync(50);
    expect(send).toHaveBeenCalledTimes(2);
    await expect(got).resolves.toMatchObject({ ok: true });
  });

  it('starts no new call after the deadline of the whole question', async () => {
    vi.useFakeTimers();
    const send = vi.fn<Send>(() => Promise.reject(new Error('socket closed')));
    const got = ask(send, 1000, { ...PATIENT, deadlineMs: 50 }).run();

    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(2);
    await expect(got).resolves.toMatchObject({
      ok: false,
      failure: { kind: 'network', attempts: 2 },
    });
  });

  it('carries no word of the service into the failure', async () => {
    const send = always(refusalBody('provider_x_is_busy'), 503);
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(4);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'network', attempts: 4 } });
    expect(JSON.stringify(got)).not.toContain('provider_x');
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

    const second = bodiesOf(send)[1] as { messages: { role: string; content: string }[] };
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1]?.role).toBe('assistant');
    expect(second.messages[2]?.content).toContain('The schema refuses the last answer');
  });

  it('counts the tokens of every round trip of one question', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const { budget, run } = ask(send);
    const got = await run();

    expect(got).toEqual({ ok: true, value: { claim: 'a ship' }, tokens: 24 });
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

  it('reads the sentence when the provider gives no stable word', async () => {
    const body = JSON.stringify({ error: { message: 'This model has a maximum context of 8192' } });
    const got = await ask(always(body, 400)).run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'too_long' } });
  });

  it('never calls another bad request too long, so the operator looks in the right place', async () => {
    const body = JSON.stringify({ error: { message: 'temperature must be a number' } });
    const got = await ask(always(body, 400)).run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'configuration' } });
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
    const one = { messages: [{ role: 'user' as const, content: 'go' }], shape: SHAPE, budget };

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

  it('makes no call when the cap leaves less than the caller says a call is worth', async () => {
    const send = always(said('{"claim":"a ship"}', 'stop', 990));
    const budget = openBudget(1000);
    const model = openModel({ ...AGENT, minCallTokens: 20 }, send, ENV);
    const one = { messages: [{ role: 'user' as const, content: 'go' }], shape: SHAPE, budget };

    expect(await model.ask(one)).toMatchObject({ ok: true });
    expect(await model.ask(one)).toMatchObject({ ok: false, failure: { kind: 'over_cap' } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('makes the call when no floor is set and the cap leaves a little', async () => {
    const send = always(said('{"claim":"a ship"}', 'stop', 990));
    const budget = openBudget(2000);
    const model = openModel(AGENT, send, ENV);
    const one = { messages: [{ role: 'user' as const, content: 'go' }], shape: SHAPE, budget };

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

  it('reads the key once, and never again during the job', async () => {
    const env = { OPENROUTER_API_KEY: 'a-key' };
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer(said('{"claim":7}')))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const model = openModel(AGENT, send, env);
    env.OPENROUTER_API_KEY = 'another-key';
    const budget = openBudget(1000);
    await model.ask({ messages: [{ role: 'user', content: 'go' }], shape: SHAPE, budget });

    const signed = send.mock.calls.map(
      ([, init]) => (init.headers as Record<string, string>)['authorization'],
    );
    expect(signed).toEqual(['Bearer a-key', 'Bearer a-key']);
  });

  it('sends every call to the one endpoint, and gives it a deadline', async () => {
    const send = always(said('{"claim":"a ship"}'));
    await ask(send).run();

    const [call] = send.mock.calls;
    expect(call?.[0]).toBe(ENDPOINT);
    expect(call?.[1].signal).toBeInstanceOf(AbortSignal);
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
        choices: [{ message: { role: 'assistant', content: null, refusal: 'no' } }],
        usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
      }),
    );
    const got = await ask(send).run();

    expect(got).toMatchObject({ ok: false, failure: { kind: 'refused' } });
  });
});
