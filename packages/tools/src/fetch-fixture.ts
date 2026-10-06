// A local HTTP server for the tests of the fetch tool. It listens on the loopback address alone and
// counts each request, so a test can prove that a refusal came before any request.

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { RawObject } from '@gab/store';

import { refusedAddress, type Resolved } from './fetch-guard.ts';
import type { Reach } from './tool.ts';

interface Route {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string;
  /** The body goes out in chunks with no length, so only a count of the bytes can stop it. */
  readonly chunked?: boolean;
}

export interface Fixture {
  readonly port: number;
  readonly requests: string[];
  close(): Promise<void>;
}

/** The fixture answers each path that the map names, and a 404 for every other path. */
export const startFixture = async (routes: Readonly<Record<string, Route>>): Promise<Fixture> => {
  const requests: string[] = [];
  const server: Server = createServer((request, response) => {
    const path = request.url ?? '/';
    requests.push(path);
    const route = routes[path];
    if (route === undefined) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('absent');
      return;
    }
    const body = route.body ?? '';
    const bytes = typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body);
    if (route.chunked === true) {
      response.writeHead(route.status ?? 200, { ...route.headers });
      for (let at = 0; at < bytes.length; at += 1 << 20)
        response.write(bytes.subarray(at, at + (1 << 20)));
      response.end();
      return;
    }
    response.writeHead(route.status ?? 200, {
      'content-length': String(bytes.length),
      ...route.headers,
    });
    response.end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((fault) => {
          if (fault === undefined) resolve();
          else reject(fault);
        });
      }),
  };
};

/** The name that the test lookup resolves to the fixture. */
export const FIXTURE_HOST = 'fixture.test';

/** Resolves the fixture name to the loopback address, and refuses every other name. */
export const fixtureLookup = (host: string): Promise<readonly Resolved[]> =>
  host === FIXTURE_HOST
    ? Promise.resolve([{ address: '127.0.0.1', family: 4 }])
    : Promise.reject(new Error(`the test resolves no name ${host}`));

/** An object store in memory. It records each object and gives back its key. */
export const memoryStore = (): { put(object: RawObject): Promise<string>; puts: RawObject[] } => {
  const puts: RawObject[] = [];
  return {
    puts,
    put: (object) => {
      puts.push(object);
      return Promise.resolve(object.key);
    },
  };
};

export const FETCH_DAY = new Date('2026-10-05T10:00:00Z');

/** The reach of a test that may open the fixture, and no other address of the machine. */
export const fixtureReach = (store: NonNullable<Reach['store']>): Reach => ({
  store,
  now: () => FETCH_DAY,
  lookup: fixtureLookup,
  refuses: (address) => address !== '127.0.0.1' && refusedAddress(address),
});
