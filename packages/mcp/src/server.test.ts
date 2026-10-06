// An MCP client talks to the server in the same process. The pool is a fake, so the test proves
// the list and the dispatch and reaches no database.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CATALOGUE } from '@gab/tools/catalogue';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { RESEARCH_GROUPS } from './groups.ts';
import { createServer, type SessionPool } from './server.ts';

interface Seen {
  readonly texts: string[];
  released: number;
}

const fakePool = (
  answer: (text: string) => readonly unknown[],
): { pool: SessionPool; seen: Seen } => {
  const seen: Seen = { texts: [], released: 0 };
  const pool: SessionPool = {
    connect: () =>
      Promise.resolve({
        query: (text: string) => {
          seen.texts.push(text);
          return Promise.resolve({ rows: answer(text) });
        },
        release: () => {
          seen.released += 1;
        },
      }),
  };
  return { pool, seen };
};

const connected = async (pool: SessionPool): Promise<Client> => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(pool).connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
};

const textOf = (result: unknown): string => {
  const parsed = z
    .object({ content: z.array(z.object({ type: z.literal('text'), text: z.string() })) })
    .parse(result);
  return parsed.content.map((part) => part.text).join('');
};

const isErrorOf = (result: unknown): boolean =>
  z.object({ isError: z.boolean().optional() }).parse(result).isError === true;

test('the server lists the five groups and no other tool', async () => {
  const client = await connected(fakePool(() => []).pool);
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name)).toStrictEqual([
    'graph',
    'document',
    'web',
    'propose',
    'job',
  ]);
});

test('each listed tool has a Zod input schema for each of its actions', async () => {
  const client = await connected(fakePool(() => []).pool);
  const { tools } = await client.listTools();
  for (const listed of tools) {
    const actions: readonly string[] = RESEARCH_GROUPS[listed.name as keyof typeof RESEARCH_GROUPS];
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      const tool = CATALOGUE.find((entry) => entry.name === action);
      expect(tool?.input).toBeInstanceOf(z.ZodType);
      expect(listed.description).toContain(action);
    }
    const schema = listed.inputSchema as Record<string, unknown>;
    expect(schema['type']).toBe('object');
    expect(schema).not.toHaveProperty('oneOf');
    expect(schema).not.toHaveProperty('anyOf');
    expect(schema).not.toHaveProperty('allOf');
    expect(schema).not.toHaveProperty('$schema');
    const properties = z
      .object({ action: z.object({ enum: z.array(z.string()) }), input: z.unknown() })
      .parse(schema['properties']);
    expect(properties.action.enum).toStrictEqual([...actions]);
  }
});

test('the groups hold each tool of the catalogue once, and only tools of the catalogue', () => {
  const grouped = Object.values(RESEARCH_GROUPS).flat();
  expect(new Set(grouped).size).toBe(grouped.length);
  const known = new Set(CATALOGUE.map((tool) => tool.name));
  for (const name of grouped) expect(known.has(name)).toBe(true);
});

test('an action that the group does not hold comes back as a tool error', async () => {
  const { pool, seen } = fakePool(() => []);
  const client = await connected(pool);
  const result = await client.callTool({
    name: 'graph',
    arguments: { action: 'propose', input: {} },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('action');
  expect(seen.texts).toStrictEqual([]);
});

test('an input that the tool refuses comes back as the refusal of the tool', async () => {
  const { pool, seen } = fakePool(() => []);
  const client = await connected(pool);
  const result = await client.callTool({
    name: 'job',
    arguments: { action: 'job_status', input: { document: '' } },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toMatch(/^document: /u);
  expect(seen.texts).toStrictEqual([]);
  expect(seen.released).toBe(1);
});

test('an unknown tool comes back as a tool error', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool({ name: 'write', arguments: {} });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('write');
});

test('a fault of the database returns its code and never its message', async () => {
  const { pool, seen } = fakePool(() => {
    throw Object.assign(
      new Error('password authentication failed for user "gabriel_app" at db.example.org'),
      { code: '28P01' },
    );
  });
  const client = await connected(pool);
  const result = await client.callTool({
    name: 'graph',
    arguments: { action: 'search_graph', input: { query: 'Regulation' } },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toBe('the database refused the call (SQLSTATE 28P01)');
  expect(seen.released).toBe(1);
});

test('a good call returns the output of the tool as text', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool({
    name: 'graph',
    arguments: { action: 'search_graph', input: { query: 'Regulation' } },
  });
  expect(isErrorOf(result)).toBe(false);
  expect(JSON.parse(textOf(result))).toStrictEqual({ entities: [] });
});

test('the document group runs fetch_document with the reach that the server was given', async () => {
  const { pool, seen } = fakePool(() => []);
  const puts: unknown[] = [];
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(pool, {
    store: {
      put: (object) => {
        puts.push(object);
        return Promise.resolve(object.key);
      },
    },
    now: () => new Date('2026-10-05T10:00:00Z'),
  }).connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  const result = await client.callTool({
    name: 'document',
    arguments: { action: 'fetch_document', input: { url: 'http://127.0.0.1/' } },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toMatch(/127\.0\.0\.1.*refused/u);
  expect(seen.texts).toStrictEqual([]);
  expect(puts).toStrictEqual([]);
});

test('with no reach, fetch_document refuses and names the object store', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool({
    name: 'document',
    arguments: { action: 'fetch_document', input: { url: 'https://example.org/' } },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('object store');
});

test('the web group runs web_search with the web that the server was given', async () => {
  const { pool, seen } = fakePool(() => []);
  const asked: string[] = [];
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(pool, {
    now: () => new Date('2026-10-05T10:00:00Z'),
    web: {
      searxngUrl: 'http://127.0.0.1:8888',
      get: (url) => {
        asked.push(url);
        return Promise.resolve({
          status: 200,
          headers: {},
          body: JSON.stringify({
            results: [{ title: 'A', url: 'https://example.org/a', content: 'b', engine: 'bing' }],
          }),
        });
      },
    },
  }).connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  const result = await client.callTool({
    name: 'web',
    arguments: { action: 'web_search', input: { query: 'Nayara' } },
  });
  expect(isErrorOf(result)).toBe(false);
  expect(JSON.parse(textOf(result))).toMatchObject({
    results: [{ title: 'A', url: 'https://example.org/a', snippet: 'b', engine: 'bing' }],
    source: 'searxng',
  });
  expect(asked).toHaveLength(1);
  expect(seen.texts).toStrictEqual([]);
});

test('with no reach, web_search refuses and names the web', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool({
    name: 'web',
    arguments: { action: 'web_search', input: { query: 'Nayara' } },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('web');
});
