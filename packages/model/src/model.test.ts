// The adapter as a caller uses it, against a local server that speaks the OpenAI chat API in place
// of OpenRouter.

import { once } from 'node:events';
import { createServer, type Server } from 'node:http';

import {
  createOpenAICompatible,
  OpenAICompatibleChatLanguageModel,
} from '@ai-sdk/openai-compatible';
import { registerTelemetry } from 'ai';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { openBudget } from './budget.ts';
import { openrouterModel } from './openrouter.ts';
import { openModel, type CallRecord, type Message, type ModelLine, type Tool } from './model.ts';

const PINNED = 'a-family/a-model';
const SHAPE = z.object({ claim: z.string() });
const GO: readonly Message[] = [
  { role: 'system', content: 'read' },
  { role: 'user', content: 'go' },
];

const LINE: ModelLine = {
  firstWaitMs: 100,
  waitGrowth: 2,
  maxWaitMs: 10_000,
  timeoutMs: 2000,
  maxAnswerTokens: 500,
};

interface Reply {
  readonly status?: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

const replies: Reply[] = [];
const bodies: unknown[] = [];

const server: Server = createServer((request, response) => {
  let text = '';
  request.setEncoding('utf8');
  request.on('data', (part: string) => {
    text += part;
  });
  request.on('end', () => {
    bodies.push(JSON.parse(text));
    const reply = replies.shift() ?? { status: 500, body: { error: { message: 'no script' } } };
    response.writeHead(reply.status ?? 200, {
      'content-type': 'application/json',
      ...reply.headers,
    });
    response.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
  });
});

let base = '';

beforeAll(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('the server has no port');
  base = `http://127.0.0.1:${String(address.port)}/v1`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  replies.length = 0;
  bodies.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const said = (content: string, extra: { model?: string; finish?: string } = {}): Reply => ({
  body: {
    model: extra.model ?? PINNED,
    choices: [{ message: { role: 'assistant', content }, finish_reason: extra.finish ?? 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  },
});

const called = (name: string, args: string): Reply => ({
  body: {
    model: PINNED,
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call-1', type: 'function', function: { name, arguments: args } }],
        },
        finish_reason: 'tool_calls',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  },
});

const refused = (status: number, error: unknown, headers?: Record<string, string>): Reply => ({
  status,
  body: { error },
  ...(headers === undefined ? {} : { headers }),
});

const LOOK: Tool = {
  name: 'look_up',
  description: 'Look a name up.',
  input: z.object({ name: z.string() }),
};

interface Opened {
  readonly records: CallRecord[];
  readonly waits: number[];
  readonly ask: (
    tools?: readonly Tool[],
    cap?: number,
  ) => ReturnType<ReturnType<typeof openModel>['ask']>;
}

const open = (pinned = PINNED): Opened => {
  const records: CallRecord[] = [];
  const waits: number[] = [];
  const model = openModel(
    openrouterModel(pinned, { OPENROUTER_BASE_URL: base, OPENROUTER_API_KEY: 'a-key' }),
    LINE,
    {
      record: (call) => {
        records.push(call);
        return Promise.resolve(`call-${String(records.length)}`);
      },
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    },
  );
  return {
    records,
    waits,
    ask: (tools, cap = 1000) =>
      model.ask({
        messages: GO,
        shape: SHAPE,
        budget: openBudget(cap),
        ...(tools === undefined ? {} : { tools }),
      }),
  };
};

const sent = z.object({
  model: z.string(),
  max_tokens: z.number(),
  response_format: z.object({ type: z.literal('json_object') }),
  messages: z.array(z.object({ role: z.string() }).loose()),
});

describe('OpenRouter', () => {
  it('pins one model, and never the model that the router picks', () => {
    expect(() => openrouterModel('auto', { OPENROUTER_API_KEY: 'k' })).toThrow(/pinned/u);
  });

  it('stops with the name of the key when it is absent', () => {
    expect(() => openrouterModel(PINNED, {})).toThrow(/OPENROUTER_API_KEY/u);
    expect(() => openrouterModel(PINNED, { OPENROUTER_API_KEY: '  ' })).toThrow(
      /OPENROUTER_API_KEY/u,
    );
  });

  it('calls OpenRouter by default, with the key, and asks the router to keep the prompt private', async () => {
    const seen: { url: string; authorization: string | null; body: unknown }[] = [];
    const send: typeof fetch = (url, init) => {
      seen.push({
        url: url instanceof Request ? url.url : url.toString(),
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(typeof init?.body === 'string' ? init.body : '{}'),
      });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model: PINNED,
            choices: [
              {
                message: { role: 'assistant', content: '{"claim":"a ship"}' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
          }),
          { status: 200 },
        ),
      );
    };
    const model = openModel(openrouterModel(PINNED, { OPENROUTER_API_KEY: 'a-key' }, send), LINE, {
      record: () => Promise.resolve('call'),
    });

    await model.ask({ messages: GO, shape: SHAPE, budget: openBudget(1000) });

    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(seen[0]?.authorization).toBe('Bearer a-key');
    expect(seen[0]?.body).toMatchObject({
      provider: { data_collection: 'deny', require_parameters: true },
    });
  });

  it.each([
    ['firstWaitMs', 0],
    ['maxWaitMs', -1],
    ['timeoutMs', 0],
    ['maxAnswerTokens', 0],
    ['waitGrowth', 0.5],
  ] as const)('refuses a line with %s of %d', (key, value) => {
    const model = openrouterModel(PINNED, { OPENROUTER_BASE_URL: base, OPENROUTER_API_KEY: 'k' });
    expect(() =>
      openModel(model, { ...LINE, [key]: value }, { record: () => Promise.resolve('call') }),
    ).toThrow();
  });

  it('refuses a model that another provider made', () => {
    const elsewhere = createOpenAICompatible({ name: 'elsewhere', baseURL: base })(PINNED);
    if (!(elsewhere instanceof OpenAICompatibleChatLanguageModel))
      throw new Error('the provider made no chat model');
    expect(() => openModel(elsewhere, LINE, { record: () => Promise.resolve('call') })).toThrow(
      /OpenRouter/u,
    );
  });
});

describe('a good answer', () => {
  it('gives the value of the shape, and records the call before it returns', async () => {
    replies.push(said('{"claim":"a ship"}'));
    const { ask, records } = open();

    expect(await ask()).toStrictEqual({
      ok: true,
      value: { claim: 'a ship' },
      callId: 'call-1',
      tokens: 12,
      served: PINNED,
    });
    expect(records).toStrictEqual([
      expect.objectContaining({
        requested: PINNED,
        served: PINNED,
        outcome: 'ok',
        inputTokens: 10,
        outputTokens: 2,
      }),
    ]);
    expect(records[0]?.promptSha256).toMatch(/^[0-9a-f]{64}$/u);
    const body = sent.parse(bodies[0]);
    expect(body).toMatchObject({ model: PINNED, max_tokens: LINE.maxAnswerTokens });
    expect(body.messages.map((one) => one.role)).toStrictEqual(['system', 'user']);
  });

  it('reads a JSON answer that the model puts in a code fence', async () => {
    replies.push(said('```json\n{"claim":"a ship"}\n```'));
    const { ask } = open();

    expect(await ask()).toMatchObject({ ok: true, value: { claim: 'a ship' } });
  });

  it('gives no event to a telemetry hook of the library', async () => {
    const heard = vi.fn();
    registerTelemetry({ onStart: heard, onEnd: heard, onLanguageModelCallStart: heard });
    replies.push(said('{"claim":"a ship"}'));
    const { ask } = open();

    expect(await ask()).toMatchObject({ ok: true });
    expect(heard).not.toHaveBeenCalled();
  });

  it('gives one tool call with its checked input', async () => {
    replies.push(called('look_up', '{"name":"Nayara"}'));
    const { ask } = open();

    expect(await ask([LOOK])).toMatchObject({
      ok: true,
      call: { id: 'call-1', name: 'look_up', input: { name: 'Nayara' } },
    });
  });
});

describe('the served model', () => {
  it('refuses an answer of another model, and records the model that answered', async () => {
    replies.push(said('{"claim":"a ship"}', { model: 'another-family/another-model' }));
    const { ask, records } = open();

    expect(await ask()).toMatchObject({ ok: false, failure: { kind: 'served_other' } });
    expect(records[0]).toMatchObject({
      outcome: 'served_other',
      served: 'another-family/another-model',
    });
  });

  it.each([`${PINNED}-20250514`, `${PINNED}-2025-05-14`, `${PINNED}:nitro`, PINNED.toUpperCase()])(
    'accepts the same model under the name %s',
    async (served) => {
      replies.push(said('{"claim":"a ship"}', { model: served }));
      const { ask } = open();

      expect(await ask()).toMatchObject({ ok: true, value: { claim: 'a ship' } });
    },
  );

  it.each([`${PINNED}-2`, `${PINNED}-mini`, 'a-family/other-model', 'other-family/a-model'])(
    'refuses another model that is named %s',
    async (served) => {
      replies.push(said('{"claim":"a ship"}', { model: served }));
      const { ask } = open();

      expect(await ask()).toMatchObject({ ok: false, failure: { kind: 'served_other' } });
    },
  );

  it('refuses a model that the router does not serve', async () => {
    replies.push(refused(404, { message: 'model not found' }));
    const { ask } = open('no-family/no-model');

    expect(await ask()).toMatchObject({ ok: false, failure: { kind: 'configuration' } });
  });
});

describe('a fault that time mends', () => {
  it('asks again after a wait that grows', async () => {
    replies.push(refused(503, { message: 'busy' }), refused(503, { message: 'busy' }));
    replies.push(said('{"claim":"a ship"}'));
    const { ask, waits } = open();

    expect(await ask()).toMatchObject({ ok: true, value: { claim: 'a ship' } });
    expect(waits).toStrictEqual([100, 200]);
  });

  it('waits as long as the router asks, up to the bound', async () => {
    replies.push(refused(429, { message: 'slow down' }, { 'retry-after': '3' }));
    replies.push(refused(429, { message: 'slow down' }, { 'retry-after': '99' }));
    replies.push(said('{"claim":"a ship"}'));
    const { ask, waits } = open();

    expect(await ask()).toMatchObject({ ok: true });
    expect(waits).toStrictEqual([3000, LINE.maxWaitMs]);
  });

  it('stops after three retries, and records one failed call', async () => {
    for (let n = 0; n < 4; n += 1) replies.push(refused(502, { message: 'down' }));
    const { ask, records } = open();

    expect(await ask()).toMatchObject({ ok: false, failure: { kind: 'network', attempts: 4 } });
    expect(records.map((one) => one.outcome)).toStrictEqual(['network']);
  });
});

describe('a fault that no wait mends', () => {
  const cases: readonly [string, Reply, string][] = [
    ['no credit', refused(402, { message: 'pay' }), 'credits'],
    [
      'a text too long',
      refused(400, { message: 'too long', code: 'context_length_exceeded' }),
      'too_long',
    ],
    [
      'a text too long, said in words',
      refused(400, { message: 'Maximum context exceeded' }),
      'too_long',
    ],
    ['a spent quota', refused(429, { message: 'daily quota spent' }), 'quota'],
    ['a bad key', refused(401, { message: 'who are you' }), 'configuration'],
  ];
  for (const [name, reply, kind] of cases)
    it(`stops at once on ${name}`, async () => {
      replies.push(reply);
      const { ask, waits } = open();

      expect(await ask()).toMatchObject({ ok: false, failure: { kind } });
      expect(waits).toStrictEqual([]);
    });

  it('keeps no part of an answer cut at the token limit', async () => {
    replies.push(said('{"claim":"a sh', { finish: 'length' }));
    const { ask } = open();

    expect(await ask()).toMatchObject({ ok: false, failure: { kind: 'truncated' } });
  });
});

describe('a bad shape', () => {
  it('goes back to the model once with its fault', async () => {
    replies.push(said('{"claim":7}'), said('{"claim":"a ship"}'));
    const { ask, records } = open();

    expect(await ask()).toMatchObject({ ok: true, value: { claim: 'a ship' } });
    const retry = sent.parse(bodies[1]).messages.at(-1);
    expect(JSON.stringify(retry)).toContain('claim');
    expect(records).toHaveLength(1);
  });

  it('fails when the second answer is bad too', async () => {
    replies.push(said('not json'), said('{"claim":7}'));
    const { ask } = open();

    expect(await ask()).toMatchObject({ ok: false, failure: { kind: 'rejected' } });
  });

  it('answers a call of a tool that is not offered with its fault', async () => {
    replies.push(called('drop_table', '{}'), called('look_up', '{"name":"Nayara"}'));
    const { ask } = open();

    expect(await ask([LOOK])).toMatchObject({ ok: true, call: { name: 'look_up' } });
    expect(JSON.stringify(bodies[1])).toContain('drop_table does not exist');
  });
});

describe('the token budget of a job', () => {
  it('counts each answer and stops a question when the cap is spent', async () => {
    replies.push(said('{"claim":"a ship"}'), said('{"claim":"a ship"}'));
    const records: CallRecord[] = [];
    const model = openModel(
      openrouterModel(PINNED, { OPENROUTER_BASE_URL: base, OPENROUTER_API_KEY: 'k' }),
      LINE,
      {
        record: (call) => {
          records.push(call);
          return Promise.resolve('call');
        },
      },
    );
    const budget = openBudget(12);
    const question = { messages: GO, shape: SHAPE, budget };

    expect(await model.ask(question)).toMatchObject({ ok: true });
    expect(await model.ask(question)).toMatchObject({ ok: false, failure: { kind: 'over_cap' } });
    expect(bodies).toHaveLength(1);
    expect(records.map((one) => one.outcome)).toStrictEqual(['ok', 'over_cap']);
  });
});
