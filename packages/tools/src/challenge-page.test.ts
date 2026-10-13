import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { guardProxy, readThroughFilter } from './challenge-page.ts';
import { checkHost } from './fetch-guard.ts';

const portOf = (server: Server): number => (server.address() as AddressInfo).port;

// One CONNECT through the proxy, and the first line of its answer.
const connectLine = async (proxy: Server, authority: string): Promise<string> => {
  const socket = connect(portOf(proxy), '127.0.0.1');
  await once(socket, 'connect');
  socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
  const [chunk] = (await once(socket, 'data')) as [Buffer];
  socket.destroy();
  return chunk.toString('utf8').split('\r\n')[0] ?? '';
};

let origin: Server;

beforeAll(async () => {
  origin = createServer((_, answer) => answer.end('origin'));
  await new Promise<void>((resolve) => origin.listen(0, '127.0.0.1', resolve));
});

afterAll(() => {
  origin.close();
});

describe('the range check of a name', () => {
  test.each(['127.0.0.1', '[::1]', '10.0.0.8'])(
    'a literal private address is refused: %s',
    async (host) => {
      await expect(checkHost(host, {})).rejects.toThrow(/refused/);
    },
  );

  test('a name that resolves to a private address is refused', async () => {
    const lookup = () => Promise.resolve([{ address: '192.168.1.1', family: 4 }]);
    await expect(checkHost('register.example', { lookup })).rejects.toThrow(/refused/);
  });

  test('a page on a private address gives a refusal before Chrome starts', async () => {
    expect(await readThroughFilter('http://127.0.0.1/', {})).toMatch(/refused/);
  });
});

describe('the proxy of the Chrome window opens only an address that passed the range check', () => {
  test('a CONNECT to an address of the machine is refused', async () => {
    const proxy = await guardProxy({});
    try {
      expect(await connectLine(proxy, `127.0.0.1:${String(portOf(origin))}`)).toMatch(/403/);
      expect(await connectLine(proxy, `[::1]:${String(portOf(origin))}`)).toMatch(/403/);
    } finally {
      proxy.close();
    }
  });

  test('a CONNECT to a name that resolves to a private address is refused', async () => {
    const lookup = () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
    const proxy = await guardProxy({ lookup });
    try {
      expect(await connectLine(proxy, `register.example:${String(portOf(origin))}`)).toMatch(/502/);
    } finally {
      proxy.close();
    }
  });

  test('a CONNECT to an address that passed opens the tunnel', async () => {
    const lookup = () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
    const proxy = await guardProxy({ lookup, refuses: () => false });
    try {
      expect(await connectLine(proxy, `register.example:${String(portOf(origin))}`)).toMatch(/200/);
    } finally {
      proxy.close();
    }
  });

  test.each(['http://127.0.0.1:1/', '/'])('a plain request is refused: %s', async (target) => {
    const proxy = await guardProxy({});
    try {
      const socket = connect(portOf(proxy), '127.0.0.1');
      await once(socket, 'connect');
      socket.write(`GET ${target} HTTP/1.1\r\nHost: x\r\n\r\n`);
      const [chunk] = (await once(socket, 'data')) as [Buffer];
      socket.destroy();
      expect(chunk.toString('utf8')).toMatch(/^HTTP\/1\.1 403/u);
    } finally {
      proxy.close();
    }
  });
});
