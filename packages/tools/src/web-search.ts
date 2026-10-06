import { z } from 'zod';

import { clipped, isWebAddress, jsonOf, UpstreamFault, webFromReach } from './web-access.ts';
import { defineTool, ToolRefusal, type Web } from './tool.ts';

const MAX_RESULTS = 20;
const DEFAULT_RESULTS = 10;
const MAX_SNIPPET = 500;
const MAX_TITLE = 300;

// External constraint: the fallback has one host, and the address is a constant of this module. A
// key goes in a header to this host and never in an address.
const BRAVE = 'https://api.search.brave.com/res/v1/web/search';

const NO_KEY = 'no Brave key is set, so this answer comes from SearXNG alone';

const hit = z.strictObject({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  engine: z.string(),
});

const outputShape = z.strictObject({
  results: z.array(hit),
  source: z.enum(['searxng', 'brave']),
  notice: z.string().nullable(),
});

type Hit = z.output<typeof hit>;

const searxRows = z.object({ results: z.array(z.unknown()) });
const searxRow = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string().optional(),
  engine: z.string().optional(),
});

const braveRows = z.object({
  web: z.object({ results: z.array(z.unknown()) }).optional(),
});
const braveRow = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string().optional(),
});

const plain = (html: string): string =>
  html
    .replace(/<[^>]*>/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

const searxSearch = (setting: string, query: string): string => {
  let base: URL;
  try {
    base = new URL(setting);
  } catch {
    throw new UpstreamFault('the SearXNG address is not an address');
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:')
    throw new UpstreamFault('the SearXNG address is not an http address');
  const url = new URL(base.href);
  url.pathname = `${url.pathname.replace(/\/+$/u, '')}/search`;
  url.search = '';
  url.hash = '';
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  return url.href;
};

const fromSearx = async (web: Web, setting: string, query: string, count: number) => {
  const body = searxRows.safeParse(await jsonOf(web, searxSearch(setting, query)));
  if (!body.success) throw new UpstreamFault('the answer has no list of results');
  const hits: Hit[] = [];
  for (const held of body.data.results) {
    const row = searxRow.safeParse(held);
    if (!row.success || !isWebAddress(row.data.url)) continue;
    hits.push({
      title: clipped(plain(row.data.title), MAX_TITLE),
      url: row.data.url,
      snippet: clipped(plain(row.data.content ?? ''), MAX_SNIPPET),
      engine: row.data.engine ?? 'searxng',
    });
    if (hits.length === count) break;
  }
  return hits;
};

const fromBrave = async (web: Web, key: string, query: string, count: number) => {
  const url = new URL(BRAVE);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));
  const body = braveRows.safeParse(
    await jsonOf(web, url.href, {
      headers: { accept: 'application/json', 'x-subscription-token': key },
    }),
  );
  if (!body.success) throw new UpstreamFault('the answer has no list of results');
  const hits: Hit[] = [];
  for (const held of body.data.web?.results ?? []) {
    const row = braveRow.safeParse(held);
    if (!row.success || !isWebAddress(row.data.url)) continue;
    hits.push({
      title: clipped(plain(row.data.title), MAX_TITLE),
      url: row.data.url,
      snippet: clipped(plain(row.data.description ?? ''), MAX_SNIPPET),
      engine: 'brave',
    });
    if (hits.length === count) break;
  }
  return hits;
};

const attempt = async <T>(run: () => Promise<T>): Promise<T | UpstreamFault> => {
  try {
    return await run();
  } catch (fault) {
    if (fault instanceof UpstreamFault) return fault;
    return new UpstreamFault('no whole answer came');
  }
};

export const webSearch = defineTool({
  name: 'web_search',
  description:
    'Searches the web with the local SearXNG, and with the Brave Search API when SearXNG fails ' +
    'or gives no result. Returns title, address, snippet and engine for each result. A result ' +
    'is a lead and not a source: nothing is stored, so fetch the page with fetch_document ' +
    'before you cite it. "notice" says which engine answered and why. A failure of every engine ' +
    'is a refusal and never an empty list.',
  input: z.strictObject({
    query: z.string().trim().min(1).max(500),
    count: z.number().int().min(1).max(MAX_RESULTS).default(DEFAULT_RESULTS),
  }),
  output: outputShape,
  async run(_session, input, reach) {
    const web = webFromReach(reach);
    const key = web.braveKey === undefined || web.braveKey === '' ? undefined : web.braveKey;
    const setting =
      web.searxngUrl === undefined || web.searxngUrl === '' ? undefined : web.searxngUrl;
    if (setting === undefined && key === undefined)
      throw new ToolRefusal('no search engine is set: SearXNG has no address and Brave has no key');

    let searx: Hit[] | UpstreamFault | undefined;
    if (setting !== undefined) {
      searx = await attempt(() => fromSearx(web, setting, input.query, input.count));
      if (Array.isArray(searx) && searx.length > 0)
        return {
          results: searx,
          source: 'searxng' as const,
          notice: key === undefined ? NO_KEY : null,
        };
    }

    if (key === undefined) {
      if (searx instanceof UpstreamFault)
        throw new ToolRefusal(`SearXNG failed (${searx.message}), and no Brave key is set`);
      return { results: [], source: 'searxng' as const, notice: NO_KEY };
    }

    const brave = await attempt(() => fromBrave(web, key, input.query, input.count));
    if (!(brave instanceof UpstreamFault)) {
      let notice = 'no SearXNG address is set, so this answer comes from Brave';
      if (searx instanceof UpstreamFault)
        notice = 'SearXNG failed, so this answer comes from Brave';
      else if (searx !== undefined)
        notice = 'SearXNG gave no result, so this answer comes from Brave';
      return { results: brave, source: 'brave' as const, notice };
    }
    if (searx !== undefined && !(searx instanceof UpstreamFault))
      return {
        results: [],
        source: 'searxng' as const,
        notice: 'SearXNG gave no result, and the Brave fallback failed',
      };
    throw new ToolRefusal(
      searx instanceof UpstreamFault
        ? `every search engine failed: SearXNG (${searx.message}) and Brave (${brave.message})`
        : `the search engine failed: Brave (${brave.message})`,
    );
  },
});
