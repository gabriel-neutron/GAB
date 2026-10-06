// An MCP client talks to the server in the same process. The pool is a fake, so the test proves
// the list and the dispatch and reaches no database.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CATALOGUE } from '@gab/tools/catalogue';
import type { Reach } from '@gab/tools/tool';
import { expect, test } from 'vitest';
import { z } from 'zod';

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

const connected = async (pool: SessionPool, reach?: Reach): Promise<Client> => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(pool, reach).connect(serverSide);
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

const SEARCH = { name: 'search_graph', arguments: { query: 'Regulation' } };

test('each tool of the catalogue is listed once, flat, with a read or write hint', async () => {
  const client = await connected(fakePool(() => []).pool);
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name).sort()).toStrictEqual(
    CATALOGUE.map((tool) => tool.name).sort(),
  );
  for (const listed of tools) {
    expect(listed.inputSchema.type).toBe('object');
    expect(listed.inputSchema).not.toHaveProperty('oneOf');
    expect(listed.inputSchema).not.toHaveProperty('anyOf');
    expect(listed.inputSchema).not.toHaveProperty('$schema');
    expect(typeof listed.annotations?.readOnlyHint).toBe('boolean');
    if (listed.annotations?.readOnlyHint === false)
      expect(listed.annotations.destructiveHint).toBe(false);
  }
});

test('the tools that are not marked as reads are the eleven writes', async () => {
  const client = await connected(fakePool(() => []).pool);
  const writes = (await client.listTools()).tools
    .filter((tool) => tool.annotations?.readOnlyHint !== true)
    .map((tool) => tool.name);
  expect(writes).toStrictEqual([
    'archive_snapshot',
    'fetch_document',
    'telegram_channel',
    'gleif_lookup',
    'companies_house',
    'wikidata_ids',
    'sanctions_match',
    'vessel_events',
    'enqueue_extract',
    'start_lead',
    'propose',
  ]);
});

test('no input asks for a value that only the runner knows', async () => {
  const client = await connected(fakePool(() => []).pool);
  const text = JSON.stringify((await client.listTools()).tools.map((tool) => tool.inputSchema));
  for (const word of ['modelCallId', 'callId', 'idempotency', 'renderBelow', '"render"'])
    expect(text).not.toContain(word);
});

test('an input that the tool refuses names the field and how to write it', async () => {
  const { pool, seen } = fakePool(() => []);
  const client = await connected(pool);
  const result = await client.callTool({
    name: 'propose',
    arguments: {
      items: [
        {
          ref: 'nayara',
          act: { op: 'create_entity', type: 'vessel', label: 'Nayara', attrs: { imo: '9074729' } },
          originator: 'The port authority',
          modality: 'asserts',
          evidence: [{ document: 'doc_0123456789ab', page: 1, excerpt: 'the tanker Nayara' }],
        },
      ],
    },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toMatch(/^items\.0\.act\.attrs\.imo: /u);
  expect(textOf(result)).toContain('{"imo": {"v": "9074729"}}');
  expect(seen.texts).toStrictEqual([]);
  expect(seen.released).toBe(1);
});

test('an input field that the tool does not declare is refused by its name', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool({
    name: 'fetch_document',
    arguments: { url: 'https://example.org/', renderBelow: 0 },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('renderBelow');
});

test('an unknown tool comes back as a tool error', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool({ name: 'lookup_entity', arguments: {} });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('lookup_entity');
});

const HIDDEN = [
  ['28P01', 'password authentication failed for user "gabriel_app" at db.example.org'],
  ['08006', 'connection to db.example.org:5432 failed'],
  ['42501', 'permission denied for function promote_proposal'],
] as const;

for (const [code, message] of HIDDEN)
  test(`a fault of class ${code.slice(0, 2)} returns its code and never its message`, async () => {
    const { pool, seen } = fakePool(() => {
      throw Object.assign(new Error(message), { code });
    });
    const client = await connected(pool);
    const result = await client.callTool(SEARCH);
    expect(isErrorOf(result)).toBe(true);
    expect(textOf(result)).toBe(`the database refused the call (SQLSTATE ${code})`);
    expect(seen.released).toBe(1);
  });

test('a connection that does not open names no host', async () => {
  const pool: SessionPool = {
    connect: () => Promise.reject(new Error('connect ECONNREFUSED db.example.org:5432')),
  };
  const client = await connected(pool);
  const result = await client.callTool(SEARCH);
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toBe('the database refused the call');
});

for (const code of ['22023', '23503', 'P0001'])
  test(`a refusal of class ${code.slice(0, 2)} gives the reason and the field`, async () => {
    const { pool } = fakePool(() => {
      throw Object.assign(new Error('document doc_absent does not exist'), {
        code,
        hint: 'document',
      });
    });
    const client = await connected(pool);
    const result = await client.callTool({
      name: 'job_status',
      arguments: { document: 'doc_absent' },
    });
    expect(isErrorOf(result)).toBe(true);
    expect(textOf(result)).toBe(
      'the record refused the call: document: document doc_absent does not exist',
    );
  });

test('a good call returns the output of the tool as text', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool(SEARCH);
  expect(isErrorOf(result)).toBe(false);
  expect(JSON.parse(textOf(result))).toStrictEqual({ entities: [] });
});

test('fetch_document runs with the reach that the server was given', async () => {
  const { pool, seen } = fakePool(() => []);
  const puts: unknown[] = [];
  const client = await connected(pool, {
    store: {
      put: (object) => {
        puts.push(object);
        return Promise.resolve(object.key);
      },
    },
    now: () => new Date('2026-10-05T10:00:00Z'),
  });
  const result = await client.callTool({
    name: 'fetch_document',
    arguments: { url: 'http://127.0.0.1/' },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toMatch(/127\.0\.0\.1.*refused/u);
  expect(seen.texts).toStrictEqual([]);
  expect(puts).toStrictEqual([]);
});

test('with no reach, fetch_document refuses and names the object store', async () => {
  const client = await connected(fakePool(() => []).pool);
  const result = await client.callTool({
    name: 'fetch_document',
    arguments: { url: 'https://example.org/' },
  });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('object store');
});

test('web_search runs with the web that the server was given', async () => {
  const { pool, seen } = fakePool(() => []);
  const asked: string[] = [];
  const client = await connected(pool, {
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
  });
  const result = await client.callTool({ name: 'web_search', arguments: { query: 'Nayara' } });
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
  const result = await client.callTool({ name: 'web_search', arguments: { query: 'Nayara' } });
  expect(isErrorOf(result)).toBe(true);
  expect(textOf(result)).toContain('web');
});
