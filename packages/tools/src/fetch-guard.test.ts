import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, expect, test } from 'vitest';

import {
  FetchRefusal,
  guardedGet,
  HEADERS,
  pageAddress,
  refusedAddress,
  requestHeaders,
} from './fetch-guard.ts';
import { partMetadata } from './render-page.ts';

describe('refusedAddress', () => {
  test.each([
    '127.0.0.1',
    '127.8.9.10',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a00:1',
    '64:ff9b::7f00:1',
  ])('refuses %s, an address of the machine or of a private network', (address) => {
    expect(refusedAddress(address)).toBe(true);
  });

  // The hostile cases of the F6 review: a range that carries an IPv4 address inside an IPv6 one,
  // or that no public host uses, must not reach the socket.
  test.each([
    ['an IPv4-compatible address of the machine', '::7f00:1'],
    ['an IPv4-compatible address of a private network', '::a00:1'],
    ['an IPv4-compatible address of the metadata service', '::a9fe:a9fe'],
    ['an IPv4-translated address of the machine', '::ffff:0:7f00:1'],
    ['an IPv4-translated address of a private network', '::ffff:0:a00:1'],
    ['a site-local address', 'fec0::1'],
    ['the last site-local block', 'feff:ffff::1'],
    ['a segment-routing address', '5f00::1'],
  ])('refuses %s', (_name, address) => {
    expect(refusedAddress(address)).toBe(true);
  });

  test.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4001::64'])(
    'admits %s, a public address',
    (address) => {
      expect(refusedAddress(address)).toBe(false);
    },
  );

  test('admits an IPv4-mapped public address and no address near the refused ranges', () => {
    expect(refusedAddress('::ffff:8.8.8.8')).toBe(false);
    expect(refusedAddress('2a01:4f8::1')).toBe(false);
  });

  test('refuses a string that is no address, because nothing can be checked in it', () => {
    expect(refusedAddress('example.org')).toBe(true);
    expect(refusedAddress('')).toBe(true);
  });
});

describe('pageAddress', () => {
  test('gives the address that a fetch stores: no fragment, a host in small letters', () => {
    expect(pageAddress(' HTTPS://Example.ORG#top ')).toBe('https://example.org/');
    expect(pageAddress('https://example.org/a/b?q=1#part')).toBe('https://example.org/a/b?q=1');
  });

  test('refuses an address that is never fetched', () => {
    expect(() => pageAddress('file:///etc/passwd')).toThrow(FetchRefusal);
    expect(() => pageAddress('not an address')).toThrow(FetchRefusal);
  });
});

describe('the headers of the outgoing request', () => {
  test('a request has the headers of a page that a person opens in Chrome, and a caller sets accept', async () => {
    const asked: IncomingHttpHeaders[] = [];
    const server = createServer((request, response) => {
      asked.push(request.headers);
      response.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const options = { maxBytes: 1024, timeoutMs: 5000, maxRedirects: 0, refuses: () => false };
    try {
      await guardedGet(`http://127.0.0.1:${String(port)}/`, options);
      await guardedGet(`http://127.0.0.1:${String(port)}/`, {
        ...options,
        ask: { accept: 'application/xhtml+xml', 'accept-language': 'eng' },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    const [plain, asking] = asked;
    expect(plain).toMatchObject(HEADERS);
    expect(plain?.['user-agent']).toMatch(/Chrome\/141\./u);
    expect(plain?.['sec-ch-ua']).toContain('v="141"');
    expect(plain).toMatchObject({
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'accept-encoding': 'identity',
    });
    // The caller sets the format and the language, and the other headers stay.
    expect(asking).toMatchObject({
      ...HEADERS,
      accept: 'application/xhtml+xml',
      'accept-language': 'eng',
    });
  });
});

describe('the headers of a part of a page', () => {
  test('a script of another site has the fetch metadata of a script, and no user activation', () => {
    const headers = requestHeaders({
      subresource: partMetadata(
        'https://www.example.org/a',
        'https://cdn.other.net/x.js',
        'script',
      ),
    });
    expect(headers).toMatchObject({
      'user-agent': HEADERS['user-agent'],
      'sec-ch-ua': HEADERS['sec-ch-ua'],
      'sec-fetch-dest': 'script',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'cross-site',
    });
    expect(headers).not.toHaveProperty('sec-fetch-user');
    expect(headers).not.toHaveProperty('upgrade-insecure-requests');
  });

  test.each([
    [
      'a call of a script on the same origin',
      'https://www.example.org/api',
      'xhr',
      'empty',
      'cors',
      'same-origin',
    ],
    [
      'an image of the same site',
      'https://img.example.org/a.png',
      'image',
      'image',
      'no-cors',
      'same-site',
    ],
    [
      'a frame of another site',
      'https://other.net/f',
      'document',
      'iframe',
      'navigate',
      'cross-site',
    ],
  ])('%s', (_name, part, kind, dest, mode, site) => {
    expect(partMetadata('https://www.example.org/a', part, kind)).toStrictEqual({
      dest,
      mode,
      site,
    });
  });
});
