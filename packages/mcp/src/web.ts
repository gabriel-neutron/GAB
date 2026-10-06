// The only place where the research server opens a socket to the web. A redirect is handed back
// and never followed, because a public host that redirects to a private address turns a fetch
// against the machine. The hosts asked are constants of the tools.

import type { Web } from '@gab/tools/tool';

type Environment = Readonly<Record<string, string | undefined>>;

const USER_AGENT = 'gabriel-web/1';

const given = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
};

const overCap = (maxBytes: number): Error =>
  new Error(`the answer is larger than the cap of ${maxBytes} bytes`);

const bodyOf = async (response: Response, maxBytes: number): Promise<string> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw overCap(maxBytes);
  }
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = (await reader.read()) as { done: boolean; value: Uint8Array };
    if (part.done) break;
    const { value } = part;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw overCap(maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

/** The web of the research server, from the environment that the caller gives it. */
export const webOf = (env: Environment, fetcher: typeof fetch = fetch): Web => {
  const searxngUrl = given(env['SEARXNG_URL']);
  const braveKey = given(env['BRAVE_SEARCH_API_KEY']);
  return {
    ...(searxngUrl === undefined ? {} : { searxngUrl }),
    ...(braveKey === undefined ? {} : { braveKey }),
    get: async (url, request) => {
      const response = await fetcher(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept: 'application/json', ...request.headers },
        signal: AbortSignal.timeout(request.timeoutMs),
      });
      const body = await bodyOf(response, request.maxBytes);
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body,
      };
    },
  };
};
