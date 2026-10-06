import { readFileSync } from 'node:fs';

import { REASON, type Message, type Tool as ModelTool, type ToolUse } from '@gab/model';
import { enqueueExtract } from '@gab/tools/enqueue-extract';
import { fetchDocument } from '@gab/tools/fetch-document';
import { findDocument } from '@gab/tools/find-document';
import { newsSearch } from '@gab/tools/news-search';
import { searchGraph } from '@gab/tools/search-graph';
import { callTool, type Reach, type Session, type Tool } from '@gab/tools/tool';
import { webSearch } from '@gab/tools/web-search';
import { z } from 'zod';

import {
  JobStop,
  ModelFailure,
  type AgentContext,
  type AgentResult,
  type Refusal,
  type RunnerAgent,
} from '../agents.ts';
import type { LeadConfig } from '../reader-config.ts';

/** The name of the lead agent in the record of each of its model calls. */
export const LEAD_NAME = 'lead';
const VERSION = 'v1';

export interface LeadOptions {
  /** The object store, the web and the clock that the tools use. */
  readonly reach: Reach;
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
}

const BUDGET_SPENT = 'the token budget of this lead is spent';

// Origin of the number: the model reads the start of a page to judge it and to find the next
// search, and the extractor reads the whole page later. A whole page in each answer fills the
// token budget with text that no step of the lead needs.
const TEXT_SHOWN = 3000;

const RECORD = 'SELECT public.record_lead_document($1::uuid, $2::text)';

// The last answer of the model. It states what the lead found, and code writes nothing from it.
const finalAnswer = z.strictObject({ summary: z.string() });

const fetched = z.object({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  url: z.string(),
  pages: z.array(z.object({ text: z.string() })),
  notice: z.string().nullable(),
  rendered: z.object({ document: z.string(), status: z.enum(['known', 'stored']) }).nullable(),
});

const found = z.object({
  documents: z.array(z.object({ id: z.string(), url: z.string().nullable() })),
});

// The tools of the lead. None of them proposes, and none of them starts a lead.
const OFFERED: readonly Tool[] = [
  webSearch,
  newsSearch,
  searchGraph,
  findDocument,
  fetchDocument,
  enqueueExtract,
];

/** The lead agent. It searches, fetches and stores the pages of one lead, and queues the
 * extraction of each page that it stores. It proposes nothing and starts no lead. */
export const makeLeadAgent = (config: LeadConfig, options: LeadOptions): RunnerAgent => {
  const prompt = options.prompt ?? readFileSync(new URL('./prompt.md', import.meta.url), 'utf8');
  const { reach } = options;
  const byName = new Map(OFFERED.map((tool) => [tool.name, tool]));
  const modelTools: ModelTool[] = OFFERED.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: tool.input,
  }));

  const run = async (context: AgentContext): Promise<AgentResult> => {
    const { job } = context;
    if (job.kind !== 'research_lead')
      throw new JobStop(`the lead agent runs no job of ${job.kind}`);
    const session: Session = { query: (text, values) => context.db.query(text, values) };
    const refusals: Refusal[] = [];

    // A page that Gabriel holds already is never fetched again. Code checks the address before
    // the fetch, so the model cannot store one page twice.
    const storedAs = async (url: string): Promise<string | undefined> => {
      const outcome = await callTool(findDocument, session, { url });
      if (!outcome.ok) return undefined;
      return found.parse(outcome.output).documents.find((one) => one.url === url)?.id;
    };

    // The extraction of a new page is queued by code, so no stored page waits for the model to
    // ask for it.
    const keep = async (document: string): Promise<string> => {
      await context.db.query(RECORD, [job.id, document]);
      const queued = await callTool(enqueueExtract, session, { document });
      return queued.ok ? 'queued' : `not queued: ${queued.refusal}`;
    };

    const fetchOf = async (input: unknown): Promise<string> => {
      const url = z.object({ url: z.string() }).parse(input).url.trim();
      const held = await storedAs(url);
      if (held !== undefined)
        return `Gabriel holds this page already as document ${held}, so it was not fetched again.`;

      const outcome = await callTool(fetchDocument, session, input, reach);
      if (!outcome.ok) return `The tool refused the call: ${outcome.refusal}`;
      const page = fetched.parse(outcome.output);
      const document = page.rendered?.document ?? page.document;
      const status = page.rendered?.status ?? page.status;
      const extraction =
        status === 'stored'
          ? await keep(document)
          : 'not queued: the same bytes were stored before';
      const text = page.pages.map((one) => one.text).join('\n');
      return JSON.stringify({
        document,
        status,
        title: page.title,
        url: page.url,
        extraction,
        notice: page.notice,
        text: text.length <= TEXT_SHOWN ? text : `${text.slice(0, TEXT_SHOWN)}…`,
      });
    };

    const answerOf = async (call: ToolUse): Promise<string> => {
      const tool = byName.get(call.name);
      if (tool === undefined) {
        const reason = `the tool ${call.name} is not offered to the lead agent`;
        refusals.push({ tool: call.name, reason });
        return reason;
      }
      if (tool === fetchDocument) return fetchOf(call.input);
      const outcome = await callTool(tool, session, call.input, reach);
      return outcome.ok
        ? JSON.stringify(outcome.output)
        : `The tool refused the call: ${outcome.refusal}`;
    };

    const messages: Message[] = [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: JSON.stringify({ lead: job.lead, today: reach.now().toISOString().slice(0, 10) }),
      },
    ];
    // No page limit and no turn limit: the token budget of the job is the one stop.
    for (;;) {
      let asked;
      try {
        asked = await context.ask(config.model, {
          messages: [...messages],
          shape: finalAnswer,
          tools: modelTools,
        });
      } catch (cause) {
        if (cause instanceof ModelFailure && cause.failure.kind === REASON.overCap)
          throw new JobStop(BUDGET_SPENT);
        throw cause;
      }
      if (asked.kind === 'value') return { refusals };
      messages.push(
        { role: 'assistant', call: asked.call },
        { role: 'tool', call: asked.call, content: await answerOf(asked.call) },
      );
    }
  };

  return {
    name: LEAD_NAME,
    version: VERSION,
    kind: 'research_lead',
    models: [config.model],
    tokenCap: config.tokenCap,
    run,
  };
};
