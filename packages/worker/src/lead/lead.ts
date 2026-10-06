import type { Message } from '@gab/model';
import { enqueueExtract } from '@gab/tools/enqueue-extract';
import { fetchDocument } from '@gab/tools/fetch-document';
import { pageAddress } from '@gab/tools/fetch-guard';
import { findDocument } from '@gab/tools/find-document';
import { newsSearch } from '@gab/tools/news-search';
import { searchGraph } from '@gab/tools/search-graph';
import { callTool, type Reach, type Session } from '@gab/tools/tool';
import { webSearch } from '@gab/tools/web-search';
import { z } from 'zod';

import {
  JobStop,
  type AgentContext,
  type AgentResult,
  type Refusal,
  type RunnerAgent,
} from '../agents.ts';
import { readLeadConfig, type LeadConfig } from '../reader-config.ts';
import { answerCall, offerOf, outcomeText, promptOf, withinBudget } from '../tool-turn.ts';

/** The name of the lead agent in the record of each of its model calls. */
const LEAD_NAME = 'lead';
const VERSION = 'v1';

interface LeadOptions {
  /** The object store, the web and the clock that the tools use. */
  readonly reach: Reach;
  /** The text of the prompt. The default is the versioned file beside this one. */
  readonly prompt?: string;
}

const BUDGET_SPENT = 'the token budget of this lead is spent';
const NO_COUNT = 'the model gave no token count, so the token budget cannot stop this lead';

// Origin of the number: the model reads the start of a page to judge it and to find the next
// search, and the extractor reads the whole page later. A whole page in each answer fills the
// token budget with text that no step of the lead needs.
const TEXT_SHOWN = 3000;

const RECORD = 'SELECT public.record_lead_document($1::uuid, $2::text)';
const STORED = `SELECT id::text AS id FROM api.document
  WHERE uri = ANY($1::text[]) ORDER BY created_at, id LIMIT 1`;

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

const held = z.array(z.object({ id: z.string() })).max(1);

// The addresses that give the page of `url`: the address that the fetch stores, and the same
// address with or without a slash at the end of its path. A server gives one page for both nearly
// always, and a second fetch only stores the same page again.
const addressesOf = (url: string): string[] => {
  const address = pageAddress(url);
  const parts = new URL(address);
  if (parts.pathname === '/') return [address];
  parts.pathname = parts.pathname.endsWith('/')
    ? parts.pathname.replace(/\/+$/u, '')
    : `${parts.pathname}/`;
  return [address, parts.href];
};

// The tools of the lead. None of them proposes, and none of them starts a lead.
const OFFER = offerOf([
  webSearch,
  newsSearch,
  searchGraph,
  findDocument,
  fetchDocument,
  enqueueExtract,
]);

/** The lead agent. It searches, fetches and stores the pages of one lead, and queues the
 * extraction of each page that it stores. It proposes nothing and starts no lead. */
export const makeLeadAgent = (config: LeadConfig, options: LeadOptions): RunnerAgent => {
  const prompt = promptOf(options.prompt, new URL('./prompt.md', import.meta.url));
  const { reach } = options;

  const run = async (context: AgentContext): Promise<AgentResult> => {
    const { job } = context;
    if (job.kind !== 'research_lead')
      throw new JobStop(`the lead agent runs no job of ${job.kind}`);
    const session: Session = { query: (text, values) => context.db.query(text, values) };
    const refusals: Refusal[] = [];

    // A page that Gabriel holds already is never fetched again. Code checks the address before
    // the fetch, so the model cannot store one page twice. An address that the fetch refuses
    // goes on to the fetch, which gives the model its reason.
    const storedAs = async (url: string): Promise<string | undefined> => {
      let addresses: string[];
      try {
        addresses = addressesOf(url);
      } catch {
        return undefined;
      }
      return held.parse((await context.db.query(STORED, [addresses])).rows)[0]?.id;
    };

    // The extraction of a new page is queued by code, so no stored page waits for the model to
    // ask for it.
    const keep = async (document: string): Promise<string> => {
      await context.db.query(RECORD, [job.id, document]);
      const queued = await callTool(enqueueExtract, session, { document });
      return queued.ok ? 'queued' : `not queued: ${queued.refusal}`;
    };

    const fetchOf = async (input: unknown): Promise<string> => {
      const given = z.object({ url: z.string() }).safeParse(input);
      const known = given.success ? await storedAs(given.data.url) : undefined;
      if (known !== undefined)
        return `Gabriel holds this page already as document ${known}, so it was not fetched again.`;

      const outcome = await callTool(fetchDocument, session, input, reach);
      if (!outcome.ok) return outcomeText(outcome);
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

    const messages: Message[] = [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: JSON.stringify({ lead: job.lead, today: reach.now().toISOString().slice(0, 10) }),
      },
    ];
    // No page limit and no turn limit: the token budget of the job is the one stop.
    for (;;) {
      const asked = await withinBudget(
        context.ask(config.model, {
          messages: [...messages],
          shape: finalAnswer,
          tools: OFFER.forModel,
        }),
        BUDGET_SPENT,
      );
      // An answer that costs no token never spends the budget, and the budget is the one stop.
      if (asked.tokens === 0) throw new JobStop(NO_COUNT);
      if (asked.kind === 'value') return { refusals };
      const { call } = asked;
      const content = await answerCall(
        OFFER.byName,
        call,
        refusals,
        'to the lead agent',
        async (tool) =>
          tool === fetchDocument
            ? fetchOf(call.input)
            : outcomeText(await callTool(tool, session, call.input, reach)),
      );
      messages.push({ role: 'assistant', call }, { role: 'tool', call, content });
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

/** The lead agent that the environment sets up. A lead setting that is absent never stops the
 * worker, so the extraction still runs: each lead then fails at once with the sentence that names
 * the setting. `reachOf` opens the store and the web only when the settings are present. */
export const leadAgentOf = (
  env: Readonly<Record<string, string | undefined>>,
  reachOf: () => Reach,
): RunnerAgent => {
  try {
    return makeLeadAgent(readLeadConfig(env), { reach: reachOf() });
  } catch (fault) {
    const reason = `the lead agent is not set up: ${fault instanceof Error ? fault.message : String(fault)}`;
    console.error(reason);
    return {
      name: LEAD_NAME,
      version: VERSION,
      kind: 'research_lead',
      models: [],
      tokenCap: 1,
      run: () => Promise.reject(new JobStop(reason)),
    };
  }
};
