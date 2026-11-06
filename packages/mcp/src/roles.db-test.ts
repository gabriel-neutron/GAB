// The read route through the server of a closer, on the disposable database, with a local HTTP server
// in place of the web. No test calls a denied host: its name resolves to the local server, and the
// count of requests proves that no connection opened.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { FIXTURE_HOST, startFixture } from '@gab/tools/fetch-fixture';
import { hostLease } from '@gab/tools/host-lease';
import type { Reach } from '@gab/tools/tool';
import { expect, onTestFinished, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { ROLES, type Role } from './roles.ts';
import { createServer, type SessionPool } from './server.ts';

const answer = z.object({
  content: z.array(z.object({ text: z.string() })),
  isError: z.boolean().optional(),
});

const poolOf = (ask: Ask): SessionPool => ({
  connect: () =>
    Promise.resolve({
      query: async (text: string, values: unknown[]) => ({ rows: await ask(text, values) }),
      release: () => undefined,
    }),
});

const SAME_HOST: readonly string[] = [FIXTURE_HOST, 'wikileaks.org', 'www.wikileaks.org'];
const RUSSIAN = 'test-host.ru';

const reachOf = (extra: Partial<Reach> = {}): Reach => ({
  now: () => new Date('2026-11-06T12:00:00Z'),
  lookup: (host) =>
    SAME_HOST.includes(host) || host === RUSSIAN
      ? Promise.resolve([{ address: '127.0.0.1', family: 4 }])
      : Promise.reject(new Error(`the test resolves no name ${host}`)),
  refuses: () => false,
  ...extra,
});

const callerOf = async (ask: Ask, role: Role, reach: Reach) => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(poolOf(ask), reach, undefined, role).connect(serverSide);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientSide);
  return async (name: string, args: Record<string, unknown>) => {
    const called = answer.parse(await client.callTool({ name, arguments: args }));
    return { refused: called.isError === true, text: called.content[0]?.text ?? '' };
  };
};

const counted = async (ask: Ask): Promise<unknown> => {
  const [row] = await ask(
    `SELECT (SELECT count(*) FROM public.documents)::int AS documents,
            (SELECT count(*) FROM public.document_text)::int AS texts`,
  );
  return row;
};

const PAGE =
  '<html><title>A test page</title><body><p>The tanker Test Star sails.</p></body></html>';

test('each closer reads a local page with the read route, and no document is stored', async () => {
  const site = await startFixture({
    '/page': { headers: { 'content-type': 'text/html; charset=utf-8' }, body: PAGE },
  });
  onTestFinished(() => site.close());
  await rolledBack('superuser', async (ask) => {
    const before = await counted(ask);
    for (const role of ['fact_closer', 'build_closer'] as const) {
      const call = await callerOf(ask, role, reachOf());
      const read = await call('read_page', {
        url: `http://${FIXTURE_HOST}:${String(site.port)}/page`,
      });
      expect(read.refused).toBe(false);
      expect(read.text).toContain('The tanker Test Star sails.');
    }
    expect(await counted(ask)).toStrictEqual(before);
  });
  expect(site.requests).toStrictEqual(['/page', '/page']);
});

test('the read route refuses a host on the deny list before a connection, also after a redirect', async () => {
  const site = await startFixture({
    '/redirect': {
      status: 302,
      headers: { location: 'http://www.wikileaks.org/page' },
    },
  });
  onTestFinished(() => site.close());
  await rolledBack('superuser', async (ask) => {
    const call = await callerOf(ask, 'fact_closer', reachOf());
    for (const url of [
      `http://wikileaks.org:${String(site.port)}/page`,
      'http://www.wikileaks.org/page',
      'http://wikileaks.org./page',
      'HTTP://WIKILEAKS.ORG/page',
      'https://web.archive.org/web/2020/https://wikileaks.org/page',
    ]) {
      const read = await call('read_page', { url });
      expect(read.refused).toBe(true);
      expect(read.text).toContain('deny list');
    }
    expect(site.requests).toStrictEqual([]);
    const hop = await call('read_page', {
      url: `http://${FIXTURE_HOST}:${String(site.port)}/redirect`,
    });
    expect(hop.refused).toBe(true);
    expect(hop.text).toContain('deny list');
  });
  expect(site.requests).toStrictEqual(['/redirect']);
});

test('the read route reads a Russian host only under the lease', async () => {
  const site = await startFixture({
    '/page': { headers: { 'content-type': 'text/html; charset=utf-8' }, body: PAGE },
    '/limit': { status: 429, headers: { 'retry-after': '60' }, body: 'too many' },
  });
  onTestFinished(() => site.close());
  const dir = await mkdtemp(join(tmpdir(), 'gab-read-page-'));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  const url = `http://${RUSSIAN}:${String(site.port)}`;
  await rolledBack('superuser', async (ask) => {
    const bare = await callerOf(ask, 'fact_closer', reachOf());
    const refused = await bare('read_page', { url: `${url}/page` });
    expect(refused.refused).toBe(true);
    expect(refused.text).toContain('no host lease');
    expect(site.requests).toStrictEqual([]);

    const taken: string[] = [];
    const lease = hostLease({
      dir,
      now: () => new Date('2026-11-06T12:00:00Z'),
      sleep: () => Promise.resolve(),
    });
    const watched: Reach['hostLease'] = {
      acquire: (host, readMs) => {
        taken.push(host);
        return lease.acquire(host, readMs);
      },
      hold: (host, kind, until) => lease.hold(host, kind, until),
    };
    const leased = await callerOf(ask, 'fact_closer', reachOf({ hostLease: watched }));
    expect((await leased('read_page', { url: `${url}/page` })).refused).toBe(false);
    expect(taken).toStrictEqual([RUSSIAN]);

    // A quota answer holds the host for each worker, so the next read opens no connection.
    expect((await leased('read_page', { url: `${url}/limit` })).refused).toBe(true);
    const held = await leased('read_page', { url: `${url}/page` });
    expect(held.refused).toBe(true);
    expect(held.text).toContain('quota');
  });
  expect(site.requests).toStrictEqual(['/page', '/limit']);
});

test.each(ROLES)(
  'the role %s does not change the document count with a refused call',
  async (role) => {
    await rolledBack('superuser', async (ask) => {
      const before = await counted(ask);
      const call = await callerOf(ask, role, reachOf());
      if (role !== 'proposer') {
        const refused = await call('propose', { items: [] });
        expect(refused.refused).toBe(true);
        expect(refused.text).toContain('holds no tool');
      }
      const fetched = await call('start_lead', { text: 'a test lead' });
      expect(fetched.refused).toBe(true);
      expect(await counted(ask)).toStrictEqual(before);
    });
  },
);
