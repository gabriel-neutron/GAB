// The web of a surface against a fetch that is a stub. No socket opens. The test proves that a
// redirect is handed back and never followed, that the caps hold, and that an empty setting is no
// setting.

import { expect, test } from 'vitest';

import { webOf } from './web.ts';

interface Seen {
  readonly url: string;
  readonly init: RequestInit;
}

const stubFetch = (
  answer: () => Response,
): { readonly fetcher: typeof fetch; readonly seen: Seen[] } => {
  const seen: Seen[] = [];
  const fetcher = ((url: string | URL | Request, init?: RequestInit) => {
    seen.push({
      url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
      init: init ?? {},
    });
    return Promise.resolve(answer());
  }) as typeof fetch;
  return { fetcher, seen };
};

const REQUEST = { timeoutMs: 5_000, maxBytes: 1_000 };

test('an empty or absent setting gives no address and no key', () => {
  expect(webOf({}, stubFetch(() => new Response('')).fetcher)).not.toHaveProperty('searxngUrl');
  const blank = webOf(
    { SEARXNG_URL: '  ', BRAVE_SEARCH_API_KEY: '' },
    stubFetch(() => new Response('')).fetcher,
  );
  expect(blank).not.toHaveProperty('searxngUrl');
  expect(blank).not.toHaveProperty('braveKey');
  const keyless = webOf(
    { OPENSANCTIONS_API_KEY: ' ', GFW_API_TOKEN: '' },
    stubFetch(() => new Response('')).fetcher,
  );
  expect(keyless).not.toHaveProperty('openSanctionsKey');
  expect(keyless).not.toHaveProperty('gfwToken');
  const keyed = webOf(
    { OPENSANCTIONS_API_KEY: 'a', GFW_API_TOKEN: 'b' },
    stubFetch(() => new Response('')).fetcher,
  );
  expect(keyed).toMatchObject({ openSanctionsKey: 'a', gfwToken: 'b' });
});

test('the settings come from the environment that is given, and from no other', () => {
  const web = webOf(
    { SEARXNG_URL: 'http://127.0.0.1:8888', BRAVE_SEARCH_API_KEY: 'k' },
    stubFetch(() => new Response('')).fetcher,
  );
  expect(web.searxngUrl).toBe('http://127.0.0.1:8888');
  expect(web.braveKey).toBe('k');
});

test('a request never follows a redirect, and it carries a timeout and the headers given', async () => {
  const { fetcher, seen } = stubFetch(
    () => new Response('', { status: 302, headers: { Location: 'http://10.0.0.1/' } }),
  );
  const answer = await webOf({}, fetcher).get('https://web.archive.org/save/x', {
    ...REQUEST,
    headers: { 'x-subscription-token': 'k' },
  });

  expect(answer.status).toBe(302);
  expect(answer.headers['location']).toBe('http://10.0.0.1/');
  expect(seen).toHaveLength(1);
  expect(seen[0]?.init.redirect).toBe('manual');
  expect(seen[0]?.init.method).toBe('GET');
  expect(seen[0]?.init.signal).toBeInstanceOf(AbortSignal);
  expect(seen[0]?.init.headers).toMatchObject({ 'x-subscription-token': 'k' });
});

test('an answer over the cap is a fault and keeps nothing', async () => {
  const { fetcher } = stubFetch(() => new Response('a'.repeat(REQUEST.maxBytes + 1)));
  await expect(webOf({}, fetcher).get('https://example.org/', REQUEST)).rejects.toThrow(/cap/u);
});

test('an answer within the cap comes back whole', async () => {
  const { fetcher } = stubFetch(() => new Response('{"a":1}', { status: 200 }));
  const answer = await webOf({}, fetcher).get('https://example.org/', REQUEST);
  expect(answer).toMatchObject({ status: 200, body: '{"a":1}' });
});
