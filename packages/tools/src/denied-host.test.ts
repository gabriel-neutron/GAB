// No test calls a denied host: the rule reads each address, and each fetch below goes to a local
// server under the name of a denied host. The count of requests proves that no connection opened.

import { request } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, onTestFinished, test } from 'vitest';

import { guardProxy } from './challenge-page.ts';
import { DENIED_HOSTS, deniedHostRefusal } from './denied-host.ts';
import { startFixture } from './fetch-fixture.ts';
import { checkHost, FetchRefusal, guardedGet } from './fetch-guard.ts';
import { readThroughProxy } from './hosted-proxy.ts';
import { refusedSource } from './refused-source.ts';

const FORMS = (host: string): readonly string[] => [
  `https://${host}/page`,
  `http://${host}`,
  `https://www.${host}/page`,
  `https://${host}./page`,
  `https://${host}:8443/page`,
  `https://x.test@${host}/page`,
  `HTTPS://${host.toUpperCase()}/PAGE`,
  `https://web.archive.org/web/2020/https://${host}/page`,
  `https://web.archive.org/web/2020/${host}/page`,
  `https://web.archive.org/web/2020/https%3A%2F%2F${host}%2Fpage`,
  `https://web.archive.org/web/2020/https%253A%252F%252F${host}%252Fpage`,
  `https://web.archive.org/web/2020/https%3A%2F%2F${host}%2Fp%ZZ`,
  `https://web.archive.org/web/2020/https%3A%2F%2F${host}%2Fp%FF`,
  `https://example.com/read?url=${host}`,
  `https://${host}../page`,
  `https://${host}...:8443/page`,
];

test.each(DENIED_HOSTS)('the rule denies each form of an address on %s', (host) => {
  for (const address of FORMS(host)) {
    expect(deniedHostRefusal(address)).toContain('deny list');
    expect(refusedSource(address)).toContain('deny list');
  }
});

test.each([
  'https://www.icij.org/investigations/pandora-papers/',
  'https://www.occrp.org/en/investigations/one',
  'https://notwikileaks.org/page',
  'https://wikileaks.org.example.com/page',
  'https://example.com/an-article-on-wikileaks.org-and-the-law',
  'https://example.com/my-wikileaks.org.html',
])('the rule leaves an article or another host alone: %s', (address) => {
  expect(deniedHostRefusal(address)).toBeNull();
});

const options = {
  maxBytes: 1024,
  timeoutMs: 2000,
  maxRedirects: 2,
  lookup: () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
  refuses: () => false,
};

const site = async () => {
  const fixture = await startFixture({
    '/page': { body: 'a page' },
    '/redirect': { status: 302, headers: { location: 'http://wikileaks.org/page' } },
  });
  onTestFinished(() => fixture.close());
  return fixture;
};

test.each(DENIED_HOSTS)('the guarded read opens no connection to %s', async (host) => {
  const fixture = await site();
  await expect(guardedGet(`http://${host}:${String(fixture.port)}/page`, options)).rejects.toThrow(
    /deny list/u,
  );
  await expect(checkHost(host, options)).rejects.toThrow(/deny list/u);
  expect(fixture.requests).toStrictEqual([]);
});

test('a redirect to a denied host opens no connection to it', async () => {
  const fixture = await site();
  await expect(
    guardedGet(`http://local.test:${String(fixture.port)}/redirect`, options),
  ).rejects.toThrow(/deny list/u);
  expect(fixture.requests).toStrictEqual(['/redirect']);
});

test('the proxy of the Chrome window opens no connection to a denied host', async () => {
  const fixture = await site();
  const proxy = await guardProxy(options);
  onTestFinished(() => {
    proxy.closeAllConnections();
    proxy.close();
  });
  const status = await new Promise<number>((resolve, reject) => {
    const asked = request({
      host: '127.0.0.1',
      port: (proxy.address() as AddressInfo).port,
      method: 'GET',
      path: `http://wikileaks.org:${String(fixture.port)}/page`,
    });
    asked.on('response', (answer) => {
      answer.resume();
      resolve(answer.statusCode ?? 0);
    });
    asked.on('error', reject);
    asked.end();
  });
  expect(status).toBe(502);
  expect(fixture.requests).toStrictEqual([]);
});

test('the hosted proxy gets no call for a denied host', async () => {
  const fixture = await site();
  const reserved: string[] = [];
  const read = readThroughProxy(
    'https://wikileaks.org/page',
    'test-key',
    options,
    { reserve: (what: string) => Promise.resolve(void reserved.push(what)) } as never,
    `http://127.0.0.1:${String(fixture.port)}/page`,
  );
  await expect(read).rejects.toBeInstanceOf(FetchRefusal);
  expect(reserved).toStrictEqual([]);
  expect(fixture.requests).toStrictEqual([]);
});
