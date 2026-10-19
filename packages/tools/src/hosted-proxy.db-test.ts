// The read of a Russian host through the hosted proxy, against the disposable database. A local
// server plays the host and the proxy. The object store is in memory.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, expect, test } from 'vitest';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import { FETCH_DAY, memoryStore } from './fetch-fixture.ts';
import { PROXY_NOTICE } from './hosted-proxy.ts';
import { callTool, type Reach, type Session } from './tool.ts';

const KEY = 'secret-key-0123456789';
const BLOCK = '<html><body><h1>Доступ временно ограничен</h1></body></html>';
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PAGE =
  `<html><head><title>Центральный банк</title></head><body><p>Запись ${RUN}. ` +
  `${'Центральный банк Российской Федерации публикует официальные курсы. '.repeat(5)}</p></body></html>`;

const fetchDocument = ((): (typeof CATALOGUE)[number] => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

let server: Server;
let port: number;
const seen: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? '/';
    seen.push(url);
    const reply = (status: number, body: string): void => {
      response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }).end(body);
    };
    if (url.startsWith('/proxy')) reply(200, PAGE);
    else if (url === '/block') reply(200, BLOCK);
    else reply(503, 'refused');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await endMetadata();
});

const reachWith = (store: ReturnType<typeof memoryStore>): Reach => ({
  store,
  now: () => FETCH_DAY,
  lookup: () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
  refuses: () => false,
  hostedProxyKey: KEY,
  hostedProxyEndpoint: `http://proxy.test:${port}/proxy`,
});

test.each(['/gone', '/block'])(
  'a Russian host that refuses the direct read (%s) is read once through the proxy',
  async (path) => {
    const store = memoryStore();
    seen.length = 0;
    const url = `http://www.cbr.ru:${port}${path}`;
    await rolledBack('research', async (ask) => {
      const outcome = await callTool(
        fetchDocument,
        sessionOf(ask),
        { url, proxy: true },
        reachWith(store),
      );
      if (!outcome.ok) throw new Error(outcome.refusal);
      const out = outcome.output as { url: string; notice: string | null };
      // The source address is the original one, and the key is in no output and no stored byte.
      expect(out.url).toBe(url);
      expect(out.notice).toContain(PROXY_NOTICE);
      expect(JSON.stringify(out)).not.toContain(KEY);
      expect(JSON.stringify(store.puts.map((put) => put.key))).not.toContain(KEY);
      // The stored bytes are the body as it came.
      expect(store.puts.map((put) => Buffer.from(put.bytes).toString('utf8'))).toStrictEqual([
        PAGE,
      ]);
      const calls = seen.filter((seenPath) => seenPath.startsWith('/proxy'));
      expect(calls).toHaveLength(1);
      const query = new URL(`http://x${calls[0] ?? ''}`).searchParams;
      expect(query.get('url')).toBe(url);
      expect(query.get('premium_proxy')).toBe('true');
      expect(query.get('country_code')).toBe('ru');
      expect(query.get('render_js')).toBe('false');
    });
  },
);
