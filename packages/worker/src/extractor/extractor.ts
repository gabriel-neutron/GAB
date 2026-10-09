import type { Message, ToolUse } from '@gab/model';
import { checkAnswer, verdictsOf } from '@gab/tools/check-answer';
import { documentText } from '@gab/tools/document-text';
import { proposeItem, proposeOf } from '@gab/tools/propose';
import { searchGraph } from '@gab/tools/search-graph';
import {
  callTool,
  type CheckVerdict,
  type ItemToCheck,
  type Session,
  type Tool,
} from '@gab/tools/tool';
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
import { answerCall, offerOf, outcomeText, promptOf, withinBudget } from '../tool-turn.ts';
import { screenBatch } from './screen.ts';

/** The name of the extractor in the record of each of its model calls. */
const EXTRACTOR_NAME = 'extractor';
const VERSION = 'v9';

// The sentences that the operator reads in the job record when the extractor stops on its own.
const TURN_CAP = 'the model used all the questions that one job may ask';
const BUDGET_SPENT = 'the token budget of this job is spent';
const NO_TEXT = 'the document has no text to read';

/** The tools of the extractor. A test gives a stub for each one. The propose tool names the
 * model call that gave the batch. */
interface ExtractorTools {
  readonly documentText: Tool;
  readonly searchGraph: Tool;
  readonly propose: (modelCallId: string) => Tool;
}

interface ExtractorOptions {
  readonly tools?: ExtractorTools;
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
  /** The text of the prompt of the checker. The default is the versioned file beside this one. */
  readonly checkPrompt?: string;
}

const DEFAULT_TOOLS: ExtractorTools = { documentText, searchGraph, propose: proposeOf };

// The words of the record that a type of an act takes. The model gets them with each chunk, so it
// never makes up a type, and a new word of the vocabulary reaches it with no change of the prompt.
const VOCABULARY = `SELECT
  (SELECT coalesce(json_agg(key ORDER BY ord, key), '[]') FROM api.entity_type WHERE NOT retired)
    AS "entityTypes",
  (SELECT coalesce(json_agg(key ORDER BY key), '[]') FROM api.relation_type WHERE NOT retired)
    AS "relationTypes"`;

const vocabulary = z.strictObject({
  entityTypes: z.array(z.string()),
  relationTypes: z.array(z.string()),
});

type Vocabulary = z.output<typeof vocabulary>;

const vocabularyOf = async (session: Session): Promise<Vocabulary> => {
  const { rows } = await session.query(VOCABULARY, []);
  return vocabulary.parse(rows[0]);
};

// The answer of the model is the batch that the propose tool takes, so the research AI and the
// extractor give one shape. An empty list is a chunk that states no claim.
const chunkAnswer = z.strictObject({ items: z.array(proposeItem) });

// The door that keeps the verdict of the checker on one act. The rules read it, so an act with a
// passed check can be accepted with no step by hand.
const RECORD_CHECK = 'SELECT public.record_act_check($1::uuid, $2, $3, $4, $5, $6)';

// The part of the answer of the propose tool that names the act of each item.
const proposed = z.object({
  proposals: z.array(z.object({ ref: z.string(), proposalId: z.uuid() })),
});

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
 * of another family checks each item against its passage, and code keeps each verdict with its
 * act, so the rules can decide. The models write nothing. */
export const makeExtractor = (
  config: ReaderConfig,
  options: ExtractorOptions = {},
): RunnerAgent => {
  const tools = options.tools ?? DEFAULT_TOOLS;
  const prompt = promptOf(options.prompt, new URL('./prompt.md', import.meta.url));
  const checkPrompt = promptOf(options.checkPrompt, new URL('./check-prompt.md', import.meta.url));

  // The model reads and looks up. A call to any other tool is refused, and the write is made by
  // code alone.
  const offer = offerOf([tools.documentText, tools.searchGraph]);

  const run = async (context: AgentContext): Promise<AgentResult> => {
    const { job } = context;
    if (job.kind !== 'extract_text') throw new JobStop(`the extractor runs no job of ${job.kind}`);
    const session: Session = { query: (text, values) => context.db.query(text, values) };
    const refusals: Refusal[] = [];
    let turns = 0;
    // The entities that the parts of this job proposed, and the count of each drop of code.
    const seen = new Set<string>();
    const dropped: Record<string, number> = {};

    const ask = async (
      messages: readonly Message[],
    ): Promise<Asked<z.output<typeof chunkAnswer>>> => {
      if (turns >= config.turnCap) throw new JobStop(TURN_CAP);
      turns += 1;
      // A copy, so the question that was asked keeps the messages it held at that time.
      return withinBudget(
        context.ask(config.reader, {
          messages: [...messages],
          shape: chunkAnswer,
          tools: offer.forModel,
        }),
        BUDGET_SPENT,
      );
    };

    const turnOf = async (call: ToolUse): Promise<Message[]> => {
      const content = await answerCall(
        offer.byName,
        call,
        refusals,
        'to this model, and code runs the write',
        async (tool) => outcomeText(await callTool(tool, session, call.input)),
      );
      return [
        { role: 'assistant', call },
        { role: 'tool', call, content },
      ];
    };

    // A model of another family reads each item with its passage. A checker that fails gives no
    // verdict, and each item of its question is then written as disputed: a failure never drops
    // an item.
    const checkGroup = async (
      group: readonly ItemToCheck[],
    ): Promise<(readonly [string, CheckVerdict])[]> => {
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
      return verdictsOf(refs, asked.value);
    };

    const check = async (
      items: readonly ItemToCheck[],
    ): Promise<ReadonlyMap<string, CheckVerdict>> => {
      const verdicts = new Map<string, CheckVerdict>();
      for (const group of byPassage(items))
        for (const [ref, verdict] of await checkGroup(group)) verdicts.set(ref, verdict);
      return verdicts;
    };

    // Each act of the batch keeps the verdict of the checker on its item, also an act that an
    // earlier job wrote with no check. The record keeps the first check of an act, so a second
    // call changes nothing. An item with no verdict keeps no check.
    const recordChecks = async (
      output: unknown,
      verdicts: ReadonlyMap<string, CheckVerdict>,
    ): Promise<void> => {
      for (const one of proposed.parse(output).proposals) {
        const said = verdicts.get(one.ref);
        if (said === undefined) continue;
        await context.db.query(RECORD_CHECK, [
          one.proposalId,
          config.checker.model,
          config.checker.family,
          config.reader.family,
          said.verdict,
          said.verdict === 'supported' ? null : said.reason,
        ]);
      }
    };

    // The model answers with the batch of one chunk. A refusal of the batch goes back to the
    // model once, with the sentence of the tool, and the model gives the whole batch again. The
    // answer is the second refusal, or null.
    const readChunk = async (chunk: Chunk, words: Vocabulary): Promise<string | null> => {
      const messages: Message[] = [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: JSON.stringify({
            document: job.documentId,
            page: chunk.page,
            text: chunk.text,
            ...words,
          }),
        },
      ];
      let retries = 1;
      for (;;) {
        const asked = await ask(messages);
        if (asked.kind === 'call') {
          messages.push(...(await turnOf(asked.call)));
          continue;
        }
        // Code drops each item that a rule can refuse, so the door and the checker never read
        // it. The drops of an answer count once, when the answer is the last of its part.
        const screened = screenBatch(asked.value.items, words, seen);
        const counted = (): void => {
          for (const [reason, count] of Object.entries(screened.dropped))
            dropped[reason] = (dropped[reason] ?? 0) + count;
        };
        if (screened.items.length === 0) {
          counted();
          return null;
        }
        const proposer = tools.propose(asked.callId);
        let verdicts: ReadonlyMap<string, CheckVerdict> = new Map();
        const made = await callTool(
          proposer,
          session,
          { items: screened.items },
          {
            now: () => new Date(),
            check: async (items) => (verdicts = await check(items)),
          },
        );
        if (made.ok) {
          await recordChecks(made.output, verdicts);
          for (const key of screened.proposed) seen.add(key);
          counted();
          return null;
        }
        if (retries === 0) {
          counted();
          refusals.push({ tool: proposer.name, reason: made.refusal });
          return made.refusal;
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
    if (newest === null) throw new JobStop(NO_TEXT);

    const chunks = chunkPages(newest, config.chunkCap);
    const words = await vocabularyOf(session);
    const refused: string[] = [];
    for (const chunk of chunks) {
      const refusal = await readChunk(chunk, words);
      if (refusal !== null) refused.push(refusal);
    }
    return {
      refusals,
      parts: { parts: chunks.length, refused: refused.length, firstRefusal: refused[0] ?? null },
      dropped,
    };
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
