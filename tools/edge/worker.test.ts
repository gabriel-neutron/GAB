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
