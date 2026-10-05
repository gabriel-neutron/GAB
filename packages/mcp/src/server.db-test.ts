// The server runs against the disposable database. A proposal goes through one session inside a
// transaction that rolls back, because the ledger refuses a delete.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from '../../../tools/probe.ts';
import { assertSessionRole } from './role.ts';
import { createServer, type SessionPool } from './server.ts';

const SHA = 'e'.repeat(64);
const DOC = `doc_${SHA.slice(0, 12)}`;

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';

const STORED = 'SELECT author_role, status FROM public.proposals WHERE id = $1';

const answer = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
  isError: z.boolean().optional(),
});

// Every call of the server takes the one session of the test, so a call inside a transaction
// stays inside it.
const poolOf = (ask: Ask): SessionPool => ({
  connect: () =>
    Promise.resolve({
      query: async (text: string, values: unknown[]) => ({ rows: await ask(text, values) }),
      release: () => undefined,
    }),
});

test('the session check refuses a session that logs in as another role', async () => {
  await expect(probe('app', (ask) => assertSessionRole(poolOf(ask)))).rejects.toThrow(
    'the MCP server runs only as gabriel_research; the credentials name gabriel_app',
  );
});

test('the session check accepts a session that logs in as gabriel_research', async () => {
  await expect(probe('research', (ask) => assertSessionRole(poolOf(ask)))).resolves.toBe(undefined);
});

test('a call of propose_change through the server stores a proposal of gabriel_research', async () => {
  const found = await rolledBack('research', async (ask) => {
    await ask(STORE, [
      'url',
      'A report of the server test',
      `raw/${SHA}`,
      'https://example.org/server-report',
      SHA,
      'application/pdf',
      '2026-09-02',
      null,
    ]);

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createServer(poolOf(ask)).connect(serverSide);
    const client = new Client({ name: 'test', version: '0.0.0' });
    await client.connect(clientSide);
    try {
      const result = answer.parse(
        await client.callTool({
          name: 'propose',
          arguments: {
            action: 'propose_change',
            input: {
              act: { op: 'create_entity', type: 'legal_act', label: 'Regulation 2025/1476' },
              documents: [DOC],
            },
          },
        }),
      );
      const text = result.content.map((part) => part.text).join('');
      if (result.isError === true) return { refusal: text, rows: [] };
      const made = z.object({ proposalId: z.uuid() }).parse(JSON.parse(text));
      return { refusal: '', rows: await ask(STORED, [made.proposalId]) };
    } finally {
      await client.close();
    }
  });
  expect(found.refusal).toBe('');
  expect(found.rows).toStrictEqual([{ author_role: 'gabriel_research', status: 'pending' }]);
});
