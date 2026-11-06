// A Russian state host can refuse a read from outside Russia. The hosted proxy of Bright Data, by the
// decision of the operator, reads it. Each call passes the ledger of the ceiling first, and a failed
// call costs nothing. The key stays in this module: it is in a header, and in no address, message or
// document. The call asks for nothing on a CAPTCHA, and an answer with a CAPTCHA is a refusal.

import { classOfAnswer } from './answer-class.ts';
import { FetchRefusal, type GetOptions, type Got } from './fetch-guard.ts';
import { ProxyCeiling, type ProxyLedger } from './proxy-ledger.ts';

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

// The call of the proxy. Only an answer with a success can cost money.
const callProxy = async (
  url: string,
  key: string,
  options: GetOptions,
  endpoint: string,
): Promise<Response> => {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'manual',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ zone: zone(), url, format: 'raw', country: 'ru' }),
      signal: AbortSignal.timeout(Math.max(options.timeoutMs, PROXY_TIMEOUT_MS)),
    });
  } catch {
    throw refused('no whole answer came');
  }
  if (response.status < 200 || response.status > 299) {
    await response.body?.cancel();
    throw refused(`the proxy answered ${String(response.status)}`);
  }
  return response;
};

// The read stops at the cap, so a large answer does not fill the memory.
const bodyOf = async (response: Response, maxBytes: number): Promise<Uint8Array> => {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw refused('the page is larger than the cap');
  }
  const parts: Uint8Array[] = [];
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const part = (await reader.read()) as { done: boolean; value: Uint8Array };
      if (part.done) break;
      size += part.value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw refused('the page is larger than the cap');
      }
      parts.push(part.value);
    }
  } catch (fault) {
    if (fault instanceof FetchRefusal) throw fault;
    throw refused('no whole answer came');
  }
  return Buffer.concat(parts);
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
  let charged = false;
  try {
    const response = await callProxy(url, key, options, endpoint);
    charged = true;
    const bytes = await bodyOf(response, options.maxBytes);
    if (isBlockPage(bytes))
      throw new FetchRefusal('the hosted proxy also got the block page of the host');
    const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 8192));
    if (classOfAnswer({ status: 200, body: head, headers: {} }, 0).kind === 'captcha')
      throw refused('the page asks for a CAPTCHA, and nothing solves it');
    return {
      url,
      status: response.status,
      contentType: response.headers.get('content-type'),
      // fetch gives the decoded body, so the bytes have no encoding left.
      contentEncoding: null,
      lastModified: response.headers.get('last-modified'),
      certFingerprint: null,
      bytes,
    };
  } finally {
    await ledger.settle(charged);
  }
};
