import type { Message } from '@gab/model';
import { mappingDraft } from '@gab/proposal/mapping';
import { fileSchemaSample } from '@gab/tools/file-schema-sample';
import { proposeMappingOf } from '@gab/tools/propose-mapping';
import { callTool, type Session, type Tool } from '@gab/tools/tool';
import { z } from 'zod';

import { JobStop, type AgentContext, type AgentResult, type RunnerAgent } from '../agents.ts';
import { readMapperConfig, type MapperConfig } from '../reader-config.ts';
import { promptOf, withinBudget } from '../tool-turn.ts';

const MAPPER_NAME = 'mapper';
const VERSION = 'v1';

// A format joins the list when code can give each row a span in a stored page. Today only a CSV
// is one page of text with a row on each line.
const MAPPED_MIME = 'text/csv';

interface MapperOptions {
  /** The tools of the mapper. A test gives a stub for each one. */
  readonly tools?: {
    readonly fileSchemaSample: Tool;
    readonly proposeMapping: (modelCallId: string) => Tool;
  };
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
}

const answer = z.strictObject({ mapping: mappingDraft });

const sampled = z.object({ headerSig: z.string() });

const documentRow = z.array(z.object({ mime: z.string().nullable() }));

const loadRow = z.array(z.object({ id: z.uuid().nullable() }));

const MIME = 'SELECT mime FROM public.documents WHERE id = $1::text';

const REUSE = 'SELECT public.enqueue_mapped_load($1::text, $2::text)::text AS id';

const baseMime = (mime: string | null): string =>
  (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';

/** The mapper. It reads the header and the first rows of one table, and the model proposes how
 * the columns map. A second file of the same header from the same host takes the mapping that the
 * operator accepted, and no model reads it. */
export const makeMapper = (config: MapperConfig, options: MapperOptions = {}): RunnerAgent => {
  const tools = options.tools ?? { fileSchemaSample, proposeMapping: proposeMappingOf };
  const prompt = promptOf(options.prompt, new URL('./prompt.md', import.meta.url));

  const run = async (context: AgentContext): Promise<AgentResult> => {
    const { job } = context;
    if (job.kind !== 'map_structured') throw new JobStop(`the mapper runs no job of ${job.kind}`);
    const document = job.documentId;
    const session: Session = { query: (text, values) => context.db.query(text, values) };

    const [held] = documentRow.parse((await context.db.query(MIME, [document])).rows);
    if (held === undefined) throw new JobStop(`the record holds no document ${document}`);
    if (baseMime(held.mime) !== MAPPED_MIME)
      throw new JobStop(
        `the mapper reads a CSV table only, and document ${document} is ${held.mime ?? 'of no type'}`,
      );

    const read = await callTool(tools.fileSchemaSample, session, { document });
    if (!read.ok) throw new JobStop(read.refusal);
    const { headerSig } = sampled.parse(read.output);

    // A file that an accepted mapping already fits is loaded with no model. A job that runs again
    // meets the load that its first run queued, and the door returns it.
    const [reused] = loadRow.parse((await context.db.query(REUSE, [document, headerSig])).rows);
    if (reused !== undefined && reused.id !== null) return { refusals: [] };

    // A refusal of the tool goes back to the model once, with its sentence, and the model gives
    // the mapping again. The second refusal ends the job with that sentence.
    const messages: Message[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(read.output) },
    ];
    for (let retries = 1; ; retries -= 1) {
      const asked = await withinBudget(
        context.ask(config.model, { messages: [...messages], shape: answer }),
        'the token budget of this mapping is spent',
      );
      if (asked.kind === 'call')
        throw new JobStop('the model answered with a tool call, and the mapper offers no tool');
      const made = await callTool(tools.proposeMapping(asked.callId), session, {
        document,
        mapping: asked.value.mapping,
      });
      if (made.ok) return { refusals: [] };
      if (retries === 0) throw new JobStop(`the tool refused the mapping: ${made.refusal}`);
      messages.push(
        { role: 'assistant', content: JSON.stringify(asked.value) },
        {
          role: 'user',
          content:
            `The tool refused the mapping: ${made.refusal}. Give the mapping again, corrected, ` +
            'as {"mapping": {...}}.',
        },
      );
    }
  };

  return {
    name: MAPPER_NAME,
    version: VERSION,
    kind: 'map_structured',
    models: [config.model],
    tokenCap: config.tokenCap,
    run,
  };
};

/** The mapper, or an agent that fails each job with the reason that the configuration is not
 * set. A mapper value that is absent never stops the extraction. */
export const mapperAgentOf = (env: Readonly<Record<string, string | undefined>>): RunnerAgent => {
  try {
    return makeMapper(readMapperConfig(env));
  } catch (fault) {
    const reason = `the mapper is not set up: ${fault instanceof Error ? fault.message : String(fault)}`;
    console.error(reason);
    return {
      name: MAPPER_NAME,
      version: VERSION,
      kind: 'map_structured',
      models: [],
      tokenCap: 1,
      run: () => Promise.reject(new JobStop(reason)),
    };
  }
};
