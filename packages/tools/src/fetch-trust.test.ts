// The Russian root certificate for listed hosts. A throwaway authority signs the
// certificate of a local HTTPS server and plays the role of the Russian root.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { X509Certificate } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { endMetadata } from './fetch-document.ts';
import {
  FETCH_DAY,
  FIXTURE_HOST,
  fixtureLookup,
  memoryStore,
  startFixture,
  type Fixture,
} from './fetch-fixture.ts';
import { FetchRefusal, guardedGet, type GetOptions } from './fetch-guard.ts';
import {
  chainHolds,
  listedHost,
  RUSSIAN_ROOT,
  RUSSIAN_ROOT_PEM,
  rootsFor,
} from './russian-root.ts';
import { callTool, type Reach, type Tool } from './tool.ts';
import { fetchDatabase } from './web-stub.ts';

const fetchDocument = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'fetch_document');
  if (found === undefined) throw new Error('the catalogue holds no tool named fetch_document');
  return found;
})();

const PAGE =
  '<html><head><title>Report</title></head><body><p>' +
  `${'The company published its annual report. '.repeat(10)}</p></body></html>`;

let work: string;
let server: Server;
let port: number;
let authorityPem: string;
let fingerprint: string;
let plain: Fixture;
let plainPort = 0;

const openssl = (...args: string[]): void => {
  execFileSync('openssl', args, { cwd: work, stdio: 'ignore' });
};

beforeAll(async () => {
  work = mkdtempSync(join(tmpdir(), 'gab-trust-'));
  openssl(
    ...['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem'],
    ...['-days', '2', '-subj', '/CN=Test Root', '-addext', 'basicConstraints=critical,CA:TRUE'],
  );
  openssl(
    ...['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'leaf.key', '-out', 'leaf.csr'],
    ...['-subj', `/CN=${FIXTURE_HOST}`],
  );
  writeFileSync(join(work, 'ext.cnf'), `subjectAltName=DNS:${FIXTURE_HOST}\n`);
  openssl(
    ...['x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key'],
    ...['-CAcreateserial', '-out', 'leaf.pem', '-days', '2', '-extfile', 'ext.cnf'],
  );
  authorityPem = readFileSync(join(work, 'ca.pem'), 'utf8');
  const leaf = readFileSync(join(work, 'leaf.pem'), 'utf8');
  fingerprint = new X509Certificate(leaf).fingerprint256;
  plain = await startFixture({ '/end': { body: 'end' } });
  plainPort = plain.port;
  server = createServer(
    { key: readFileSync(join(work, 'leaf.key')), cert: leaf },
    (request, response) => {
      if (request.url === '/go') {
        response.writeHead(302, { location: `http://other.test:${String(plainPort)}/end` }).end();
        return;
      }
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE);
    },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  ({ port } = server.address() as AddressInfo);
}, 60_000);

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await plain.close();
  rmSync(work, { recursive: true, force: true });
  await endMetadata();
});

const options = (extraRoot: GetOptions['extraRoot']): GetOptions => ({
  maxBytes: 1_000_000,
  timeoutMs: 10_000,
  maxRedirects: 2,
  lookup: fixtureLookup,
  refuses: (address) => address !== '127.0.0.1',
  ...(extraRoot === undefined ? {} : { extraRoot }),
});

const where = (): string => `https://${FIXTURE_HOST}:${String(port)}/`;

describe('the Russian root and its list of hosts', () => {
  test('the certificate in the code is the Russian Trusted Root CA', () => {
    const certificate = new X509Certificate(RUSSIAN_ROOT_PEM);
    expect(certificate.subject).toContain('Russian Trusted Root CA');
    expect(certificate.ca).toBe(true);
  });

  test('a host matches itself and its subdomains, and no look-alike', () => {
    expect(listedHost('sovcomflot.ru', RUSSIAN_ROOT)).toBe(true);
    expect(listedHost('WWW.Sovcomflot.RU', RUSSIAN_ROOT)).toBe(true);
    expect(listedHost('notsovcomflot.ru', RUSSIAN_ROOT)).toBe(false);
    expect(listedHost('sovcomflot.ru.example.org', RUSSIAN_ROOT)).toBe(false);
    expect(listedHost('example.org', RUSSIAN_ROOT)).toBe(false);
  });

  test('only a listed host gets the extra root, and the roots of Node stay', () => {
    expect(rootsFor('example.org', RUSSIAN_ROOT)).toBeUndefined();
    const roots = rootsFor('rostec.ru', RUSSIAN_ROOT);
    expect(roots).toContain(RUSSIAN_ROOT_PEM);
    expect((roots ?? []).length).toBeGreaterThan(50);
  });
});

describe('a page of a listed host is read with the extra root', () => {
  test('a listed host gives its page and the fingerprint of its certificate', async () => {
    const got = await guardedGet(where(), options({ hosts: [FIXTURE_HOST], pem: authorityPem }));
    expect(got.status).toBe(200);
    expect(got.certFingerprint).toBe(fingerprint);
  });

  test('a host outside the list still refuses that authority', async () => {
    const outside = guardedGet(where(), options({ hosts: ['other.test'], pem: authorityPem }));
    await expect(outside).rejects.toBeInstanceOf(FetchRefusal);
    await expect(outside).rejects.toThrow(/could not be reached/u);
  });

  test('the default list refuses the authority', async () => {
    await expect(guardedGet(where(), options(undefined))).rejects.toBeInstanceOf(FetchRefusal);
  });

  test('a read of a listed host leaves no trust for a later read of an unlisted host', async () => {
    const listed = { hosts: [FIXTURE_HOST], pem: authorityPem };
    const first = await guardedGet(where(), options(listed));
    expect(first.certFingerprint).toBe(fingerprint);
    const later = guardedGet(where(), options({ hosts: ['other.test'], pem: authorityPem }));
    await expect(later).rejects.toBeInstanceOf(FetchRefusal);
    await expect(guardedGet(where(), options(undefined))).rejects.toBeInstanceOf(FetchRefusal);
  });

  test('a redirect from a listed host to an unlisted host keeps the fingerprint', async () => {
    const listed = { hosts: [FIXTURE_HOST], pem: authorityPem };
    const got = await guardedGet(`https://${FIXTURE_HOST}:${String(port)}/go`, {
      ...options(listed),
      lookup: (host) => (host === 'other.test' ? fixtureLookup(FIXTURE_HOST) : fixtureLookup(host)),
    });
    expect(got.url).toBe(`http://other.test:${String(plainPort)}/end`);
    expect(got.certFingerprint).toBe(fingerprint);
  });
});

describe('the chain of a certificate', () => {
  const root = { fingerprint256: 'AA' };
  const leaf = { fingerprint256: 'BB', issuerCertificate: root };
  test('holds the root when the root is in the chain', () => {
    expect(chainHolds(leaf, 'AA')).toBe(true);
  });
  test('does not hold a root that signed nothing in the chain', () => {
    expect(chainHolds(leaf, 'CC')).toBe(false);
  });
  test('ends on a certificate that signs itself', () => {
    const loop: { fingerprint256: string; issuerCertificate?: unknown } = { fingerprint256: 'DD' };
    loop.issuerCertificate = loop;
    expect(chainHolds(loop, 'EE')).toBe(false);
  });
});

describe('fetch_document stores the fingerprint with the document', () => {
  const reach = (extraRoot: Reach['extraRoot']): Reach => ({
    store: memoryStore(),
    now: () => FETCH_DAY,
    lookup: fixtureLookup,
    refuses: (a) => a !== '127.0.0.1',
    ...(extraRoot === undefined ? {} : { extraRoot }),
  });

  test('a listed host is stored with its fingerprint, and the notice says to cross-check', async () => {
    const session = fetchDatabase();
    const outcome = await callTool(
      fetchDocument,
      session,
      { url: where() },
      reach({ hosts: [FIXTURE_HOST], pem: authorityPem }),
    );
    if (!outcome.ok) throw new Error(outcome.refusal);
    const output = outcome.output as { document: string; certificate: string; notice: string };
    expect(output.certificate).toBe(fingerprint);
    expect(output.notice).toContain('cross-check');
    expect(session.traces).toStrictEqual([[output.document, fingerprint, false]]);
  });

  test('a host outside the list is refused, and nothing is stored', async () => {
    const session = fetchDatabase();
    const outcome = await callTool(
      fetchDocument,
      session,
      { url: where() },
      reach({ hosts: ['other.test'], pem: authorityPem }),
    );
    expect(outcome.ok).toBe(false);
    expect(session.traces).toStrictEqual([]);
  });
});
