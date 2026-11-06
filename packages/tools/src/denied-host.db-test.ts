// One fetch for each route of a tool, under the name of a denied host, against a local server. No
// test calls a denied host, and the count of requests proves that no connection opened. Each call
// runs inside a transaction that rolls back.

import { createHash } from 'node:crypto';

import { expect, onTestFinished, test } from 'vitest';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { archiveSnapshot } from './archive-snapshot.ts';
import { fetchDocument } from './fetch-document.ts';
import { FIXTURE_HOST, memoryStore, startFixture } from './fetch-fixture.ts';
import { readPage } from './read-page.ts';
import { storeSavedFile } from './store-saved-file.ts';
import { callTool, type Reach, type Session, type Tool } from './tool.ts';
import { webReach, type StubWeb } from './web-stub.ts';

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

const reach: Reach = {
  store: memoryStore(),
  now: () => new Date(),
  lookup: () => Promise.resolve([{ address: '127.0.0.1', family: 4 }]),
  refuses: () => false,
};

const site = async () => {
  const fixture = await startFixture({
    '/page': { headers: { 'content-type': 'text/plain' }, body: 'A page of a test.' },
    '/redirect': {
      status: 302,
      headers: { location: 'http://www.wikileaks.org/page' },
    },
  });
  onTestFinished(() => fixture.close());
  return fixture;
};

const refusal = async (tool: Tool, input: unknown, given: Reach = reach): Promise<string> =>
  rolledBack('superuser', async (ask) => {
    const before = await ask('SELECT count(*)::int AS n FROM public.documents');
    const outcome = await callTool(tool, sessionOf(ask), input, given);
    expect(await ask('SELECT count(*)::int AS n FROM public.documents')).toStrictEqual(before);
    return outcome.ok ? 'no refusal' : outcome.refusal;
  });

test.each([
  ['a plain read', {}],
  ['a read through the proxy', { proxy: true }],
  ['a read with a browser', { render: true }],
  ['a bulk read', { bulk: true }],
])('fetch_document refuses a denied host before a connection: %s', async (_name, route) => {
  const fixture = await site();
  const url = `http://wikileaks.org:${String(fixture.port)}/page`;
  expect(await refusal(fetchDocument, { url, ...route })).toContain('deny list');
  expect(fixture.requests).toStrictEqual([]);
});

test('fetch_document stops at a redirect to a denied host, and it stores nothing', async () => {
  const fixture = await site();
  const url = `http://${FIXTURE_HOST}:${String(fixture.port)}/redirect`;
  expect(await refusal(fetchDocument, { url })).toContain('deny list');
  expect(fixture.requests).toStrictEqual(['/redirect']);
});

test('read_page refuses a denied host before a connection, also after a redirect', async () => {
  const fixture = await site();
  expect(
    await refusal(readPage, { url: `http://wikileaks.org:${String(fixture.port)}/page` }),
  ).toContain('deny list');
  expect(fixture.requests).toStrictEqual([]);
  expect(
    await refusal(readPage, { url: `http://${FIXTURE_HOST}:${String(fixture.port)}/redirect` }),
  ).toContain('deny list');
  expect(fixture.requests).toStrictEqual(['/redirect']);
});

test('store_saved_file refuses a file with the address of a denied host', async () => {
  const content = 'A file of a test.';
  expect(
    await refusal(storeSavedFile, {
      content: Buffer.from(content).toString('base64'),
      type: 'text/plain',
      sha256: createHash('sha256').update(content).digest('hex'),
      url: 'https://offshoreleaks.icij.org/nodes/1',
    }),
  ).toContain('deny list');
});

test('archive_snapshot asks the archive nothing for a denied host', async () => {
  const web: StubWeb = {
    get: () => Promise.reject(new Error('the test made a call')),
  } as never;
  expect(
    await refusal(archiveSnapshot, { url: 'https://ddosecrets.com/wiki/one' }, webReach(web)),
  ).toContain('deny list');
});
