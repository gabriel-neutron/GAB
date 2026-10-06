// The search tool against a stub web. A key must leave in a header and never in an address, an
// output or a refusal, and a total failure must never read as an empty list of results.

import { afterEach, describe, expect, test, vi } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { callTool, type Tool } from './tool.ts';
import { json, noSql, stubWeb, text, webReach, type Answerer, type StubWeb } from './web-stub.ts';

const webSearch = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'web_search');
  if (found === undefined) throw new Error('the catalogue holds no tool named web_search');
  return found;
})();

const SEARX = 'http://127.0.0.1:8888';
const KEY = 'BSA-secret-0123456789';
const CLAIM = 'Nayara annex 2025/1476 was never published';

const searxRow = (n: number) => ({
  title: `Result ${n}`,
  url: `https://example.org/${n}`,
  content: `Snippet ${n}`,
  engine: 'duckduckgo',
  engines: ['duckduckgo', 'bing'],
  score: 1,
});

const braveBody = {
  web: {
    results: [
      {
        title: 'Brave one',
        url: 'https://example.net/one',
        description: 'A <strong>bold</strong> snippet',
      },
    ],
  },
};

const answerWith =
  (searx: Answerer | undefined, brave: Answerer | undefined): Answerer =>
  (asked) => {
    if (asked.url.host === '127.0.0.1:8888' && searx !== undefined) return searx(asked);
    if (asked.url.host === 'api.search.brave.com' && brave !== undefined) return brave(asked);
    return new Error(`no route for ${asked.url.host}`);
  };

const run = (web: StubWeb, input: unknown) => callTool(webSearch, noSql, input, webReach(web));

const outputOf = (outcome: Awaited<ReturnType<typeof run>>): Record<string, unknown> => {
  if (!outcome.ok) throw new Error(`the tool refused: ${outcome.refusal}`);
  return outcome.output as Record<string, unknown>;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SearXNG answers', () => {
  test('a SearXNG answer gives title, address, snippet and engine, capped by the count', async () => {
    const web = stubWeb(
      answerWith(() => json({ results: [1, 2, 3, 4].map(searxRow) }), undefined),
      { searxngUrl: SEARX },
    );
    const outcome = await run(web, { query: 'Nayara annex', count: 3 });

    expect(outcome).toStrictEqual({
      ok: true,
      output: {
        results: [1, 2, 3].map((n) => ({
          title: `Result ${n}`,
          url: `https://example.org/${n}`,
          snippet: `Snippet ${n}`,
          engine: 'duckduckgo',
        })),
        source: 'searxng',
        notice: 'no Brave key is set, so this answer comes from SearXNG alone',
      },
    });
    expect(web.asked).toHaveLength(1);
    expect(web.asked[0]?.url.origin).toBe(SEARX);
    expect(web.asked[0]?.url.pathname).toBe('/search');
    expect(web.asked[0]?.url.searchParams.get('format')).toBe('json');
    expect(web.asked[0]?.url.searchParams.get('q')).toBe('Nayara annex');
  });

  test('with a key set, a SearXNG answer carries no notice', async () => {
    const web = stubWeb(
      answerWith(() => json({ results: [searxRow(1)] }), undefined),
      { searxngUrl: SEARX, braveKey: KEY },
    );
    expect(outputOf(await run(web, { query: 'Nayara' }))['notice']).toBeNull();
    expect(web.asked).toHaveLength(1);
  });

  test('a row without an http address is dropped', async () => {
    const web = stubWeb(
      answerWith(
        () =>
          json({
            results: [
              { ...searxRow(1), url: 'javascript:alert(1)' },
              { ...searxRow(2), url: 'ftp://example.org/x' },
              searxRow(3),
            ],
          }),
        undefined,
      ),
      { searxngUrl: SEARX },
    );
    expect(outputOf(await run(web, { query: 'x' }))['results']).toHaveLength(1);
  });
});

describe('the Brave fallback', () => {
  test('a SearXNG failure falls back to Brave, and the key goes in a header', async () => {
    const web = stubWeb(
      answerWith(
        () => text('boom', 500),
        () => json(braveBody),
      ),
      { searxngUrl: SEARX, braveKey: KEY },
    );
    const outcome = await run(web, { query: 'Nayara annex' });

    expect(outcome).toStrictEqual({
      ok: true,
      output: {
        results: [
          {
            title: 'Brave one',
            url: 'https://example.net/one',
            snippet: 'A bold snippet',
            engine: 'brave',
          },
        ],
        source: 'brave',
        notice: 'SearXNG failed, so this answer comes from Brave',
      },
    });
    const call = web.asked[1];
    expect(call?.url.origin).toBe('https://api.search.brave.com');
    expect(call?.headers['x-subscription-token']).toBe(KEY);
    for (const asked of web.asked) expect(asked.url.href).not.toContain(KEY);
    expect(JSON.stringify(outcome)).not.toContain(KEY);
  });

  test('a SearXNG answer with no result also falls back to Brave', async () => {
    const web = stubWeb(
      answerWith(
        () => json({ results: [] }),
        () => json(braveBody),
      ),
      { searxngUrl: SEARX, braveKey: KEY },
    );
    expect(outputOf(await run(web, { query: 'rare' }))['source']).toBe('brave');
  });

  test('with no SearXNG address, Brave answers alone and the notice says so', async () => {
    const web = stubWeb(
      answerWith(undefined, () => json(braveBody)),
      { braveKey: KEY },
    );
    expect(outputOf(await run(web, { query: 'x' }))['notice']).toBe(
      'no SearXNG address is set, so this answer comes from Brave',
    );
    expect(web.asked).toHaveLength(1);
  });

  test('a SearXNG answer with no result and a Brave failure is an empty answer that says why', async () => {
    const web = stubWeb(
      answerWith(
        () => json({ results: [] }),
        () => text('limit', 429),
      ),
      { searxngUrl: SEARX, braveKey: KEY },
    );
    expect(await run(web, { query: 'rare' })).toStrictEqual({
      ok: true,
      output: {
        results: [],
        source: 'searxng',
        notice: 'SearXNG gave no result, and the Brave fallback failed',
      },
    });
  });
});

describe('a failure is never an empty answer', () => {
  test('SearXNG and Brave both fail: the tool refuses', async () => {
    const web = stubWeb(
      answerWith(
        () => text('boom', 502),
        () => text('forbidden', 403),
      ),
      { searxngUrl: SEARX, braveKey: KEY },
    );
    expect((await run(web, { query: CLAIM })).ok).toBe(false);
  });

  test('SearXNG fails and no key is set: the tool refuses', async () => {
    const web = stubWeb(
      answerWith(() => new Error('connect ECONNREFUSED'), undefined),
      { searxngUrl: SEARX },
    );
    expect((await run(web, { query: 'x' })).ok).toBe(false);
  });

  test('an answer that is not JSON counts as a failure', async () => {
    const web = stubWeb(
      answerWith(() => text('<html>blocked</html>'), undefined),
      { searxngUrl: SEARX },
    );
    expect((await run(web, { query: 'x' })).ok).toBe(false);
  });

  test('with no engine set, the tool refuses and asks for none', async () => {
    const web = stubWeb(answerWith(undefined, undefined));
    expect((await run(web, { query: 'x' })).ok).toBe(false);
    expect(web.asked).toStrictEqual([]);
  });

  test('with no web in the reach, the tool refuses', async () => {
    expect((await callTool(webSearch, noSql, { query: 'x' }, undefined)).ok).toBe(false);
  });
});

describe('the SearXNG setting is an http address', () => {
  test.each(['ftp://127.0.0.1', 'not an address'])('%s is never asked', async (searxngUrl) => {
    const web = stubWeb(
      answerWith(() => json({ results: [searxRow(1)] }), undefined),
      { searxngUrl },
    );
    expect((await run(web, { query: 'x' })).ok).toBe(false);
    expect(web.asked).toStrictEqual([]);
  });

  test('a bad SearXNG address does not stop the Brave fallback', async () => {
    const web = stubWeb(
      answerWith(undefined, () => json(braveBody)),
      { searxngUrl: 'not an address', braveKey: KEY },
    );
    expect(outputOf(await run(web, { query: 'x' }))['source']).toBe('brave');
    expect(web.asked.map((asked) => asked.url.host)).toStrictEqual(['api.search.brave.com']);
  });
});

describe('a key and a claim go nowhere they should not', () => {
  test('a fault that holds the key leaves no trace in the refusal', async () => {
    const web = stubWeb(
      answerWith(
        () => new Error(`GET failed with token ${KEY}`),
        () => new Error(`GET failed with token ${KEY}`),
      ),
      { searxngUrl: SEARX, braveKey: KEY },
    );
    const outcome = await run(web, { query: 'x' });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).not.toContain(KEY);
  });

  test('an upstream that echoes the key in its body leaves no trace in the refusal', async () => {
    const web = stubWeb(
      answerWith(
        () => text(`bad token ${KEY}`, 500),
        () => text(`bad token ${KEY}`, 401),
      ),
      { searxngUrl: SEARX, braveKey: KEY },
    );
    const outcome = await run(web, { query: 'x' });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).not.toContain(KEY);
  });

  test('the claim text reaches no console and no output', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) =>
      vi.spyOn(console, name).mockImplementation(() => undefined),
    );
    const answered = await run(
      stubWeb(
        answerWith(
          () => text('boom', 500),
          () => json(braveBody),
        ),
        { searxngUrl: SEARX, braveKey: KEY },
      ),
      { query: CLAIM },
    );
    const failed = await run(
      stubWeb(
        answerWith(
          () => text('boom', 500),
          () => text('boom', 500),
        ),
        { searxngUrl: SEARX, braveKey: KEY },
      ),
      { query: CLAIM },
    );

    expect(JSON.stringify(answered)).not.toContain(CLAIM);
    expect(JSON.stringify(failed)).not.toContain(CLAIM);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('the input', () => {
  test.each([{ query: '' }, { query: '   ' }, { query: 'x', count: 0 }, { query: 'x', count: 21 }])(
    'the input %j is refused before any request',
    async (input) => {
      const web = stubWeb(() => json({ results: [] }), { searxngUrl: SEARX });
      expect((await run(web, input)).ok).toBe(false);
      expect(web.asked).toStrictEqual([]);
    },
  );
});
