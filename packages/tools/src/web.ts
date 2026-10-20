// The only place where a surface opens a socket to the web for a tool. A redirect is handed back
// and never followed, because a public host that redirects to a private address turns a fetch
// against the machine. The hosts asked are constants of the tools.

import type { Web } from './tool.ts';

type Environment = Readonly<Record<string, string | undefined>>;

const USER_AGENT = 'gabriel-web/1';

const given = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
};

const overCap = (maxBytes: number): Error =>
  new Error(`the answer is larger than the cap of ${maxBytes} bytes`);

const bytesOf = async (response: Response, maxBytes: number): Promise<Buffer> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw overCap(maxBytes);
  }
  if (response.body === null) return Buffer.alloc(0);
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
  return Buffer.concat(chunks);
};

const bodyOf = async (response: Response, maxBytes: number): Promise<string> =>
  (await bytesOf(response, maxBytes)).toString('utf8');

/** The web of a surface, from the environment that the caller gives it. */
export const webOf = (env: Environment, fetcher: typeof fetch = fetch): Web => {
  const searxngUrl = given(env['SEARXNG_URL']);
  const braveKey = given(env['BRAVE_SEARCH_API_KEY']);
  const companiesHouseKey = given(env['COMPANIES_HOUSE_API_KEY']);
  const openSanctionsKey = given(env['OPENSANCTIONS_API_KEY']);
  const gfwToken = given(env['GFW_API_TOKEN']);
  const firmsKey = given(env['FIRMS_MAP_KEY']);
  const comtradeKey = given(env['COMTRADE_API_KEY']);
  const cdseClientId = given(env['CDSE_CLIENT_ID']);
  const cdseClientSecret = given(env['CDSE_CLIENT_SECRET']);
  return {
    ...(searxngUrl === undefined ? {} : { searxngUrl }),
    ...(braveKey === undefined ? {} : { braveKey }),
    ...(companiesHouseKey === undefined ? {} : { companiesHouseKey }),
    ...(openSanctionsKey === undefined ? {} : { openSanctionsKey }),
    ...(gfwToken === undefined ? {} : { gfwToken }),
    ...(firmsKey === undefined ? {} : { firmsKey }),
    ...(comtradeKey === undefined ? {} : { comtradeKey }),
    ...(cdseClientId === undefined ? {} : { cdseClientId }),
    ...(cdseClientSecret === undefined ? {} : { cdseClientSecret }),
    post: async (url, request) => {
      const response = await fetcher(url, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, ...request.headers },
        body: request.body,
        signal: AbortSignal.timeout(request.timeoutMs),
      });
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        bytes: await bytesOf(response, request.maxBytes),
      };
    },
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
