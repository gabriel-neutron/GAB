import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { openBudget } from './budget.ts';
import { openModel, type AgentModel, type Send } from './client.ts';

const AGENT: AgentModel = {
  model: 'a-family/a-model',
  firstWaitMs: 0,
  timeoutMs: 1000,
  maxAnswerTokens: 500,
};

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

const ask = (send: Stub, cap = 1000) => {
  const budget = openBudget(cap);
  const model = openModel(AGENT, send, ENV);
  return {
    budget,
    run: () => model.ask({ messages: [{ role: 'user', content: 'go' }], shape: SHAPE, budget }),
  };
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
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

  it('bounds the answer by the smaller of the agent limit and what the cap leaves', async () => {
    const send = always(said('{"claim":"a ship"}'));
    await ask(send, 40).run();

    expect(bodiesOf(send)[0]).toMatchObject({ max_tokens: 40 });
  });
});

describe('the network fails', () => {
  it('tries once and retries three times, then fails with nothing written', async () => {
    const send = vi.fn<Send>(() => Promise.reject(new Error('socket closed')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(4);
    expect(got).toMatchObject({ ok: false, failure: { kind: 'network', attempts: 4 } });
  });

  it('retries a status that time can mend, and honours the wait the service names', async () => {
    const send = vi
      .fn<Send>()
      .mockResolvedValueOnce(answer('{}', 429, { 'retry-after': '0' }))
      .mockResolvedValueOnce(answer(said('{"claim":"a ship"}')));
    const got = await ask(send).run();

    expect(send).toHaveBeenCalledTimes(2);
    expect(got).toMatchObject({ ok: true });
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
    expect(second.messages[2]?.content).toContain('refused by the schema');
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
});

describe('the settings and the key', () => {
  it('throws when the key is absent', () => {
    expect(() => openModel(AGENT, always(said('{}')), {})).toThrow(/OPENROUTER_API_KEY/u);
  });

  it('refuses a model name that is empty', () => {
    expect(() => openModel({ ...AGENT, model: ' ' }, always(said('{}')), ENV)).toThrow();
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
