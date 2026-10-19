// A Russian state host refuses or resets a read from outside Russia. A hosted proxy with a Russian
// exit reads it. One call costs 10 credits when it succeeds and nothing when it fails, so a failed
// call is never repeated. The key stays in this module: it is in no address that leaves it, no
// message and no document.

import { FetchRefusal, guardedGet, type GetOptions, type Got } from './fetch-guard.ts';

// A premium exit is slower than a direct read.
const PROXY_TIMEOUT_MS = 60_000;

const ENDPOINT = 'https://app.scrapingbee.com/api/v1/';

/** The note that a document read through the proxy carries. */
export const PROXY_NOTICE = 'read through a Russian exit (hosted proxy)';

// External constraint: the words of the page that minfin.gov.ru gives to a foreign address, with a
// success status ("Access is temporarily restricted").
const BLOCK_PAGE = 'Доступ временно ограничен';

/** True for a host in .ru or in .рф (xn--p1ai). */
export const isRussianHost = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('.ru') || hostname.endsWith('.xn--p1ai');
  } catch {
    return false;
  }
};

/** True for the block page of a Russian host. A binary file is read as text only in its head. */
export const isBlockPage = (bytes: Uint8Array): boolean =>
  new TextDecoder('utf-8').decode(bytes.subarray(0, 8192)).includes(BLOCK_PAGE);

/** The key of the proxy, or null when the variable is unset or blank. */
export const proxyKey = (given: string | undefined): string | null => {
  const key = (given ?? process.env['SCRAPINGBEE_KEY'] ?? '').trim();
  return key === '' ? null : key;
};

/**
 * One read of `url` through the proxy. The answer has the original address. A refusal never names
 * the key, because a FetchRefusal names no address.
 */
export const readThroughProxy = async (
  url: string,
  key: string,
  options: GetOptions,
  endpoint: string = ENDPOINT,
): Promise<Got> => {
  const call = new URL(endpoint);
  call.searchParams.set('api_key', key);
  call.searchParams.set('url', url);
  call.searchParams.set('premium_proxy', 'true');
  call.searchParams.set('country_code', 'ru');
  call.searchParams.set('render_js', 'false');
  let got: Got;
  try {
    got = await guardedGet(call.href, {
      ...options,
      timeoutMs: Math.max(options.timeoutMs, PROXY_TIMEOUT_MS),
    });
  } catch (fault) {
    if (!(fault instanceof FetchRefusal)) throw fault;
    throw new FetchRefusal(`the hosted proxy gave no page: ${fault.message}`, fault.fault);
  }
  if (isBlockPage(got.bytes))
    throw new FetchRefusal('the hosted proxy also got the block page of the host');
  return { ...got, url };
};
