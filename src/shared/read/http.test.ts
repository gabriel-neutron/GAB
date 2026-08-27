// The one request to the read API, with a stubbed fetch. It reads no database and opens no
// socket: the address, the filter form, the status and the shape of the answer are all here.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { readRows } from './http';

const asked: string[] = [];

const listed = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const answers = (make: (view: string) => Response): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: URL): Promise<Response> => {
      asked.push(input.href);
      return Promise.resolve(make(input.pathname.slice(1)));
    }),
  );
};

// The whole sentence of a refusal, so a test cannot pass on a failure of another kind.
const refusalOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (cause) {
    return cause instanceof Error ? cause.message : 'a refusal that carries no sentence';
  }
  throw new Error('the read client accepted an answer that it must refuse');
};

beforeEach(() => {
  asked.length = 0;
  answers(() => listed([]));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('an address that nobody stated is the loopback service', async () => {
  vi.stubEnv('VITE_API_URL', undefined);
  await readRows('entity');
  expect(asked).toStrictEqual(['http://127.0.0.1:3000/entity']);
});

test('an address of blank characters is the loopback service', async () => {
  vi.stubEnv('VITE_API_URL', '  ');
  await readRows('entity');
  expect(asked).toStrictEqual(['http://127.0.0.1:3000/entity']);
});

test('a stated address takes one slash, whether it carries one or not', async () => {
  vi.stubEnv('VITE_API_URL', 'http://read.test:3000');
  await readRows('entity');
  vi.stubEnv('VITE_API_URL', 'http://read.test:3000/');
  await readRows('entity');
  expect(asked).toStrictEqual(['http://read.test:3000/entity', 'http://read.test:3000/entity']);
});

test('a stated address keeps the path it carries', async () => {
  vi.stubEnv('VITE_API_URL', 'http://read.test:3000/api/');
  await readRows('entity');
  expect(asked).toStrictEqual(['http://read.test:3000/api/entity']);
});

test('a filter reaches the address as an equality on the column', async () => {
  await readRows('proposal', { status: 'pending' });
  expect(asked).toStrictEqual(['http://127.0.0.1:3000/proposal?status=eq.pending']);
});

test('an address that is not an address is refused, and the answer names the key to set', async () => {
  vi.stubEnv('VITE_API_URL', '//read.test:3000');
  expect(await refusalOf(() => readRows('entity'))).toBe(
    'The read API address is not an address: //read.test:3000. Set VITE_API_URL to the read service.',
  );
  expect(asked).toStrictEqual([]);
});

test('a status that is not ok is refused, and the answer names the view and the status', async () => {
  answers((view) => listed({ message: `no ${view} here` }, 503));
  expect(await refusalOf(() => readRows('entity'))).toBe(
    'The read API refused the entity list, and answered 503.',
  );
});

test('a body that is not a list is refused, and the answer names the view', async () => {
  answers(() => listed({ id: 'one row, and not a list' }));
  expect(await refusalOf(() => readRows('relation'))).toBe(
    'The read API answered the relation list with something that is not a list.',
  );
});

test('a list of rows arrives whole, and in the order the service gave', async () => {
  answers(() => listed([{ id: 'a' }, { id: 'b' }]));
  expect(await readRows('entity')).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
});
