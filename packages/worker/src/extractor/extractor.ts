import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { REASON, type Message, type Tool as ModelTool } from '@gab/model';
import { documentText } from '@gab/tools/document-text';
import { lookupEntity } from '@gab/tools/lookup-entity';
import { proposeChange } from '@gab/tools/propose-change';
import { putClaimReading } from '@gab/tools/put-claim-reading';
import { chunkAnswer, claimEntry, type ClaimEntry } from '@gab/tools/reading';
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
import { chunkPages, codePoints, type Chunk } from '../chunk.ts';
import type { ReaderConfig } from '../reader-config.ts';

/** The reader id of the first reader. The key of each of its acts holds it. */
export const EXTRACTOR_NAME = 'extractor';
const VERSION = 'v1';
const INPUT_FORM = 'text';

/** The four tools of the profile. A test gives a stub for each one. */
export interface ExtractorTools {
  readonly documentText: Tool;
  readonly lookupEntity: Tool;
  readonly proposeChange: Tool;
  readonly putClaimReading: Tool;
}

export interface ExtractorOptions {
  /** Replaces personal data with placeholders of the same length. With none, no model reads a
   * stored document, and each job stops. */
  readonly minimise?: (text: string) => string;
  readonly tools?: ExtractorTools;
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
}

const DEFAULT_TOOLS: ExtractorTools = {
  documentText,
  lookupEntity,
  proposeChange,
  putClaimReading,
};

// The newest set of text, as the read tool chooses it, because an older set is a reading that a
// newer one replaced.
const PAGES = `WITH chosen AS (
    SELECT t.extractor FROM public.document_text t
     WHERE t.document_id = $1::text
     ORDER BY t.created_at DESC, t.extractor DESC LIMIT 1)
  SELECT t.extractor, t.page::int AS page, t.text
    FROM chosen c
    JOIN public.document_text t ON t.document_id = $1::text AND t.extractor = c.extractor
   ORDER BY t.page`;

const pageRows = z.array(
  z.object({ extractor: z.string(), page: z.number().int(), text: z.string() }),
);

const proposed = z.object({ proposalId: z.uuid() });

// One claim that the boundary refused goes back alone, so the model answers for that claim.
const retryAnswer = z.strictObject({ claim: claimEntry });

const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

// The order of the keys of an object is not part of a claim, so the key of a claim sorts them.
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([name, held]) => [name, canonical(held)]),
  );
};

export interface ClaimKeyParts {
  readonly keyOf: AgentContext['keyOf'];
  readonly chunkHash: string;
  readonly servedModel: string;
  readonly inputForm: string;
  readonly promptHash: string;
  readonly entry: unknown;
}

/** The key of one claim: the key of its chunk with the claim itself. A chunk gives more than one
 * claim, and the key of the chunk alone would join every claim of it to the first proposal. */
export const claimKeyOf = (parts: ClaimKeyParts): string =>
  sha256(
    JSON.stringify([
      parts.keyOf({
        chunkHash: parts.chunkHash,
        servedModel: parts.servedModel,
        inputForm: parts.inputForm,
        promptHash: parts.promptHash,
      }),
      canonical(parts.entry),
    ]),
  );

const promptBytes = (given: string | undefined): Buffer =>
  given === undefined
    ? readFileSync(new URL('./prompt.md', import.meta.url))
    : Buffer.from(given, 'utf8');

/** The first reader. It reads each chunk of the newest text of a document, and code proposes each
 * claim that the model gives and stores where the page states it. The model writes nothing. */
export const makeExtractor = (
  config: ReaderConfig,
  options: ExtractorOptions = {},
): RunnerAgent => {
  const tools = options.tools ?? DEFAULT_TOOLS;
  const bytes = promptBytes(options.prompt);
  const prompt = bytes.toString('utf8');
  const promptHash = sha256(bytes);

  // The model reads and looks up. A call to any other tool is refused, and the two writes are
  // made by code alone.
  const offered = new Map(
    [tools.documentText, tools.lookupEntity].map((tool) => [tool.name, tool]),
  );
  const modelTools: ModelTool[] = [...offered.values()].map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: tool.input,
  }));

  const run = async (context: AgentContext): Promise<AgentResult> => {
    // The gate stands before any read, so with no minimiser the stored text reaches no model.
    const minimise = options.minimise;
    if (minimise === undefined) throw new JobStop('no_minimiser');

    const session: Session = { query: (text, values) => context.db.query(text, values) };
    const refusals: Refusal[] = [];
    let turns = 0;

    const ask = async <T>(
      messages: readonly Message[],
      shape: z.ZodType<T>,
      withTools: boolean,
    ): Promise<Asked<T>> => {
      if (turns >= config.turnCap) throw new JobStop('turn_cap');
      turns += 1;
      try {
        return await context.ask({ messages, shape, ...(withTools ? { tools: modelTools } : {}) });
      } catch (cause) {
        if (cause instanceof ModelFailure && cause.failure.kind === REASON.overCap)
          throw new JobStop('usage_cap');
        throw cause;
      }
    };

    // Every text from the store, from a tool or from the model goes through the minimiser before
    // a model reads it. The fixed prompt and the framing that code writes do not.
    const answerCall = async (call: {
      readonly id: string;
      readonly name: string;
      readonly input: unknown;
    }): Promise<Message[]> => {
      const tool = offered.get(call.name);
      let content: string;
      if (tool === undefined) {
        const reason = `the tool ${call.name} is not offered to this model, and code runs the writes`;
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
              function: { name: call.name, arguments: minimise(JSON.stringify(call.input ?? {})) },
            },
          ],
        },
        { role: 'tool', tool_call_id: call.id, content: minimise(content) },
      ];
    };

    const spanFault = (chunk: Chunk, entry: ClaimEntry): string | null => {
      const length = codePoints(chunk.text);
      if (entry.page === chunk.page && entry.end <= length) return null;
      return (
        `the span ${String(entry.start)} to ${String(entry.end)} on page ${String(entry.page)} ` +
        `lies outside the chunk, which is page ${String(chunk.page)} and holds ` +
        `${String(length)} code points`
      );
    };

    // The span check and a refusal of the proposal go back to the model, once. A refusal of the
    // reading comes after a stored proposal, so it is a fault of code: it throws, and the next
    // claim of the job finds the same proposal by its key and writes the reading then.
    const settle = async (
      chunk: Chunk,
      textSet: string,
      entry: ClaimEntry,
      asked: { readonly callId: string; readonly served: string },
      conversation: readonly Message[],
      retries: number,
    ): Promise<void> => {
      let fault = spanFault(chunk, entry);
      if (fault === null) {
        const key = claimKeyOf({
          keyOf: context.keyOf,
          chunkHash: chunk.hash,
          servedModel: asked.served,
          inputForm: INPUT_FORM,
          promptHash,
          entry,
        });
        const made = await callTool(tools.proposeChange, session, {
          act: entry.act,
          documents: [context.job.documentId],
          modelCallId: asked.callId,
          idempotencyKey: key,
        });
        if (made.ok) {
          const { proposalId } = proposed.parse(made.output);
          const read = await callTool(tools.putClaimReading, session, {
            job: context.job.id,
            claim: proposalId,
            textExtractor: textSet,
            page: chunk.page,
            start: chunk.start + entry.start,
            end: chunk.start + entry.end,
            modality: entry.modality,
            ...(entry.adverse === true ? { adverse: true } : {}),
            modelCallId: asked.callId,
            inputForm: INPUT_FORM,
            readerFingerprint: `${asked.served} ${promptHash}`,
            chunkHash: chunk.hash,
            idempotencyKey: key,
          });
          if (!read.ok)
            throw new Error(
              `the door refused the reading of proposal ${proposalId}: ${read.refusal}`,
            );
          return;
        }
        fault = made.refusal;
      }

      if (retries === 0) {
        refusals.push({ tool: tools.proposeChange.name, reason: fault });
        return;
      }
      const again = await ask(
        [
          ...conversation,
          {
            role: 'user',
            content: minimise(
              `The boundary refuses this claim: ${JSON.stringify(entry)}. The fault: ${fault}. ` +
                'Give this one claim again, corrected, as {"claim": {...}}.',
            ),
          },
        ],
        retryAnswer,
        false,
      );
      if (again.kind === 'call') {
        refusals.push({
          tool: again.call.name,
          reason: 'a tool call came back where a claim was asked',
        });
        return;
      }
      await settle(chunk, textSet, again.value.claim, again, conversation, retries - 1);
    };

    const readChunk = async (chunk: Chunk, textSet: string): Promise<void> => {
      const text = minimise(chunk.text);
      if (codePoints(text) !== codePoints(chunk.text)) throw new JobStop('minimiser_length');

      const messages: Message[] = [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: JSON.stringify({ document: context.job.documentId, page: chunk.page, text }),
        },
      ];
      for (;;) {
        // A copy, so the question that was asked keeps the messages it held at that time.
        const asked = await ask([...messages], chunkAnswer, true);
        if (asked.kind === 'call') {
          messages.push(...(await answerCall(asked.call)));
          continue;
        }
        const conversation: Message[] = [
          ...messages,
          { role: 'assistant', content: minimise(JSON.stringify(asked.value)) },
        ];
        for (const entry of asked.value.claims)
          await settle(chunk, textSet, entry, asked, conversation, 1);
        return;
      }
    };

    const pages = pageRows.parse((await context.db.query(PAGES, [context.job.documentId])).rows);
    const textSet = pages[0]?.extractor;
    if (textSet === undefined) throw new JobStop('no_text');

    for (const chunk of chunkPages(pages, config.chunkCap)) await readChunk(chunk, textSet);
    return { refusals };
  };

  return {
    name: EXTRACTOR_NAME,
    version: VERSION,
    kind: 'extract_text',
    settings: config.model,
    // Each question of the job counts one turn, so the cap is the most questions of one job.
    questionsPerJob: config.turnCap,
    tokenCap: config.tokenCap,
    run,
  };
};
