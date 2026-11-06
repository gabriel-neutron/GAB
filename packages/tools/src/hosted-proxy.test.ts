// The read of a Russian host through the hosted proxy. A local server plays the host and the proxy.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import { FETCH_DAY, memoryStore } from './fetch-fixture.ts';
import { hostLease, isRussianHost } from './host-lease.ts';
import { isBlockPage } from './hosted-proxy.ts';
import { proxyLedger } from './proxy-ledger.ts';
import type { StateClock } from './state-file.ts';
import { callTool, type Reach, type Session } from './tool.ts';
import { fetchDatabase } from './web-stub.ts';

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
const bodies: string[] = [];
let authorizations: (string | undefined)[] = [];
let stateDir = '';
let clock: StateClock;
let proxyAnswer: { status: number; body: string } = { status: 200, body: LONG };

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? '/';
    seen.push(url);
    if (url.startsWith('/proxy')) {
      authorizations.push(request.headers.authorization);
      let body = '';
      request.on('data', (part: Buffer) => (body += part.toString()));
      request.on('end', () => {
        bodies.push(body);
        response
          .writeHead(proxyAnswer.status, { 'content-type': 'text/html; charset=utf-8' })
          .end(proxyAnswer.body);
      });
    } else if (url === '/limit') {
      response.writeHead(429).end('slow');
    } else if (url === '/loop') {
      response.writeHead(302, { location: '/loop' }).end();
    } else if (url === '/block') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(BLOCK);
    } else {
      response.writeHead(503, { 'content-type': 'text/html' }).end('refused');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
  stateDir = mkdtempSync(join(tmpdir(), 'gab-proxy-'));
  clock = {
    dir: stateDir,
    now: () => FETCH_DAY,
    sleep: () => Promise.resolve(),
  };
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await endMetadata();
  rmSync(stateDir, { recursive: true, force: true });
});

const reachWith = (store: ReturnType<typeof memoryStore>, key: string | undefined): Reach => ({
  store,
  now: () => FETCH_DAY,
  lookup: () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
  refuses: () => false,
  sleep: () => Promise.resolve(),
  hostLease: hostLease(clock),
  proxyLedger: proxyLedger(clock, 0),
  ...(key === undefined ? {} : { hostedProxyKey: key }),
  hostedProxyEndpoint: `http://127.0.0.1:${port}/proxy`,
});

// A reach of a surface that gives no such guard.
const without = (reach: Reach, name: 'hostLease' | 'proxyLedger'): Reach =>
  Object.fromEntries(Object.entries(reach).filter(([key]) => key !== name)) as unknown as Reach;

const run = (url: string, reach: Reach) =>
  callTool(fetchDocument, noSql, { url, proxy: true }, reach);

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
    const saved = process.env['BRIGHTDATA_API_KEY'];
    delete process.env['BRIGHTDATA_API_KEY'];
    seen.length = 0;
    try {
      const outcome = await run(
        `http://www.cbr.ru:${port}/gone`,
        reachWith(memoryStore(), undefined),
      );
      expect(outcome.ok).toBe(false);
      expect(seen.some((path) => path.startsWith('/proxy'))).toBe(false);
    } finally {
      if (saved !== undefined) process.env['BRIGHTDATA_API_KEY'] = saved;
    }
  });

  test('a key with no "proxy" in the request calls no proxy', async () => {
    seen.length = 0;
    const outcome = await callTool(
      fetchDocument,
      noSql,
      { url: `http://www.cbr.ru:${port}/gone` },
      reachWith(memoryStore(), KEY),
    );
    expect(outcome.ok).toBe(false);
    expect(seen.some((path) => path.startsWith('/proxy'))).toBe(false);
  });

  test('a host outside .ru calls no proxy', async () => {
    seen.length = 0;
    const outcome = await run(`http://www.example.com:${port}/gone`, reachWith(memoryStore(), KEY));
    expect(outcome.ok).toBe(false);
    expect(seen.some((path) => path.startsWith('/proxy'))).toBe(false);
  });

  test('a refusal of the guard itself calls no proxy, because the proxy meets the same rule', async () => {
    seen.length = 0;
    const outcome = await run(`http://www.cbr.ru:${port}/loop`, reachWith(memoryStore(), KEY));
    if (outcome.ok) throw new Error('the tool had to refuse');
    expect(outcome.refusal).toContain('redirects');
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

  test('a block page that the proxy answered with a success stays in the ledger', async () => {
    proxyAnswer = { status: 200, body: BLOCK };
    const spent = mkdtempSync(join(tmpdir(), 'gab-spent-'));
    try {
      await run(`http://www.cbr.ru:${port}/gone`, {
        ...reachWith(memoryStore(), KEY),
        proxyLedger: proxyLedger({ ...clock, dir: spent }, 1),
      });
      expect(readFileSync(join(spent, 'proxy-log.md'), 'utf8')).toContain('1 pages, 1.0000 USD');
    } finally {
      rmSync(spent, { recursive: true, force: true });
    }
  });

  test('a 429 of the host holds the host, and no browser and no proxy goes to it', async () => {
    seen.length = 0;
    let browser = 0;
    const outcome = await run(`http://www.fns.ru:${port}/limit`, {
      ...reachWith(memoryStore(), KEY),
      readThroughFilter: () => {
        browser += 1;
        return Promise.resolve('no');
      },
    });
    expect(outcome.ok).toBe(false);
    expect(browser).toBe(0);
    expect(seen).toStrictEqual(['/limit']);
    const next = await run(`http://www.fns.ru:${port}/limit`, reachWith(memoryStore(), KEY));
    if (next.ok) throw new Error('the tool had to refuse');
    expect(next.refusal).toContain('quota hold');
    expect(seen).toStrictEqual(['/limit']);
  });

  test('a CAPTCHA from the proxy is a refusal, and nothing is stored', async () => {
    proxyAnswer = { status: 200, body: '<html>captcha</html>' };
    const store = memoryStore();
    const outcome = await run(`http://www.cbr.ru:${port}/gone`, reachWith(store, KEY));
    if (outcome.ok) throw new Error('the tool had to refuse');
    expect(outcome.refusal).toContain('CAPTCHA');
    expect(store.puts).toStrictEqual([]);
  });

  test('the key leaves in a header, and the proxy gets the zone and the address', async () => {
    proxyAnswer = { status: 500, body: 'failed' };
    authorizations = [];
    bodies.length = 0;
    seen.length = 0;
    await run(`http://www.cbr.ru:${port}/gone`, reachWith(memoryStore(), KEY));
    expect(authorizations).toStrictEqual([`Bearer ${KEY}`]);
    expect(seen.filter((path) => path.includes(KEY))).toStrictEqual([]);
    expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({
      url: `http://www.cbr.ru:${port}/gone`,
      format: 'raw',
      country: 'ru',
    });
  });

  test('with no ceiling on the surface no call goes to the proxy', async () => {
    seen.length = 0;
    const reach = without(reachWith(memoryStore(), KEY), 'proxyLedger');
    const outcome = await run(`http://www.cbr.ru:${port}/gone`, reach);
    expect(outcome.ok).toBe(false);
    expect(seen.some((path) => path.startsWith('/proxy'))).toBe(false);
  });

  test('with no lease on the surface no call goes to a Russian host', async () => {
    seen.length = 0;
    const reach = without(reachWith(memoryStore(), KEY), 'hostLease');
    const outcome = await run(`http://www.cbr.ru:${port}/gone`, reach);
    expect(outcome.ok).toBe(false);
    expect(seen).toStrictEqual([]);
  });

  test('a hold of the host stops the read before any connection', async () => {
    seen.length = 0;
    const lease = hostLease(clock);
    await lease.hold('www.gks.ru', 'quota', FETCH_DAY.getTime() + 1000);
    const outcome = await run(`http://www.gks.ru:${port}/gone`, reachWith(memoryStore(), KEY));
    if (outcome.ok) throw new Error('the tool had to refuse');
    expect(outcome.refusal).toContain('quota hold');
    expect(seen).toStrictEqual([]);
  });

  test('with no room under the ceiling the proxy gets no call, and the read is blocked', async () => {
    seen.length = 0;
    const full = mkdtempSync(join(tmpdir(), 'gab-ceiling-'));
    try {
      const outcome = await run(`http://www.cbr.ru:${port}/gone`, {
        ...reachWith(memoryStore(), KEY),
        proxyLedger: proxyLedger({ ...clock, dir: full }, 26),
      });
      if (outcome.ok) throw new Error('the tool had to refuse');
      expect(outcome.refusal).toContain('ceiling');
      expect(seen.some((path) => path.startsWith('/proxy'))).toBe(false);
      expect(readFileSync(join(full, 'blocked.md'), 'utf8')).toContain('www.cbr.ru');
    } finally {
      rmSync(full, { recursive: true, force: true });
    }
  });

  test('with room one batch runs, the log holds count and cost, and it stops at the ceiling', async () => {
    proxyAnswer = { status: 200, body: LONG };
    seen.length = 0;
    const batch = mkdtempSync(join(tmpdir(), 'gab-batch-'));
    try {
      const reach = {
        ...reachWith(memoryStore(), KEY),
        proxyLedger: proxyLedger({ ...clock, dir: batch }, 10),
      };
      const outcomes = [];
      for (const page of ['a', 'b', 'c'])
        outcomes.push(
          await callTool(
            fetchDocument,
            fetchDatabase(),
            { url: `http://www.cbr.ru:${port}/gone/${page}`, proxy: true },
            reach,
          ),
        );
      expect(outcomes.map((one) => one.ok)).toStrictEqual([true, true, false]);
      expect(seen.filter((path) => path.startsWith('/proxy'))).toHaveLength(2);
      const log = readFileSync(join(batch, 'proxy-log.md'), 'utf8');
      expect(log).toContain('2 pages, 20.0000 USD of 25');
      expect(log).not.toContain(KEY);
      expect(log).not.toContain('www.cbr.ru');
    } finally {
      rmSync(batch, { recursive: true, force: true });
    }
  });
});
