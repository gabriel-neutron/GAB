import type { Message, ToolUse } from '@gab/model';
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

/** The name of the extractor in the record of each of its model calls. */
const EXTRACTOR_NAME = 'extractor';
const VERSION = 'v5';

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

// The checker gives one verdict for each item. Only `supported` lets an item stand undisputed.
const checkAnswer = z.strictObject({
  verdicts: z.array(
    z.strictObject({
      ref: z.string(),
      verdict: z.enum(['supported', 'not_supported', 'unclear']),
      // A model can give `null` for no reason, and that is not a fault of the answer.
      reason: z.string().nullish(),
    }),
  ),
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
 * of another family checks each item against its passage. The models write nothing. */
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
      const { verdicts } = asked.value;
      // One verdict for each item. A second verdict on one item makes it unclear.
      return refs.flatMap((ref): (readonly [string, CheckVerdict])[] => {
        const said = verdicts.filter((one) => one.ref === ref);
        const [only] = said;
        if (only === undefined) return [];
        if (said.length > 1)
          return [[ref, { verdict: 'unclear', reason: 'the checker gave more than one verdict' }]];
        if (only.verdict === 'supported') return [[ref, { verdict: 'supported' }]];
        return [[ref, { verdict: only.verdict, reason: only.reason ?? '' }]];
      });
    };

    const check = async (
      items: readonly ItemToCheck[],
    ): Promise<ReadonlyMap<string, CheckVerdict>> => {
      const verdicts = new Map<string, CheckVerdict>();
      for (const group of byPassage(items))
        for (const [ref, verdict] of await checkGroup(group)) verdicts.set(ref, verdict);
      return verdicts;
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
        if (asked.value.items.length === 0) return null;
        const proposer = tools.propose(asked.callId);
        const made = await callTool(
          proposer,
          session,
          { items: asked.value.items },
          { now: () => new Date(), check },
        );
        if (made.ok) return null;
        if (retries === 0) {
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
