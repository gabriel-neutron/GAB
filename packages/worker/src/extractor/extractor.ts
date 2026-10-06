import { readFileSync } from 'node:fs';

import { REASON, type Message, type Tool as ModelTool, type ToolUse } from '@gab/model';
import { documentText } from '@gab/tools/document-text';
import { proposeItem, proposeOfCall } from '@gab/tools/propose';
import { searchGraph } from '@gab/tools/search-graph';
import { callTool, type ItemToCheck, type Session, type Tool } from '@gab/tools/tool';
import { z } from 'zod';

import {
  JobStop,
  ModelFailure,
  type AgentContext,
  type AgentResult,
  type Asked,
  type Refusal,
  type RunnerAgent,
} from '../agents.ts';
import { chunkPages, type Chunk } from '../chunk.ts';
import { readNewestPages } from '../pages.ts';
import type { ReaderConfig } from '../reader-config.ts';

/** The name of the extractor in the record of each of its model calls. */
export const EXTRACTOR_NAME = 'extractor';
const VERSION = 'v3';

/** The tools of the extractor. A test gives a stub for each one. The propose tool names the
 * model call that gave the batch. */
export interface ExtractorTools {
  readonly documentText: Tool;
  readonly searchGraph: Tool;
  readonly propose: (modelCallId: string) => Tool;
}

export interface ExtractorOptions {
  readonly tools?: ExtractorTools;
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
  /** The text of the prompt of the checker. The default is the versioned file beside this one. */
  readonly checkPrompt?: string;
}

const DEFAULT_TOOLS: ExtractorTools = { documentText, searchGraph, propose: proposeOfCall };

// The answer of the model is the batch that the propose tool takes, so the research AI and the
// extractor give one shape. An empty list is a chunk that states no claim.
const chunkAnswer = z.strictObject({ items: z.array(proposeItem) });

// The checker gives one verdict for each item. Only `supported` lets an item stand undisputed.
const checkAnswer = z.strictObject({
  verdicts: z.array(
    z.strictObject({
      ref: z.string(),
      verdict: z.enum(['supported', 'not_supported', 'unclear']),
    }),
  ),
});

const promptOf = (given: string | undefined, file: string): string =>
  given ?? readFileSync(new URL(file, import.meta.url), 'utf8');

// Items that cite the same passages go to the checker in one question.
const byPassage = (items: readonly ItemToCheck[]): ItemToCheck[][] => {
  const groups = new Map<string, ItemToCheck[]>();
  for (const item of items) {
    const key = JSON.stringify(item.passages);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
};

/** The extractor. It reads each chunk of the newest text of a document, and code proposes the
 * batch that the model gives through the same tool as the research AI. Before the write, a model
 * of another family checks each item against its passage. The models write nothing. */
export const makeExtractor = (
  config: ReaderConfig,
  options: ExtractorOptions = {},
): RunnerAgent => {
  const tools = options.tools ?? DEFAULT_TOOLS;
  const prompt = promptOf(options.prompt, './prompt.md');
  const checkPrompt = promptOf(options.checkPrompt, './check-prompt.md');

  // The model reads and looks up. A call to any other tool is refused, and the write is made by
  // code alone.
  const offered = new Map([tools.documentText, tools.searchGraph].map((tool) => [tool.name, tool]));
  const modelTools: ModelTool[] = [...offered.values()].map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: tool.input,
  }));

  const run = async (context: AgentContext): Promise<AgentResult> => {
    const { job } = context;
    if (job.kind !== 'extract_text') throw new JobStop(`the extractor runs no job of ${job.kind}`);
    const session: Session = { query: (text, values) => context.db.query(text, values) };
    const refusals: Refusal[] = [];
    let turns = 0;

    const ask = async (
      messages: readonly Message[],
    ): Promise<Asked<z.output<typeof chunkAnswer>>> => {
      if (turns >= config.turnCap) throw new JobStop('turn_cap');
      turns += 1;
      try {
        // A copy, so the question that was asked keeps the messages it held at that time.
        return await context.ask(config.reader, {
          messages: [...messages],
          shape: chunkAnswer,
          tools: modelTools,
        });
      } catch (cause) {
        if (cause instanceof ModelFailure && cause.failure.kind === REASON.overCap)
          throw new JobStop('usage_cap');
        throw cause;
      }
    };

    const answerCall = async (call: ToolUse): Promise<Message[]> => {
      const tool = offered.get(call.name);
      let content: string;
      if (tool === undefined) {
        const reason = `the tool ${call.name} is not offered to this model, and code runs the write`;
        refusals.push({ tool: call.name, reason });
        content = reason;
      } else {
        const outcome = await callTool(tool, session, call.input);
        content = outcome.ok
          ? JSON.stringify(outcome.output)
          : `The tool refused the call: ${outcome.refusal}`;
      }
      return [
        { role: 'assistant', call },
        { role: 'tool', call, content },
      ];
    };

    // A model of another family reads each item with its passage. A checker that fails gives no
    // verdict, and each item of its question is then written as disputed: a failure never drops
    // an item.
    const checkGroup = async (group: readonly ItemToCheck[]): Promise<string[]> => {
      const refs = group.map((item) => item.ref);
      let asked: Asked<z.output<typeof checkAnswer>>;
      try {
        asked = await context.ask(config.checker, {
          messages: [
            { role: 'system', content: checkPrompt },
            {
              role: 'user',
              content: JSON.stringify({
                passages: group[0]?.passages ?? [],
                claims: group.map((item) => ({ ref: item.ref, ...item.claim })),
              }),
            },
          ],
          shape: checkAnswer,
        });
      } catch (cause) {
        if (cause instanceof ModelFailure) return [];
        throw cause;
      }
      if (asked.kind !== 'value') return [];
      const { verdicts } = asked.value;
      // One verdict for each item. A second verdict on one item makes it unclear.
      return refs.filter((ref) => {
        const said = verdicts.filter((one) => one.ref === ref);
        return said.length === 1 && said[0]?.verdict === 'supported';
      });
    };

    const check = async (items: readonly ItemToCheck[]): Promise<ReadonlySet<string>> => {
      const supported = new Set<string>();
      for (const group of byPassage(items))
        for (const ref of await checkGroup(group)) supported.add(ref);
      return supported;
    };

    // The model answers with the batch of one chunk. A refusal of the batch goes back to the
    // model once, with the sentence of the tool, and the model gives the whole batch again.
    const readChunk = async (chunk: Chunk): Promise<void> => {
      const messages: Message[] = [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: JSON.stringify({
            document: job.documentId,
            page: chunk.page,
            text: chunk.text,
          }),
        },
      ];
      let retries = 1;
      for (;;) {
        const asked = await ask(messages);
        if (asked.kind === 'call') {
          messages.push(...(await answerCall(asked.call)));
          continue;
        }
        if (asked.value.items.length === 0) return;
        const proposer = tools.propose(asked.callId);
        const made = await callTool(
          proposer,
          session,
          { items: asked.value.items },
          { now: () => new Date(), check },
        );
        if (made.ok) return;
        if (retries === 0) {
          refusals.push({ tool: proposer.name, reason: made.refusal });
          return;
        }
        retries -= 1;
        messages.push(
          { role: 'assistant', content: JSON.stringify(asked.value) },
          {
            role: 'user',
            content:
              `The tool refused the batch: ${made.refusal}. Give the whole answer again, ` +
              'corrected, in the same shape.',
          },
        );
      }
    };

    const newest = await readNewestPages(context.db, job.documentId);
    if (newest === null) throw new JobStop('no_text');

    for (const chunk of chunkPages(newest, config.chunkCap)) await readChunk(chunk);
    return { refusals };
  };

  return {
    name: EXTRACTOR_NAME,
    version: VERSION,
    kind: 'extract_text',
    models: [config.reader, config.checker],
    tokenCap: config.tokenCap,
    run,
  };
};
