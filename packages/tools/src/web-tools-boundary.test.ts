// What the three web tools may not do: they write no row and no object, with any answer of the web.

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { callTool, type Tool } from './tool.ts';
import { memoryStore } from './fetch-fixture.ts';
import { json, recordingSession, stubWeb, text } from './web-stub.ts';

const NAMES = ['web_search', 'archive_snapshot', 'news_search'] as const;

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

test('the three web tools are in the catalogue', () => {
  expect(NAMES.map((name) => toolNamed(name).name)).toStrictEqual([...NAMES]);
});

test('no web tool writes a row or an object, with any answer of the web', async () => {
  const store = memoryStore();
  const session = recordingSession([{ one: 1 }]);
  const web = stubWeb(
    (asked) => {
      if (asked.url.pathname.startsWith('/save/'))
        return text('', 302, { location: '/web/20261005100001/https://example.org/x' });
      if (asked.url.pathname === '/cdx/search/cdx') return json([['timestamp'], []]);
      if (asked.url.host === 'api.gdeltproject.org') return json({ articles: [] });
      return json({ results: [] });
    },
    { searxngUrl: 'http://127.0.0.1:8888' },
  );
  const reach = { store, web, now: () => new Date('2026-10-05T10:00:00Z') };

  await callTool(toolNamed('web_search'), session, { query: 'x' }, reach);
  await callTool(
    toolNamed('news_search'),
    session,
    { query: 'x', from: '2026-09-01', to: '2026-09-02' },
    reach,
  );
  await callTool(toolNamed('archive_snapshot'), session, { url: 'https://example.org/a' }, reach);
  await callTool(
    toolNamed('archive_snapshot'),
    session,
    { url: 'https://example.org/a', capture: true },
    reach,
  );

  expect(store.puts).toStrictEqual([]);
  for (const statement of session.statements)
    expect(statement).not.toMatch(/\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE)\b/iu);
  for (const asked of web.asked) {
    expect(['https:', 'http:']).toContain(asked.url.protocol);
    expect(asked.request.timeoutMs).toBeGreaterThan(0);
    expect(asked.request.maxBytes).toBeGreaterThan(0);
  }
});
