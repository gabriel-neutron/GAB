import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_SEGMENTS } from './pages.ts';
import worker, { toHtml } from './worker.ts';

const MANIFEST = {
  version: '1',
  date: '2026-01-01',
  contacts: { reportError: 'mailto:a@example.org' },
  files: [{ path: 'entities.csv' }],
};

const env = {
  ASSETS: {
    fetch: (request: Request): Promise<Response> => {
      const path = new URL(request.url).pathname;
      if (path === '/release/manifest.json') return Promise.resolve(Response.json(MANIFEST));
      return Promise.resolve(
        new Response('<html lang="en"><head></head><body><div id="root"></div></body></html>', {
          headers: { 'content-type': 'text/html' },
        }),
      );
    },
  },
};

const get = (path: string, headers: Record<string, string> = {}): Promise<Response> =>
  worker.fetch(new Request(`https://example.org${path}`, { headers }), env);

describe('the application pages', () => {
  it('match the files under src/routes', () => {
    const found = new Set(
      readdirSync(join(import.meta.dirname, '../../src/routes'))
        .map((name) => name.split('.')[0] ?? '')
        .filter((name) => name !== '__root' && name !== 'index'),
    );
    expect([...found].sort()).toEqual([...APP_SEGMENTS].sort());
  });
});

describe('the edge worker', () => {
  it('answers 404 with a markdown body for an unknown address', async () => {
    const response = await get('/nothing-here');
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('# 404');
  });

  it('answers markdown for a page when the request asks for it', async () => {
    const response = await get('/', { accept: 'text/markdown' });
    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(response.headers.get('vary')).toContain('Accept');
    expect((await response.text()).length).toBeGreaterThan(200);
  });

  it('adds the Link header and the page head to the shell', async () => {
    const response = await get('/');
    expect(response.headers.get('link')).toContain('rel="sitemap"');
    const html = await response.text();
    expect(html).toContain('application/ld+json');
    expect(html).toContain('<div id="root"></div>');
  });

  it('serves a valid skills index and the catalog', async () => {
    const index = (await (await get('/.well-known/agent-skills/index.json')).json()) as {
      skills: { digest: string }[];
    };
    expect(index.skills[0]?.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    const catalog = (await (await get('/.well-known/ai-catalog.json')).json()) as {
      entries: unknown[];
    };
    expect(catalog.entries.length).toBeGreaterThan(0);
  });

  it('answers 404, not an error, for a name from Object.prototype', async () => {
    expect((await get('/constructor')).status).toBe(404);
    expect((await get('/.well-known/agent-skills/constructor/SKILL.md')).status).toBe(404);
  });

  it('serves the markdown twin of an application page', async () => {
    const response = await get('/nodes.md');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
  });

  it('answers a missing file with a JSON body', async () => {
    const response = await get('/release/nope.csv');
    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: string }).error).toContain('nope.csv');
  });

  it('copies the noindex header of the host to a generated response', async () => {
    const closed = {
      ASSETS: {
        fetch: (): Promise<Response> =>
          Promise.resolve(new Response('x', { headers: { 'x-robots-tag': 'noindex' } })),
      },
    };
    const response = await worker.fetch(new Request('https://example.org/llms.txt'), closed);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('serves the crawl files', async () => {
    expect(await (await get('/robots.txt')).text()).toContain(
      'Sitemap: https://example.org/sitemap.xml',
    );
    expect(await (await get('/sitemap.xml')).text()).toContain('<urlset');
  });
});

describe('toHtml', () => {
  it('escapes markup and keeps links', () => {
    expect(toHtml('<b> [a](b)')).toBe('<p>&lt;b&gt; <a href="b">a</a></p>');
  });
});

describe('the MCP server and the versioned list', () => {
  const rpc = (method: string, params?: object): Promise<Response> =>
    worker.fetch(
      new Request('https://example.org/mcp', {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      }),
      env,
    );

  it('lists the tools and calls one', async () => {
    const list = (await (await rpc('tools/list')).json()) as {
      result: { tools: { name: string }[] };
    };
    expect(list.result.tools.map((tool) => tool.name)).toContain('cite');
    const call = (await (
      await rpc('tools/call', { name: 'get_file_url', arguments: { file: 'entities.csv' } })
    ).json()) as { result: { structuredContent: { url: string } } };
    expect(call.result.structuredContent.url).toBe('https://example.org/release/entities.csv');
  });

  it('reports a tool fault as an error result, not a crash', async () => {
    const call = (await (
      await rpc('tools/call', { name: 'get_file_url', arguments: { file: 'nope' } })
    ).json()) as { result: { isError: boolean } };
    expect(call.result.isError).toBe(true);
    expect(
      ((await (await rpc('constructor')).json()) as { error: { code: number } }).error.code,
    ).toBe(-32601);
  });

  it('pages the file list and refuses a bad parameter with a JSON error', async () => {
    const page = (await (await get('/api/v1/files?limit=1')).json()) as {
      data: unknown[];
      next: string | null;
    };
    expect(page.data).toHaveLength(1);
    expect(page.next).toBeNull();
    const bad = await get('/api/v1/files?limit=0');
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { code: string }).code).toBe('invalid_parameter');
  });

  it('serves the server card', async () => {
    const card = (await (await get('/.well-known/mcp/server-card.json')).json()) as {
      remotes: { url: string }[];
    };
    expect(card.remotes[0]?.url).toBe('https://example.org/mcp');
  });
});

describe('the faults of the MCP server', () => {
  const post = (body: string): Promise<Response> =>
    worker.fetch(new Request('https://example.org/mcp', { method: 'POST', body }), env);

  it('answers a body that is no JSON with -32700', async () => {
    const answer = (await (await post('{nope')).json()) as { error: { code: number } };
    expect(answer.error.code).toBe(-32700);
  });

  it('answers an unknown tool with -32602 and refuses a large body', async () => {
    const call = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'nope' },
    });
    expect(((await (await post(call)).json()) as { error: { code: number } }).error.code).toBe(
      -32602,
    );
    expect((await post('x'.repeat(70_000))).status).toBe(413);
  });

  it('cites a claim identifier that holds a slash, encoded', async () => {
    const call = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'cite', arguments: { kind: 'claim', identifier: '0a1f/valid to' } },
    });
    const answer = (await (await post(call)).json()) as {
      result: { structuredContent: { address: string } };
    };
    expect(answer.result.structuredContent.address).toBe(
      'https://example.org/claim/0a1f/valid%20to',
    );
  });

  it('answers 503, not an empty list, when the manifest cannot be read', async () => {
    const broken = {
      ASSETS: { fetch: (): Promise<Response> => Promise.resolve(new Response('x')) },
    };
    const response = await worker.fetch(new Request('https://example.org/api/v1/files'), broken);
    expect(response.status).toBe(503);
  });
});

describe('the rate limit', () => {
  it('answers 429 with Retry-After when the limiter refuses', async () => {
    const limited = { ...env, RATE_LIMIT: { limit: () => Promise.resolve({ success: false }) } };
    const response = await worker.fetch(new Request('https://example.org/api/v1/files'), limited);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(((await response.json()) as { code: string }).code).toBe('rate_limited');
  });
});

describe('the pages for agents', () => {
  it('serves /auth.md as markdown and states the content signals in robots.txt', async () => {
    const auth = await get('/auth.md');
    expect(auth.headers.get('content-type')).toContain('text/markdown');
    expect(await auth.text()).toContain('needs no authentication');
    expect(await (await get('/robots.txt')).text()).toContain('Content-Signal:');
  });
});
