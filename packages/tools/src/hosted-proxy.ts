// A Russian state host can refuse a read from outside Russia. The hosted proxy of Bright Data, by the
// decision of the operator, reads it. Each call passes the ledger of the ceiling first, and a failed
// call costs nothing. The key stays in this module: it is in a header, and in no address, message or
// document. The call asks for nothing on a CAPTCHA, and an answer with a CAPTCHA is a refusal.

import { FetchRefusal, type GetOptions, type Got } from './fetch-guard.ts';
import { classOfAnswer, isRussianHost, ProxyCeiling, type ProxyLedger } from './host-lease.ts';

export { isRussianHost };

// A premium exit is slower than a direct read.
const PROXY_TIMEOUT_MS = 60_000;

const ENDPOINT = 'https://api.brightdata.com/request';
// External constraint: the name that Bright Data gives the first Web Unlocker zone of an account.
const DEFAULT_ZONE = 'web_unlocker1';

/** The note that a document read through the proxy carries. */
export const PROXY_NOTICE = 'read through a Russian exit (hosted proxy)';

// External constraint: the words of the page that minfin.gov.ru gives to a foreign address, with a
// success status ("Access is temporarily restricted").
const BLOCK_PAGE = 'Доступ временно ограничен';

/** True for the block page of a Russian host. A binary file is read as text only in its head. */
export const isBlockPage = (bytes: Uint8Array): boolean =>
  new TextDecoder('utf-8').decode(bytes.subarray(0, 8192)).includes(BLOCK_PAGE);

/** The key of the proxy, or null when the variable is unset or blank. */
export const proxyKey = (given: string | undefined): string | null => {
  const key = (given ?? process.env['BRIGHTDATA_API_KEY'] ?? '').trim();
  return key === '' ? null : key;
};

const refused = (reason: string): FetchRefusal =>
  new FetchRefusal(`the hosted proxy gave no page: ${reason}`);

const zone = (): string => {
  const given = process.env['BRIGHTDATA_ZONE']?.trim() ?? '';
  return given === '' ? DEFAULT_ZONE : given;
};

const callProxy = async (
  url: string,
  key: string,
  options: GetOptions,
  endpoint: string,
): Promise<Got> => {
  let response: Response;
  let bytes: Uint8Array;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'manual',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ zone: zone(), url, format: 'raw', country: 'ru' }),
      signal: AbortSignal.timeout(Math.max(options.timeoutMs, PROXY_TIMEOUT_MS)),
    });
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw refused('no whole answer came');
  }
  if (response.status < 200 || response.status > 299)
    throw refused(`the proxy answered ${String(response.status)}`);
  if (bytes.length > options.maxBytes) throw refused('the page is larger than the cap');
  if (isBlockPage(bytes))
    throw new FetchRefusal('the hosted proxy also got the block page of the host');
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 8192));
  if (classOfAnswer({ status: 200, body: head, headers: {} }, 0).kind === 'captcha')
    throw refused('the page asks for a CAPTCHA, and nothing solves it');
  return {
    url,
    status: response.status,
    contentType: response.headers.get('content-type'),
    contentEncoding: response.headers.get('content-encoding'),
    lastModified: response.headers.get('last-modified'),
    certFingerprint: null,
    bytes,
  };
};

/**
 * One read of `url` through the proxy, after a reservation in the ledger. The answer has the
 * original address. A refusal never names the key.
 */
export const readThroughProxy = async (
  url: string,
  key: string,
  options: GetOptions,
  ledger: ProxyLedger,
  endpoint: string = ENDPOINT,
): Promise<Got> => {
  try {
    await ledger.reserve(`read of ${new URL(url).hostname}`);
  } catch (fault) {
    if (fault instanceof ProxyCeiling) throw new FetchRefusal(fault.message);
    throw fault;
  }
  let ok = false;
  try {
    const got = await callProxy(url, key, options, endpoint);
    ok = true;
    return got;
  } finally {
    await ledger.settle(ok);
  }
};
