import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

import { REASON, type Question } from '@gab/model';
import { PROFILES } from '@gab/tools/profiles';
import { putClaimReading } from '@gab/tools/put-claim-reading';
import { ToolRefusal } from '@gab/tools/tool';
import { describe, expect, it } from 'vitest';

import { JobStop, ModelFailure, type AgentContext, type Asked } from '../agents.ts';
import { idempotencyKey } from '../idempotency.ts';
import type { Minimiser } from '../minimise.ts';
import type { ReaderConfig } from '../reader-config.ts';
import { makeReader2, READER2_NAME, READER2_RELEASE, type Reader2Tools } from './reader2.ts';

const DOC = 'doc_reader2_unit';
const JOB = '6c5d4e3f-2a1b-4c0d-9e8f-7a6b5c4d3e2f';
const CALL = '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e';
const READING = '4a3b2c1d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const MODEL = 'b-family/b-model';
const PAGE = 'Nayara sailed from Sikka. MARKER owns it.';

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
  family: 'b-family',
  tokenCap: 10_000,
  turnCap: 6,
  chunkCap: 1000,
};

const ENTRY = { page: 1, start: 0, end: 6, modality: 'asserts' };

// A minimiser that keeps the length and replaces the marker, so the test can see where it ran.
const hide: Minimiser = {
  version: 'test-minimiser',
  apply: (text) => text.replaceAll('MARKER', '######'),
};

// A minimiser that adds one character, so the length check of the reader stops the job.
const longer: Minimiser = { version: 'test-minimiser', apply: (text) => `${text}x` };

const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

type Reply = { kind: 'value'; value: unknown } | { kind: 'call'; name: string; input: unknown };

interface Scripted {
  readonly context: AgentContext;
  readonly asked: Question<unknown>[];
  readonly queries: string[];
}

// The scripted model stub: each ask takes the next reply, and an ask past the script fails. The
// stub database answers the check of a chunk that is done with `done`, and every other read with
// the pages.
const contextOf = (
  replies: readonly (Reply | Error)[],
  pages: readonly { page: number; text: string }[] = [{ page: 1, text: PAGE }],
  done = false,
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
      job: { id: JOB, documentId: DOC, attempt: 1, kind: 'second_read' },
      db: {
        query: (text: string) => {
          queries.push(text);
          if (text.includes('second_read_done')) return Promise.resolve({ rows: [{ done }] });
          return Promise.resolve({
            rows: pages.map((page) => ({ extractor: 'pdf@1', page: page.page, text: page.text })),
          });
        },
      },
      ask,
      keyOf: (parts) =>
        idempotencyKey({ ...parts, documentId: DOC, readerId: `${READER2_NAME}@v1` }),
    },
  };
};

interface Recorded {
  readonly tools: Reader2Tools;
  readonly read: unknown[];
}

const toolsOf = (refuses?: string): Recorded => {
  const read: unknown[] = [];
  return {
    read,
    tools: {
      putClaimReading: {
        ...putClaimReading,
        run: (_session, input) => {
          read.push(input);
          if (refuses !== undefined) throw new ToolRefusal(refuses);
          return Promise.resolve({ readingId: READING });
        },
      },
    },
  };
};

const textsOf = (question: Question<unknown> | undefined): string =>
  (question?.messages ?? []).map((message) => message.content).join('\n');

describe('the gate of the minimiser', () => {
  it('reads nothing and asks nothing with no minimiser, and the job stops with no_minimiser', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [] } }]);
    const agent = makeReader2(CONFIG, { tools: toolsOf().tools });

    await expect(agent.run(scripted.context)).rejects.toStrictEqual(new JobStop('no_minimiser'));
    expect(scripted.asked).toHaveLength(0);
    expect(scripted.queries).toHaveLength(0);
  });

  it('stops with minimiser_length when the minimiser changes the length', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [] } }]);
    const agent = makeReader2(CONFIG, { minimise: longer, tools: toolsOf().tools });

    await expect(agent.run(scripted.context)).rejects.toStrictEqual(
      new JobStop('minimiser_length'),
    );
    expect(scripted.asked).toHaveLength(0);
  });

  it('passes the chunk through the minimiser before the model reads it', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [] } }]);
    await makeReader2(CONFIG, { minimise: hide, tools: toolsOf().tools }).run(scripted.context);

    expect(textsOf(scripted.asked[0])).toContain('######');
    expect(textsOf(scripted.asked[0])).not.toContain('MARKER');
  });
});

describe('what the model of the second reader gets', () => {
  it('asks each question with no tool, so no tool runs for the model', async () => {
    const scripted = contextOf(
      [
        { kind: 'value', value: { claims: [] } },
        { kind: 'value', value: { claims: [] } },
      ],
      [{ page: 1, text: 'abcdefghij' }],
    );
    await makeReader2({ ...CONFIG, chunkCap: 6 }, { minimise: hide, tools: toolsOf().tools }).run(
      scripted.context,
    );

    expect(scripted.asked).toHaveLength(2);
    for (const question of scripted.asked) expect(question.tools).toBeUndefined();
  });

  it('builds the input from the prompt file and the chunk alone', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [] } }]);
    await makeReader2(CONFIG, { minimise: hide, tools: toolsOf().tools }).run(scripted.context);

    const prompt = readFileSync(new URL('./prompt.md', import.meta.url), 'utf8');
    expect(scripted.asked[0]?.messages).toStrictEqual([
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify({ document: DOC, page: 1, text: hide.apply(PAGE) }) },
    ]);
  });

  it('runs no tool for a tool call that comes back, and writes nothing for it', async () => {
    const scripted = contextOf([
      { kind: 'call', name: 'document_text', input: { document: 'doc_another' } },
    ]);
    const recorded = toolsOf();
    const result = await makeReader2(CONFIG, { minimise: hide, tools: recorded.tools }).run(
      scripted.context,
    );

    expect(recorded.read).toHaveLength(0);
    expect(scripted.asked).toHaveLength(1);
    expect(result.refusals).toStrictEqual([
      { tool: 'document_text', reason: expect.stringMatching(/no tool/u) as unknown },
    ]);
  });

  it('the prompt asks for no act and no lookup', () => {
    const prompt = readFileSync(new URL('./prompt.md', import.meta.url), 'utf8');
    expect(prompt).not.toMatch(/lookup_entity|"act"|`act`/u);
  });
});

describe('a reading of the model', () => {
  it('is stored with no claim, offsets in the page, and the pinned model in the fingerprint', async () => {
    const scripted = contextOf(
      [
        { kind: 'value', value: { claims: [] } },
        { kind: 'value', value: { claims: [{ ...ENTRY, start: 1, end: 3, adverse: true }] } },
      ],
      [{ page: 1, text: 'abcdefghij' }],
    );
    const recorded = toolsOf();
    await makeReader2({ ...CONFIG, chunkCap: 6 }, { minimise: hide, tools: recorded.tools }).run(
      scripted.context,
    );

    const promptHash = sha256(readFileSync(new URL('./prompt.md', import.meta.url)));
    expect(recorded.read).toStrictEqual([
      {
        job: JOB,
        textExtractor: 'pdf@1',
        page: 1,
        start: 7,
        end: 9,
        modality: 'asserts',
        adverse: true,
        modelCallId: CALL,
        inputForm: 'text',
        readerFingerprint: `${MODEL} ${promptHash}`,
        chunkHash: expect.stringMatching(/^[0-9a-f]{64}$/u) as unknown,
        idempotencyKey: expect.stringMatching(/^[0-9a-f]{64}$/u) as unknown,
        modelFamily: CONFIG.family,
      },
    ]);
  });

  it('is refused in code when its span lies outside the chunk, and the model is not asked again', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [{ ...ENTRY, end: 900 }] } }]);
    const recorded = toolsOf();
    const result = await makeReader2(CONFIG, { minimise: hide, tools: recorded.tools }).run(
      scripted.context,
    );

    expect(scripted.asked).toHaveLength(1);
    expect(recorded.read).toHaveLength(0);
    expect(result.refusals).toStrictEqual([
      { tool: 'put_claim_reading', reason: expect.stringMatching(/outside the chunk/u) as unknown },
    ]);
  });

  it('is kept as a refusal when the door refuses it, and the model is not asked again', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [ENTRY] } }]);
    const recorded = toolsOf('the page does not exist');
    const result = await makeReader2(CONFIG, { minimise: hide, tools: recorded.tools }).run(
      scripted.context,
    );

    expect(scripted.asked).toHaveLength(1);
    expect(result.refusals).toStrictEqual([
      { tool: 'put_claim_reading', reason: 'the page does not exist' },
    ]);
  });

  it('gives two readings of one chunk two keys', async () => {
    const scripted = contextOf([
      { kind: 'value', value: { claims: [ENTRY, { ...ENTRY, start: 7, end: 12 }] } },
    ]);
    const recorded = toolsOf();
    await makeReader2(CONFIG, { minimise: hide, tools: recorded.tools }).run(scripted.context);

    const keys = (recorded.read as { idempotencyKey: string }[]).map((row) => row.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
  });

  it('gets a new fingerprint and a new key when one byte of the prompt changes', async () => {
    const seen: { readerFingerprint: string; idempotencyKey: string }[] = [];
    for (const prompt of ['Read the chunk.', 'Read the chunk!']) {
      const scripted = contextOf([{ kind: 'value', value: { claims: [ENTRY] } }]);
      const recorded = toolsOf();
      await makeReader2(CONFIG, { minimise: hide, tools: recorded.tools, prompt }).run(
        scripted.context,
      );
      seen.push(recorded.read[0] as { readerFingerprint: string; idempotencyKey: string });
    }
    expect(seen[0]?.readerFingerprint).not.toBe(seen[1]?.readerFingerprint);
    expect(seen[0]?.idempotencyKey).not.toBe(seen[1]?.idempotencyKey);
  });
});

describe('a chunk that the second reader already read', () => {
  it('is asked of no model and gives no write', async () => {
    const scripted = contextOf([{ kind: 'value', value: { claims: [ENTRY] } }], undefined, true);
    const recorded = toolsOf();
    await makeReader2(CONFIG, { minimise: hide, tools: recorded.tools }).run(scripted.context);

    expect(scripted.asked).toHaveLength(0);
    expect(recorded.read).toHaveLength(0);
  });
});

describe('the stops of a job', () => {
  it('stops with usage_cap when the token cap of the job is spent', async () => {
    const spent = new ModelFailure({ kind: REASON.overCap, reason: 'spent', attempts: 1 });
    await expect(
      makeReader2(CONFIG, { minimise: hide, tools: toolsOf().tools }).run(
        contextOf([spent]).context,
      ),
    ).rejects.toStrictEqual(new JobStop('usage_cap'));
  });

  it('gives an outage of the model to the runner as it is', async () => {
    const down = new ModelFailure({ kind: REASON.network, reason: 'down', attempts: 4 });
    await expect(
      makeReader2(CONFIG, { minimise: hide, tools: toolsOf().tools }).run(
        contextOf([down]).context,
      ),
    ).rejects.toBe(down);
  });

  it('stops with no_text when the document holds no text', async () => {
    await expect(
      makeReader2(CONFIG, { minimise: hide, tools: toolsOf().tools }).run(
        contextOf([], []).context,
      ),
    ).rejects.toStrictEqual(new JobStop('no_text'));
  });
});

describe('the agent and its profile', () => {
  it('is the second reader of the kind second_read, and it releases on the three failures', () => {
    const agent = makeReader2(CONFIG, { minimise: hide });
    expect(agent.name).toBe('reader2');
    expect(agent.version).toBe('v1');
    expect(agent.kind).toBe('second_read');
    expect(agent.releaseOn).toStrictEqual(READER2_RELEASE);
    expect(READER2_RELEASE).toStrictEqual({
      network: 'outage',
      quota: 'quota',
      served_other: 'model_mismatch',
    });
  });

  it('holds document_text and put_claim_reading, and no tool that reads a proposal or a reading', () => {
    expect(PROFILES.reader2).toStrictEqual(['document_text', 'put_claim_reading']);
    for (const name of PROFILES.reader2) expect(name).not.toMatch(/proposal|propose|reading_read/u);
  });
});

// The queue and the public read must not see the readings, so a disagreement of two readers
// moves no proposal up the queue and reaches no public view.
describe('the readings stay out of the queue and of the public read', () => {
  const root = new URL('../../../../', import.meta.url);
  const review = readdirSync(new URL('src/features/review/', root))
    .filter((name) => /\.tsx?$/u.test(name))
    .map((name) => `src/features/review/${name}`);
  const files = [...review, 'db/apply/20_views.sql', 'db/apply/00_api.sql'];

  it('reads the queue module', () => {
    expect(files).toContain('src/features/review/queue.ts');
  });

  for (const file of files)
    it(`${file} does not name claim_reading`, () => {
      expect(readFileSync(new URL(file, root), 'utf8')).not.toContain('claim_reading');
    });
});
