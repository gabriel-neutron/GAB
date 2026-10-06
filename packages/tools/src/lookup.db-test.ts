// A lookup against the disposable database as gabriel_research, with a stub web and a store in
// memory. The door writes an api document, and the same answer twice is one document. Each call
// runs inside a transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type Session } from './tool.ts';
import { json, stubWeb, text } from './web-stub.ts';

const gleifLookup = CATALOGUE.find((tool) => tool.name === 'gleif_lookup');
if (gleifLookup === undefined) throw new Error('the catalogue holds no tool named gleif_lookup');

const sessionOf = (ask: Ask): Session => ({
  query: async (statement, values) => ({ rows: await ask(statement, values) }),
});

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const LEI = '5493001KJTIIGC8Y1R12';

const web = stubWeb((asked) =>
  asked.url.pathname === `/api/v1/lei-records/${LEI}`
    ? json({
        data: {
          attributes: { lei: LEI, entity: { legalName: { name: `Child ${RUN}` } } },
        },
      })
    : text('absent', 404),
);

const row = z.object({ kind: z.string(), uri: z.string(), mime: z.string(), pages: z.number() });

test('the record of an LEI is stored once as an api document', async () => {
  const store = memoryStore();
  const reach = { store, web, now: () => new Date('2026-10-05T10:00:00Z') };
  await rolledBack('research', async (ask) => {
    const first = await callTool(gleifLookup, sessionOf(ask), { lei: LEI }, reach);
    expect(first).toMatchObject({ ok: true, output: { record: { status: 'stored' } } });
    const second = await callTool(gleifLookup, sessionOf(ask), { lei: LEI }, reach);
    expect(second).toMatchObject({ ok: true, output: { record: { status: 'known' } } });

    const [held] = z.array(row).parse(
      await ask(
        `SELECT d.kind, d.uri, d.mime,
                (SELECT count(*) FROM public.document_text t WHERE t.document_id = d.id)::int AS pages
           FROM public.documents d WHERE d.title = $1`,
        [`GLEIF LEI record ${LEI}`],
      ),
    );
    expect(held).toStrictEqual({
      kind: 'api',
      uri: `https://api.gleif.org/api/v1/lei-records/${LEI}`,
      mime: 'application/json',
      pages: 1,
    });
  });
  expect(store.puts).toHaveLength(1);
});
