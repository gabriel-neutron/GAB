import { request as send, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, expect, test } from 'vitest';

import { HTTP_PATH, serveHttp } from './http.ts';
import { createServer, type SessionPool } from './server.ts';

const pool: SessionPool = { connect: () => Promise.reject(new Error('no database')) };

let http: Server | undefined;
afterEach(() => {
  http?.closeAllConnections();
  http?.close();
});

const open = async (): Promise<string> => {
  http = await serveHttp(() => createServer(pool), 0);
  return `http://127.0.0.1:${(http.address() as AddressInfo).port}${HTTP_PATH}`;
};

test('two clients get their own session and the same tools', async () => {
  const url = await open();
  const one = new Client({ name: 'one', version: '0.0.0' });
  const two = new Client({ name: 'two', version: '0.0.0' });
  const first = new StreamableHTTPClientTransport(new URL(url));
  const second = new StreamableHTTPClientTransport(new URL(url));
  await Promise.all([one.connect(first as Transport), two.connect(second as Transport)]);
  expect(first.sessionId).toBeTruthy();
  expect(first.sessionId).not.toBe(second.sessionId);
  const names = async (client: Client) => (await client.listTools()).tools.map((t) => t.name);
  const listed = await names(one);
  expect(listed.length).toBeGreaterThan(0);
  expect(await names(two)).toEqual(listed);
  expect(one.getServerVersion()).toBeDefined();
  await Promise.all([one.close(), two.close()]);
});

const status = (url: string, headers: Record<string, string>): Promise<number> =>
  new Promise((done, fail) => {
    const { port, pathname } = new URL(url);
    const call = send(
      { host: '127.0.0.1', port, path: pathname, method: 'POST', headers },
      (response) => {
        response.resume();
        done(response.statusCode ?? 0);
      },
    );
    call.on('error', fail);
    call.end('{}');
  });

test('a Host or Origin that is not loopback is refused', async () => {
  const url = await open();
  expect(await status(url, { host: 'evil.example' })).toBe(403);
  expect(await status(url, { host: '127.0.0.1', origin: 'https://evil.example' })).toBe(403);
  expect(await status(url, { host: 'localhost:7420' })).toBe(400);
  expect(await status(url, { host: '[::1]:7420' })).toBe(400);
});

test('a request that is not an initialize starts no session', async () => {
  const url = await open();
  expect(await status(url, { host: '127.0.0.1' })).toBe(400);
  expect(await status(url, { host: '127.0.0.1', 'mcp-session-id': 'gone' })).toBe(404);
});
