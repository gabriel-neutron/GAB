// The two maritime lookups against the disposable database as gabriel_research, with a stub web
// and a store in memory. The door writes an api document, and the same answer twice is one
// document. Each call runs inside a transaction that rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type Session, type Tool } from './tool.ts';
import { json, stubWeb, text } from './web-stub.ts';

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

const sessionOf = (ask: Ask): Session => ({
  query: async (statement, values) => ({ rows: await ask(statement, values) }),
});

const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ENTITY = `NK-${RUN}`;
const VESSEL = `vessel-${RUN}`;

const web = stubWeb(
  (asked) => {
    if (asked.url.pathname === `/entities/${ENTITY}`)
      return json({ id: ENTITY, caption: `Sea Star ${RUN}`, schema: 'Vessel' });
    if (asked.url.pathname === '/v3/events') return json({ entries: [] });
    return text('absent', 404);
  },
  { openSanctionsKey: 'key', gfwToken: 'token' },
);

const row = z.object({ kind: z.string(), mime: z.string(), pages: z.number() });

const heldBy = async (ask: Ask, title: string) =>
  z.array(row).parse(
    await ask(
      `SELECT d.kind, d.mime,
              (SELECT count(*) FROM public.document_text t WHERE t.document_id = d.id)::int AS pages
         FROM public.documents d WHERE d.title = $1`,
      [title],
    ),
  );

test('an entity and the events of a vessel are each stored once as an api document', async () => {
  const store = memoryStore();
  const reach = { store, web, now: () => new Date('2026-10-05T10:00:00Z') };
  const input = { vesselId: VESSEL, from: '2026-01-01', to: '2026-02-01' };
  await rolledBack('research', async (ask) => {
    const match = toolNamed('sanctions_match');
    const events = toolNamed('vessel_events');
    expect(await callTool(match, sessionOf(ask), { entityId: ENTITY }, reach)).toMatchObject({
      ok: true,
      output: { entity: { status: 'stored' } },
    });
    expect(await callTool(match, sessionOf(ask), { entityId: ENTITY }, reach)).toMatchObject({
      ok: true,
      output: { entity: { status: 'known' } },
    });
    expect(await callTool(events, sessionOf(ask), input, reach)).toMatchObject({
      ok: true,
      output: { status: 'stored' },
    });
    expect(await heldBy(ask, `OpenSanctions entity ${ENTITY}: Sea Star ${RUN}`)).toStrictEqual([
      { kind: 'api', mime: 'application/json', pages: 1 },
    ]);
    expect(
      await heldBy(
        ask,
        `Global Fishing Watch encounter, loitering, gap events of ${VESSEL} from 2026-01-01 to 2026-02-01`,
      ),
    ).toStrictEqual([{ kind: 'api', mime: 'application/json', pages: 1 }]);
  });
  expect(store.puts).toHaveLength(2);
});
