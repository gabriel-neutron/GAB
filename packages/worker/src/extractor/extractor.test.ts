import { REASON, type Message, type Question } from '@gab/model';
import { documentText } from '@gab/tools/document-text';
import { lookupEntity } from '@gab/tools/lookup-entity';
import { proposeChange } from '@gab/tools/propose-change';
import { putClaimReading } from '@gab/tools/put-claim-reading';
import { ToolRefusal } from '@gab/tools/tool';
import { describe, expect, it } from 'vitest';

import { JobStop, ModelFailure, type AgentContext, type Asked } from '../agents.ts';
import { idempotencyKey } from '../idempotency.ts';
import type { ReaderConfig } from '../reader-config.ts';
import { claimKeyOf, EXTRACTOR_NAME, makeExtractor, type ExtractorTools } from './extractor.ts';

const DOC = 'doc_extractor_unit';
const PROPOSAL = '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b';
const READING = '4a3b2c1d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const CALL = '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e';
const MODEL = 'a-family/a-model';
const PAGE = 'Nayara sailed from Sikka. Rosneft owns it.';

const CONFIG: ReaderConfig = {
  model: {
    endpoint: 'freellmapi',
    model: MODEL,
    firstWaitMs: 1,
    waitGrowth: 1,
    maxWaitMs: 1,
    timeoutMs: 1000,
    maxAnswerTokens: 200,
  },
  family: 'a-family',
  tokenCap: 10_000,
  turnCap: 6,
  chunkCap: 1000,
};

const ACT = { op: 'create_entity', type: 'vessel', label: 'Nayara' };
const ENTRY = { act: ACT, page: 1, start: 0, end: 6, modality: 'asserts' };

type Reply = { kind: 'value'; value: unknown } | { kind: 'call'; name: string; input: unknown };

interface Scripted {
  readonly context: AgentContext;
  readonly asked: Question<unknown>[];
  readonly queries: string[];
}

// The scripted model stub: each ask takes the next reply, and an ask past the script fails.
const contextOf = (
  replies: readonly (Reply | Error)[],
  pages: readonly { page: number; text: string }[] = [{ page: 1, text: PAGE }],
): Scripted => {
  const asked: Question<unknown>[] = [];
  const queries: string[] = [];
  const ask = <T>(question: Omit<Question<T>, 'budget'>): Promise<Asked<T>> => {
    asked.push(question as Question<unknown>);
    const reply = replies[asked.length - 1];
    if (reply === undefined) throw new Error(`the script holds no reply ${asked.length}`);
    if (reply instanceof Error) return Promise.reject(reply);
    const common = { callId: CALL, promptHash: 'a'.repeat(64), served: MODEL, tokens: 1 };
    if (reply.kind === 'value')
      return Promise.resolve({ kind: 'value', value: reply.value as T, ...common });
    return Promise.resolve({
      kind: 'call',
      call: { id: `call-${asked.length}`, name: reply.name, input: reply.input },
      ...common,
    });
  };
  return {
    asked,
    queries,
    context: {
      job: { id: CALL, documentId: DOC, kind: 'extract_text' },
      db: {
        query: (text: string) => {
          queries.push(text);
          return Promise.resolve({
            rows: pages.map((page) => ({ extractor: 'pdf@1', page: page.page, text: page.text })),
          });
        },
      },
      ask,
      keyOf: (parts) =>
        idempotencyKey({ ...parts, documentId: DOC, readerId: `${EXTRACTOR_NAME}@v1` }),
    },
  };
};

interface Recorded {
  readonly tools: ExtractorTools;
  readonly proposed: unknown[];
  readonly read: unknown[];
}

const toolsOf = (
  options: { refuses?: string; readingRefuses?: string; documentPages?: string } = {},
): Recorded => {
  const proposed: unknown[] = [];
  const read: unknown[] = [];
  return {
    proposed,
    read,
    tools: {
      documentText: {
        ...documentText,
        run: () =>
          Promise.resolve({
            document: DOC,
            extractor: 'pdf@1',
            pages: [{ page: 1, text: options.documentPages ?? PAGE }],
            lastPage: 1,
            truncated: false,
          }),
      },
      lookupEntity: { ...lookupEntity, run: () => Promise.resolve({ entities: [] }) },
      proposeChange: {
        ...proposeChange,
        run: (_session, input) => {
          proposed.push(input);
          if (options.refuses !== undefined) throw new ToolRefusal(options.refuses);
          return Promise.resolve({ proposalId: PROPOSAL, op: 'create_entity' });
        },
      },
      putClaimReading: {
        ...putClaimReading,
        run: (_session, input) => {
          read.push(input);
          if (options.readingRefuses !== undefined) throw new ToolRefusal(options.readingRefuses);
          return Promise.resolve({ readingId: READING });
        },
      },
    },
  };
};

const lastMessage = (question: Question<unknown> | undefined): Message | undefined =>
  question?.messages.at(-1);

const textsOf = (question: Question<unknown> | undefined): string =>
  (question?.messages ?? []).map((message) => message.content).join('\n');

describe('the text of the document', () => {
  it('goes to the model as it is stored', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [] } }]);
    await makeExtractor(CONFIG, { tools: toolsOf().tools }).run(scripted.context);

    expect(textsOf(scripted.asked[0])).toContain(JSON.stringify(PAGE));
  });
});

describe('the tools of the model', () => {
  it('offers the model document_text and lookup_entity alone', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [] } }]);
    await makeExtractor(CONFIG, { tools: toolsOf().tools }).run(scripted.context);

    expect(scripted.asked[0]?.tools?.map((tool) => tool.name)).toStrictEqual([
      'document_text',
      'lookup_entity',
    ]);
  });

  it('refuses a call outside the tools it offered, and returns the refusal in its result', async () => {
    const scripted = contextOf([
      { kind: 'call', name: 'propose_change', input: { act: ACT, documents: [DOC] } },
      { kind: 'value', value: { claims: [] } },
    ]);
    const recorded = toolsOf();
    const result = await makeExtractor(CONFIG, { tools: recorded.tools }).run(scripted.context);

    expect(result.refusals).toStrictEqual([
      { tool: 'propose_change', reason: expect.stringMatching(/not offered/u) as unknown },
    ]);
    expect(recorded.proposed).toHaveLength(0);
    expect(lastMessage(scripted.asked[1])?.role).toBe('tool');
  });
});

describe('a claim of the model', () => {
  it('is proposed, then read with offsets in the page, and the key ties the two', async () => {
    const scripted = contextOf(
      [
        { kind: 'value', value: { claims: [] } },
        { kind: 'value', value: { claims: [{ ...ENTRY, start: 1, end: 3, adverse: true }] } },
      ],
      [{ page: 1, text: 'abcdefghij' }],
    );
    const recorded = toolsOf();
    await makeExtractor({ ...CONFIG, chunkCap: 6 }, { tools: recorded.tools }).run(
      scripted.context,
    );

    expect(recorded.proposed).toStrictEqual([
      expect.objectContaining({ act: ACT, documents: [DOC], modelCallId: CALL }),
    ]);
    const [proposal] = recorded.proposed as { idempotencyKey: string }[];
    expect(recorded.read).toStrictEqual([
      expect.objectContaining({
        job: CALL,
        claim: PROPOSAL,
        textExtractor: 'pdf@1',
        page: 1,
        start: 7,
        end: 9,
        modality: 'asserts',
        adverse: true,
        modelCallId: CALL,
        inputForm: 'text',
        idempotencyKey: proposal?.idempotencyKey,
      }),
    ]);
  });

  it('is asked again once with the fault when the boundary refuses it, and never a third time', async () => {
    const fault = 'the target of this act does not exist';
    const scripted = contextOf([
      { kind: 'value', value: { claims: [ENTRY] } },
      { kind: 'value', value: { claim: ENTRY } },
    ]);
    const recorded = toolsOf({ refuses: fault });
    const result = await makeExtractor(CONFIG, { tools: recorded.tools }).run(scripted.context);

    expect(scripted.asked).toHaveLength(2);
    expect(recorded.proposed).toHaveLength(2);
    expect(scripted.asked.filter((question) => textsOf(question).includes(fault))).toHaveLength(1);
    expect(lastMessage(scripted.asked[1])?.content).toContain(fault);
    expect(result.refusals).toStrictEqual([{ tool: 'propose_change', reason: fault }]);
    expect(recorded.read).toHaveLength(0);
  });

  it('is asked again when its span lies outside the chunk, and the corrected claim is kept', async () => {
    const scripted = contextOf([
      { kind: 'value', value: { claims: [{ ...ENTRY, end: 900 }] } },
      { kind: 'value', value: { claim: ENTRY } },
    ]);
    const recorded = toolsOf();
    const result = await makeExtractor(CONFIG, { tools: recorded.tools }).run(scripted.context);

    expect(lastMessage(scripted.asked[1])?.content).toMatch(/outside the chunk/u);
    expect(recorded.proposed).toHaveLength(1);
    expect(recorded.read).toHaveLength(1);
    expect(result.refusals).toStrictEqual([]);
  });

  it('throws when the door refuses the reading of a stored proposal, and asks nothing more', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [ENTRY] } }]);
    const recorded = toolsOf({ readingRefuses: 'the page does not exist' });
    const run = makeExtractor(CONFIG, { tools: recorded.tools }).run(scripted.context);

    await expect(run).rejects.toThrow(/the page does not exist/u);
    await expect(run).rejects.not.toBeInstanceOf(JobStop);
    expect(scripted.asked).toHaveLength(1);
  });
});

describe('the stops of a job', () => {
  it('stops with turn_cap when the model never gives a value', async () => {
    const lookups = Array.from({ length: 10 }, (): Reply => ({
      kind: 'call',
      name: 'lookup_entity',
      input: { key: 'imo', value: '9876543' },
    }));
    const scripted = contextOf(lookups);
    const run = makeExtractor(CONFIG, { tools: toolsOf().tools }).run(scripted.context);

    await expect(run).rejects.toStrictEqual(new JobStop('turn_cap'));
    expect(scripted.asked).toHaveLength(CONFIG.turnCap);
  });

  it('stops with usage_cap when the token cap of the job is spent', async () => {
    const spent = new ModelFailure({ kind: REASON.overCap, reason: 'spent', attempts: 1 });
    const scripted = contextOf([spent]);
    await expect(
      makeExtractor(CONFIG, { tools: toolsOf().tools }).run(scripted.context),
    ).rejects.toStrictEqual(new JobStop('usage_cap'));
  });

  it('gives another failure of the model to the runner as it is', async () => {
    const down = new ModelFailure({ kind: REASON.network, reason: 'down', attempts: 4 });
    const scripted = contextOf([down]);
    await expect(
      makeExtractor(CONFIG, { tools: toolsOf().tools }).run(scripted.context),
    ).rejects.toBe(down);
  });

  it('stops with no_text when the document holds no text', async () => {
    const scripted = contextOf([], []);
    await expect(
      makeExtractor(CONFIG, { tools: toolsOf().tools }).run(scripted.context),
    ).rejects.toStrictEqual(new JobStop('no_text'));
  });
});

describe('the key of a claim', () => {
  const keyOf = contextOf([]).context.keyOf;
  const base = {
    keyOf,
    chunkHash: 'b'.repeat(64),
    servedModel: MODEL,
    inputForm: 'text',
    promptHash: 'c'.repeat(64),
    entry: ENTRY,
  };

  it('is the same for the same inputs', () => {
    expect(claimKeyOf(base)).toBe(claimKeyOf({ ...base }));
  });

  it('changes with the input form, the served model and the prompt', () => {
    const first = claimKeyOf(base);
    expect(claimKeyOf({ ...base, inputForm: 'image' })).not.toBe(first);
    expect(claimKeyOf({ ...base, servedModel: 'a-family/another' })).not.toBe(first);
    expect(claimKeyOf({ ...base, promptHash: 'd'.repeat(64) })).not.toBe(first);
  });

  it('changes when one byte of the prompt changes', async () => {
    const keys: string[] = [];
    for (const prompt of ['Read the chunk.', 'Read the chunk!']) {
      const scripted = contextOf([{ kind: 'value', value: { claims: [ENTRY] } }]);
      const recorded = toolsOf();
      await makeExtractor(CONFIG, { tools: recorded.tools, prompt }).run(scripted.context);
      keys.push((recorded.proposed[0] as { idempotencyKey: string }).idempotencyKey);
    }
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('differs for two claims of one chunk', () => {
    expect(claimKeyOf({ ...base, entry: { ...ENTRY, start: 1 } })).not.toBe(claimKeyOf(base));
  });
});
