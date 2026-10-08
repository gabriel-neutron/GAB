import type { Message } from '@gab/model';
import { z } from 'zod';

import { JobStop, type AgentContext, type AgentResult, type RunnerAgent } from '../agents.ts';
import { readRaterConfig, type RaterConfig } from '../reader-config.ts';
import { promptOf, withinBudget } from '../tool-turn.ts';
import { decide, ratingAnswer, ratingContext } from './answer.ts';

const RATER_NAME = 'rater';
const VERSION = 'v1';

const CONTEXT = 'SELECT public.rating_context($1::text) AS context';
const STORE = `SELECT public.store_author_letter($1::text, $2::text, $3::text, $4::text,
  $5::text[], $6::text, $7::boolean)`;
const JOIN = 'SELECT public.join_author_name($1::text, $2::text)';

const contextRow = z.array(z.object({ context: ratingContext })).length(1);

interface RaterOptions {
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
}

/** The rater. It reads one new author name, and the model answers that the name is a known author
 * or gives a new author a letter from C to F. Code refuses an answer that breaks a rule, and the
 * author then stays F. */
export const makeRater = (config: RaterConfig, options: RaterOptions = {}): RunnerAgent => {
  const prompt = promptOf(options.prompt, new URL('./prompt.md', import.meta.url));

  const run = async (context: AgentContext): Promise<AgentResult> => {
    const { job } = context;
    if (job.kind !== 'rate_author') throw new JobStop(`the rater runs no job of ${job.kind}`);
    const name = job.author;

    const [row] = contextRow.parse((await context.db.query(CONTEXT, [name])).rows);
    const read = row?.context;
    if (read === undefined || read.resolved) return { refusals: [] };

    const messages: Message[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify({ name, authors: read.authors }) },
    ];
    const asked = await withinBudget(
      context.ask(config.model, { messages, shape: ratingAnswer }),
      'the token budget of this rating is spent',
    );
    if (asked.kind === 'call')
      throw new JobStop('the model answered with a tool call, and the rater offers no tool');

    const decision = decide(name, asked.value, read.authors);
    // The record keeps the name of the model that gave the answer.
    const model = asked.served;
    try {
      if (decision.kind === 'join') {
        await context.db.query(JOIN, [name, decision.known]);
      } else if (decision.kind === 'store') {
        await context.db.query(STORE, [
          name,
          decision.letter,
          model,
          decision.reason,
          [...decision.references],
          decision.controller,
          decision.party,
        ]);
      }
    } catch (fault) {
      // A door that refuses the answer is a refusal and not a fault of the job. Another error
      // reaches the runner as it is.
      if (!(fault instanceof Error) || !('code' in fault)) throw fault;
      return refused(fault.message);
    }
    if (decision.kind === 'refused') return refused(decision.reason);
    return { refusals: [] };
  };

  return {
    name: RATER_NAME,
    version: VERSION,
    kind: 'rate_author',
    models: [config.model],
    tokenCap: config.tokenCap,
    run,
  };
};

// One refused part: the runner ends the job as failed with this sentence, and the author stays F.
const refused = (reason: string): AgentResult => ({
  refusals: [{ tool: 'rate_author', reason }],
  parts: { parts: 1, refused: 1, firstRefusal: reason },
});

/** The rater, or an agent that fails each job with the reason that the configuration is not set.
 * A rater value that is absent never stops the extraction. */
export const raterAgentOf = (env: Readonly<Record<string, string | undefined>>): RunnerAgent => {
  try {
    return makeRater(readRaterConfig(env));
  } catch (fault) {
    const reason = `the rater is not set up: ${fault instanceof Error ? fault.message : String(fault)}`;
    console.error(reason);
    return {
      name: RATER_NAME,
      version: VERSION,
      kind: 'rate_author',
      models: [],
      tokenCap: 1,
      run: () => Promise.reject(new JobStop(reason)),
    };
  }
};
