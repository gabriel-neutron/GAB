import { readFileSync } from 'node:fs';

import { REASON, type Message, type Tool as ModelTool } from '@gab/model';
import { documentText } from '@gab/tools/document-text';
import { lookupEntity } from '@gab/tools/lookup-entity';
import { propose, proposeItem } from '@gab/tools/propose';
import { callTool, type Session, type Tool } from '@gab/tools/tool';
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
const VERSION = 'v2';

/** The three tools of the profile. A test gives a stub for each one. */
export interface ExtractorTools {
  readonly documentText: Tool;
  readonly lookupEntity: Tool;
  readonly propose: Tool;
}

export interface ExtractorOptions {
  readonly tools?: ExtractorTools;
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
}

const DEFAULT_TOOLS: ExtractorTools = { documentText, lookupEntity, propose };

// The answer of the model is the batch that the propose tool takes, so the research AI and the
// extractor give one shape. An empty list is a chunk that states no claim.
const chunkAnswer = z.strictObject({ items: z.array(proposeItem) });

const promptOf = (given: string | undefined): string =>
  given ?? readFileSync(new URL('./prompt.md', import.meta.url), 'utf8');

/** The extractor. It reads each chunk of the newest text of a document, and code proposes the
 * batch that the model gives through the same tool as the research AI. The model writes nothing. */
export const makeExtractor = (
  config: ReaderConfig,
  options: ExtractorOptions = {},
): RunnerAgent => {
  const tools = options.tools ?? DEFAULT_TOOLS;
  const prompt = promptOf(options.prompt);

  // The model reads and looks up. A call to any other tool is refused, and the write is made by
  // code alone.
  const offered = new Map(
    [tools.documentText, tools.lookupEntity].map((tool) => [tool.name, tool]),
  );
  const modelTools: ModelTool[] = [...offered.values()].map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: tool.input,
  }));

  const run = async (context: AgentContext): Promise<AgentResult> => {
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
        return await context.ask({
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

    const answerCall = async (call: {
      readonly id: string;
      readonly name: string;
      readonly input: unknown;
    }): Promise<Message[]> => {
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
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: call.id,
              type: 'function',
              function: { name: call.name, arguments: JSON.stringify(call.input ?? {}) },
            },
          ],
        },
        { role: 'tool', tool_call_id: call.id, content },
      ];
    };

    // The model answers with the batch of one chunk. A refusal of the batch goes back to the
    // model once, with the sentence of the tool, and the model gives the whole batch again.
    const readChunk = async (chunk: Chunk): Promise<void> => {
      const messages: Message[] = [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: JSON.stringify({
            document: context.job.documentId,
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
        const made = await callTool(tools.propose, session, {
          items: asked.value.items,
          modelCallId: asked.callId,
        });
        if (made.ok) return;
        if (retries === 0) {
          refusals.push({ tool: tools.propose.name, reason: made.refusal });
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

    const newest = await readNewestPages(context.db, context.job.documentId);
    if (newest === null) throw new JobStop('no_text');

    for (const chunk of chunkPages(newest, config.chunkCap)) await readChunk(chunk);
    return { refusals };
  };

  return {
    name: EXTRACTOR_NAME,
    version: VERSION,
    kind: 'extract_text',
    settings: config.model,
    tokenCap: config.tokenCap,
    run,
  };
};
