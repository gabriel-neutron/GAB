import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { REASON, type Message } from '@gab/model';
import { putClaimReading } from '@gab/tools/put-claim-reading';
import { readerTwoAnswer, type readerTwoEntry } from '@gab/tools/reading';
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
import { claimKeyOf } from '../extractor/extractor.ts';
import { readNewestPages } from '../pages.ts';
import type { ReaderConfig } from '../reader-config.ts';

/** The reader id of the second reader. The key of each of its readings holds it. */
export const READER2_NAME = 'reader2';
const VERSION = 'v1';
const INPUT_FORM = 'text';

/** The failures of the second family that return the job to the queue. The reader never falls back
 * to another model, so a job that its own model cannot read waits for that model. */
export const READER2_RELEASE = {
  [REASON.network]: 'outage',
  [REASON.quota]: 'quota',
  [REASON.servedOther]: 'model_mismatch',
} as const;

/** The one write of the second reader. A test gives a stub for it. */
export interface Reader2Tools {
  readonly putClaimReading: Tool;
}

export interface Reader2Options {
  /** Replaces personal data with placeholders of the same length. With none, no model reads a
   * stored document, and each job stops. */
  readonly minimise?: (text: string) => string;
  readonly tools?: Reader2Tools;
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
}

const DEFAULT_TOOLS: Reader2Tools = { putClaimReading };

// The check is a read that answers yes or no, and it refuses a job that the caller does not hold.
const DONE = 'SELECT public.second_read_done($1::uuid, $2::text, $3::text, $4::text) AS done';

const doneRow = z.array(z.object({ done: z.boolean() })).length(1);

type Reading = z.output<typeof readerTwoEntry>;

const sha256 = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');

const promptBytes = (given: string | undefined): Buffer =>
  given === undefined
    ? readFileSync(new URL('./prompt.md', import.meta.url))
    : Buffer.from(given, 'utf8');

/** The second, blind reader. It reads each chunk of the newest text of a document and stores where
 * each claim stands. Its input is the prompt and the chunk, and nothing of the first reader. */
export const makeReader2 = (config: ReaderConfig, options: Reader2Options = {}): RunnerAgent => {
  const tools = options.tools ?? DEFAULT_TOOLS;
  const bytes = promptBytes(options.prompt);
  const prompt = bytes.toString('utf8');
  const promptHash = sha256(bytes);
  // The pinned model is known before the call, so the check of a chunk that is done and the key of
  // a reading can be made before the model is asked. The client refuses a served model that is not
  // the pinned one, so a stored reading always comes from this model.
  const pinned = config.model.model;
  const fingerprint = `${pinned} ${promptHash}`;

  const run = async (context: AgentContext): Promise<AgentResult> => {
    // The gate stands before any read, so with no minimiser the stored text reaches no model.
    const minimise = options.minimise;
    if (minimise === undefined) throw new JobStop('no_minimiser');

    const session: Session = { query: (text, values) => context.db.query(text, values) };
    const refusals: Refusal[] = [];
    let turns = 0;

    // The question offers no tool. The client reads a tool call on such a question as an answer
    // it cannot read, so no tool runs for this model: not a read of another document or chunk,
    // and not a write.
    const ask = async (
      messages: readonly Message[],
    ): Promise<Asked<z.output<typeof readerTwoAnswer>>> => {
      if (turns >= config.turnCap) throw new JobStop('turn_cap');
      turns += 1;
      try {
        return await context.ask({ messages, shape: readerTwoAnswer });
      } catch (cause) {
        if (cause instanceof ModelFailure && cause.failure.kind === REASON.overCap)
          throw new JobStop('usage_cap');
        throw cause;
      }
    };

    // A limit of this check: the version of the reader is not in it. A new version with the same
    // prompt file skips a chunk that the old version read. A chunk that gave no reading has no row,
    // so a requeue asks the model again for that chunk, and the key still gives no second row.
    const done = async (chunk: Chunk): Promise<boolean> => {
      const [row] = doneRow.parse(
        (await context.db.query(DONE, [context.job.id, chunk.hash, fingerprint, INPUT_FORM])).rows,
      );
      return row?.done ?? false;
    };

    const spanFault = (chunk: Chunk, entry: Reading): string | null => {
      const length = codePoints(chunk.text);
      if (entry.page === chunk.page && entry.end <= length) return null;
      return (
        `the span ${String(entry.start)} to ${String(entry.end)} on page ${String(entry.page)} ` +
        `lies outside the chunk, which is page ${String(chunk.page)} and holds ` +
        `${String(length)} code points`
      );
    };

    // A reading that code or the door refuses is kept as a refusal, and the model is not asked
    // again: a second answer from the same model is not a second reading.
    const store = async (
      chunk: Chunk,
      textSet: string,
      entry: Reading,
      callId: string,
    ): Promise<void> => {
      const fault = spanFault(chunk, entry);
      if (fault !== null) {
        refusals.push({ tool: tools.putClaimReading.name, reason: fault });
        return;
      }
      const key = claimKeyOf({
        keyOf: context.keyOf,
        chunkHash: chunk.hash,
        servedModel: pinned,
        inputForm: INPUT_FORM,
        promptHash,
        entry,
      });
      const read = await callTool(tools.putClaimReading, session, {
        job: context.job.id,
        textExtractor: textSet,
        page: chunk.page,
        start: chunk.start + entry.start,
        end: chunk.start + entry.end,
        modality: entry.modality,
        ...(entry.adverse === true ? { adverse: true } : {}),
        modelCallId: callId,
        inputForm: INPUT_FORM,
        readerFingerprint: fingerprint,
        chunkHash: chunk.hash,
        idempotencyKey: key,
      });
      if (!read.ok) refusals.push({ tool: tools.putClaimReading.name, reason: read.refusal });
    };

    const readChunk = async (chunk: Chunk, textSet: string): Promise<void> => {
      if (await done(chunk)) return;

      const text = minimise(chunk.text);
      if (codePoints(text) !== codePoints(chunk.text)) throw new JobStop('minimiser_length');

      const asked = await ask([
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: JSON.stringify({ document: context.job.documentId, page: chunk.page, text }),
        },
      ]);
      if (asked.kind === 'call') {
        refusals.push({
          tool: asked.call.name,
          reason: 'the second reader offers no tool to its model, so no tool ran',
        });
        return;
      }
      for (const entry of asked.value.claims) await store(chunk, textSet, entry, asked.callId);
    };

    const newest = await readNewestPages(context.db, context.job.documentId);
    if (newest === null) throw new JobStop('no_text');

    for (const chunk of chunkPages(newest.pages, config.chunkCap))
      await readChunk(chunk, newest.textSet);
    return { refusals };
  };

  return {
    name: READER2_NAME,
    version: VERSION,
    kind: 'second_read',
    settings: config.model,
    // Each question of the job counts one turn, so the cap is the most questions of one job.
    questionsPerJob: config.turnCap,
    tokenCap: config.tokenCap,
    releaseOn: READER2_RELEASE,
    run,
  };
};
