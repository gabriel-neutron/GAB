// The news tool against a stub web. A GDELT answer that is not a list is a refusal, and an empty
// list is an answer only when GDELT says so in JSON.

import { describe, expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { callTool, type Tool } from './tool.ts';
import { json, noSql, stubWeb, text, webReach, type StubWeb } from './web-stub.ts';

const newsSearch = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'news_search');
  if (found === undefined) throw new Error('the catalogue holds no tool named news_search');
  return found;
})();

const INPUT = { query: 'Nayara Energy sanctions', from: '2026-09-01', to: '2026-09-30' };

const ARTICLES = {
  articles: [
    {
      url: 'https://www.reuters.example/world/nayara',
      url_mobile: '',
      title: 'Nayara Energy faces new listing',
      seendate: '20260915T093000Z',
      socialimage: 'https://img.example/x.jpg',
      domain: 'reuters.example',
      language: 'English',
      sourcecountry: 'United Kingdom',
    },
    {
      url: 'javascript:alert(1)',
      title: 'Not a page',
      seendate: '20260916T093000Z',
      domain: 'bad.example',
      language: 'English',
    },
    {
      url: 'https://lemonde.example/economie/nayara',
      title: 'Nayara Energy et les sanctions',
      seendate: '20260914T101500Z',
      domain: 'lemonde.example',
      language: 'French',
    },
  ],
};

const run = (web: StubWeb, input: unknown = INPUT) =>
  callTool(newsSearch, noSql, input, webReach(web));

const refusalOf = async (web: StubWeb, input: unknown = INPUT): Promise<string> => {
  const outcome = await run(web, input);
  if (outcome.ok) throw new Error('the tool took the input, and it had to refuse it');
  return outcome.refusal;
};

describe('a GDELT answer', () => {
  test('gives title, address, date, domain and language, and drops a row with no http address', async () => {
    const web = stubWeb(() => json(ARTICLES));
    expect(await run(web)).toStrictEqual({
      ok: true,
      output: {
        articles: [
          {
            title: 'Nayara Energy faces new listing',
            url: 'https://www.reuters.example/world/nayara',
            date: '2026-09-15T09:30:00.000Z',
            domain: 'reuters.example',
            language: 'English',
          },
          {
            title: 'Nayara Energy et les sanctions',
            url: 'https://lemonde.example/economie/nayara',
            date: '2026-09-14T10:15:00.000Z',
            domain: 'lemonde.example',
            language: 'French',
          },
        ],
      },
    });
  });

  test('the request goes to the constant host with the dates of the input', async () => {
    const web = stubWeb(() => json(ARTICLES));
    await run(web);

    expect(web.asked).toHaveLength(1);
    const { url } = web.asked[0] ?? { url: new URL('https://none.invalid') };
    expect(url.origin).toBe('https://api.gdeltproject.org');
    expect(url.pathname).toBe('/api/v2/doc/doc');
    expect(url.searchParams.get('mode')).toBe('artlist');
    expect(url.searchParams.get('format')).toBe('json');
    expect(url.searchParams.get('query')).toBe(INPUT.query);
    expect(url.searchParams.get('startdatetime')).toBe('20260901000000');
    expect(url.searchParams.get('enddatetime')).toBe('20260930235959');
  });

  test('the list is capped', async () => {
    const many = {
      articles: Array.from({ length: 80 }, (_, n) => ({
        url: `https://news.example/${n}`,
        title: `Article ${n}`,
        seendate: '20260915T093000Z',
        domain: 'news.example',
        language: 'English',
      })),
    };
    const outcome = await run(stubWeb(() => json(many)));
    if (!outcome.ok) throw new Error(outcome.refusal);
    expect((outcome.output as { articles: unknown[] }).articles).toHaveLength(25);
  });

  test('an empty object from GDELT is an empty list', async () => {
    expect(await run(stubWeb(() => json({})))).toStrictEqual({
      ok: true,
      output: { articles: [] },
    });
  });
});

describe('a failure is never an empty list', () => {
  test('a text answer, which is how GDELT words a bad query, is a refusal', async () => {
    expect(await refusalOf(stubWeb(() => text('The specified phrase is too short.')))).toMatch(
      /no list/u,
    );
  });

  test.each([429, 500, 503])('the status %i is a refusal', async (status) => {
    expect(await refusalOf(stubWeb(() => text('', status)))).toContain(String(status));
  });

  test('a fault of the network is a refusal', async () => {
    expect(await refusalOf(stubWeb(() => new Error('socket hang up')))).toBeTruthy();
  });

  test('with no web in the reach, the tool refuses', async () => {
    expect((await callTool(newsSearch, noSql, INPUT, undefined)).ok).toBe(false);
  });
});

describe('the input', () => {
  test.each([
    { ...INPUT, from: '2026-10-01' },
    { ...INPUT, from: '01/09/2026' },
    { ...INPUT, to: 'tomorrow' },
    { ...INPUT, query: '   ' },
    { query: 'x', from: '2026-09-01' },
  ])('the input %j is refused before any request', async (input) => {
    const web = stubWeb(() => json({}));
    expect((await run(web, input)).ok).toBe(false);
    expect(web.asked).toStrictEqual([]);
  });
});
