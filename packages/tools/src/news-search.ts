import { z } from 'zod';

import { clipped, isWebAddress, UpstreamFault, answerOf, webFromReach } from './web-access.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// External constraint: GDELT DOC 2.0 has one host, and its list holds at most 250 rows. The cap
// here is lower, because a lead list that a model must read is a cost.
const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const MAX_ARTICLES = 25;
const MAX_TITLE = 300;

const day = z.iso.date();

const article = z.object({
  url: z.string(),
  title: z.string(),
  seendate: z.string(),
  domain: z.string().optional(),
  language: z.string().optional(),
});

const outputShape = z.strictObject({
  articles: z.array(
    z.strictObject({
      title: z.string(),
      url: z.string(),
      date: z.string().nullable(),
      domain: z.string(),
      language: z.string().nullable(),
    }),
  ),
});

// GDELT writes a date as 20260915T093000Z.
const dateOf = (seen: string): string | null => {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u.exec(seen);
  if (match === null) return null;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
};

export const newsSearch = defineTool({
  name: 'news_search',
  description:
    'Lists news articles of GDELT DOC 2.0 that match a query between two days, with title, ' +
    'address, date, domain and language. GDELT keeps about the last three months. An article is ' +
    'a lead and not a source: nothing is stored, so fetch the page with fetch_document before ' +
    'you cite it.',
  input: z
    .strictObject({ query: z.string().trim().min(1).max(500), from: day, to: day })
    .refine((given) => given.from <= given.to, {
      path: ['from'],
      message: 'from must not be after to',
    }),
  output: outputShape,
  async run(_session, input, reach) {
    const web = webFromReach(reach);
    const url = new URL(GDELT);
    url.searchParams.set('query', input.query);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxrecords', String(MAX_ARTICLES));
    url.searchParams.set('sort', 'datedesc');
    url.searchParams.set('startdatetime', `${input.from.replaceAll('-', '')}000000`);
    url.searchParams.set('enddatetime', `${input.to.replaceAll('-', '')}235959`);

    let body: string;
    try {
      ({ body } = await answerOf(web, url.href));
    } catch (fault) {
      if (fault instanceof UpstreamFault)
        throw new ToolRefusal(`the news search failed: ${fault.message}`);
      throw fault;
    }

    // GDELT words a bad query as plain text with a good status, so a body that is not JSON is a
    // refusal. An empty list is the object with no key.
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new ToolRefusal('GDELT gave no list for this query: it may be too short or too common');
    }
    const list = z.object({ articles: z.array(z.unknown()).optional() }).safeParse(parsed);
    if (!list.success) throw new ToolRefusal('GDELT gave no list for this query');

    const articles: z.output<typeof outputShape>['articles'] = [];
    for (const held of list.data.articles ?? []) {
      const row = article.safeParse(held);
      if (!row.success || !isWebAddress(row.data.url)) continue;
      articles.push({
        title: clipped(row.data.title, MAX_TITLE),
        url: row.data.url,
        date: dateOf(row.data.seendate),
        domain: row.data.domain ?? new URL(row.data.url).hostname,
        language: row.data.language ?? null,
      });
      if (articles.length === MAX_ARTICLES) break;
    }
    return { articles };
  },
});
