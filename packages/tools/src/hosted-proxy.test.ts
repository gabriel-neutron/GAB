// The read of a Russian host through the hosted proxy. A local server plays the host and the proxy.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import { FETCH_DAY, memoryStore } from './fetch-fixture.ts';
import { isBlockPage, isRussianHost } from './hosted-proxy.ts';
import { callTool, type Reach, type Session } from './tool.ts';

const noSql: Session = {
  query: () => Promise.resolve({ rows: [] }),
};

const fetchDocument = ((): (typeof CATALOGUE)[number] => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

const KEY = 'secret-key-0123456789';
const BLOCK = '<html><body><h1>Доступ временно ограничен</h1></body></html>';
const TEXT =
  '<html><head><title>ЦБ</title></head><body><p>Центральный банк Российской Федерации</p></body></html>';
const LONG = TEXT.replace('</p>', `${' Текст'.repeat(60)}</p>`);

let server: Server;
let port: number;
const seen: string[] = [];
let proxyAnswer: { status: number; body: string } = { status: 200, body: LONG };

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? '/';
    seen.push(url);
    if (url.startsWith('/proxy')) {
      response
        .writeHead(proxyAnswer.status, { 'content-type': 'text/html; charset=utf-8' })
        .end(proxyAnswer.body);
    } else if (url === '/block') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(BLOCK);
    } else {
      response.writeHead(503, { 'content-type': 'text/html' }).end('refused');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await endMetadata();
});

const reachWith = (store: ReturnType<typeof memoryStore>, key: string | undefined): Reach => ({
  store,
  now: () => FETCH_DAY,
  lookup: () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
  refuses: () => false,
  ...(key === undefined ? {} : { hostedProxyKey: key }),
  hostedProxyEndpoint: `http://proxy.test:${port}/proxy`,
});

const run = (url: string, reach: Reach) => callTool(fetchDocument, noSql, { url }, reach);

describe('the host rule', () => {
  test.each([
    ['https://www.cbr.ru/', true],
    ['https://xn--80aa.xn--p1ai/x', true],
    ['https://example.com/a.ru', false],
    ['https://notru.com/', false],
  ])('%s', (url, expected) => {
    expect(isRussianHost(url)).toBe(expected);
  });

  test('the block page is detected', () => {
    expect(isBlockPage(new TextEncoder().encode(BLOCK))).toBe(true);
    expect(isBlockPage(new TextEncoder().encode(TEXT))).toBe(false);
  });
});

describe('a Russian host that refuses the direct read', () => {
  test('an unset key keeps the direct refusal and calls no proxy', async () => {
    const saved = process.env['SCRAPINGBEE_KEY'];
    delete process.env['SCRAPINGBEE_KEY'];
    seen.length = 0;
    try {
      const outcome = await run(
        `http://www.cbr.ru:${port}/gone`,
        reachWith(memoryStore(), undefined),
      );
      expect(outcome.ok).toBe(false);
      expect(seen.some((path) => path.startsWith('/proxy'))).toBe(false);
    } finally {
      if (saved !== undefined) process.env['SCRAPINGBEE_KEY'] = saved;
    }
  });

  test('a host outside .ru calls no proxy', async () => {
    seen.length = 0;
    const outcome = await run(`http://www.example.com:${port}/gone`, reachWith(memoryStore(), KEY));
    expect(outcome.ok).toBe(false);
    expect(seen.some((path) => path.startsWith('/proxy'))).toBe(false);
  });

  test('a 5xx of the proxy is a refusal, with one call and no key', async () => {
    proxyAnswer = { status: 500, body: 'failed' };
    seen.length = 0;
    const store = memoryStore();
    const outcome = await run(`http://www.cbr.ru:${port}/gone`, reachWith(store, KEY));
    if (outcome.ok) throw new Error('the tool had to refuse');
    expect(outcome.refusal).toContain('hosted proxy');
    expect(outcome.refusal).not.toContain(KEY);
    expect(seen.filter((path) => path.startsWith('/proxy'))).toHaveLength(1);
    expect(store.puts).toStrictEqual([]);
  });

  test('a block page from the proxy is a refusal, and nothing is stored', async () => {
    proxyAnswer = { status: 200, body: BLOCK };
    const store = memoryStore();
    const outcome = await run(`http://www.cbr.ru:${port}/gone`, reachWith(store, KEY));
    if (outcome.ok) throw new Error('the tool had to refuse');
    expect(outcome.refusal).toContain('block page');
    expect(store.puts).toStrictEqual([]);
  });
});
