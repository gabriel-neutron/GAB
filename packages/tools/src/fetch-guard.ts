// The range check runs inside the lookup that the socket uses, so the address checked is the one
// that is opened. A second resolution would let a hostile name server give a public address to
// the check and the loopback address to the request.

import type { LookupAddress } from 'node:dns';
import { lookup as resolveName } from 'node:dns/promises';
import { request as requestHttp, type IncomingMessage, type RequestOptions } from 'node:http';
import { request as requestHttps } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

export interface Resolved {
  readonly address: string;
  readonly family: number;
}

/** What made the fetch fail: an answer that is not a success (with its status), or no answer. */
export type FetchFault =
  { readonly kind: 'status'; readonly status: number } | { readonly kind: 'silent' };

/** A fetch that this module declines, with the one sentence that says why. */
export class FetchRefusal extends Error {
  /** Set when the server gave an answer that is not a success, or gave no answer. */
  readonly fault: FetchFault | undefined;

  constructor(message: string, fault?: FetchFault) {
    super(message);
    this.fault = fault;
  }
}

// External constraint: the special-purpose ranges of the IANA registries. A range that carries an
// IPv4 address inside an IPv6 one (::/96, ::ffff:0:0:0/96) is refused whole, because the address
// inside can be private. The site-local and the segment-routing ranges are never public.
const REFUSED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  REFUSED.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 96],
  ['::ffff:0:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['5f00::', 16],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const)
  REFUSED.addSubnet(network, prefix, 'ipv6');

/** True for an address of the machine, of a private network or of a reserved range. */
export const refusedAddress = (address: string): boolean => {
  const family = isIP(address);
  if (family === 0) return true;
  return REFUSED.check(address, family === 4 ? 'ipv4' : 'ipv6');
};

export interface GetOptions {
  readonly maxBytes: number;
  readonly timeoutMs: number;
  readonly maxRedirects: number;
  /** Every address of a name. The default asks the resolver of the system. */
  readonly lookup?: (host: string) => Promise<readonly Resolved[]>;
  /** The range check. The default is refusedAddress. */
  readonly refuses?: (address: string) => boolean;
}

export interface Got {
  /** The address that gave the bytes, after the redirects. */
  readonly url: string;
  /** The success status of the answer (200 to 299). */
  readonly status: number;
  readonly contentType: string | null;
  readonly bytes: Uint8Array;
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

// The bytes stored are the bytes of the origin, so no compression is asked for.
const HEADERS = {
  'user-agent': 'gabriel-fetch/1',
  accept: 'text/html, application/pdf, text/plain;q=0.9, */*;q=0.5',
  'accept-encoding': 'identity',
};

const systemLookup = async (host: string): Promise<readonly Resolved[]> =>
  resolveName(host, { all: true, verbatim: true });

const refusedSentence = (address: string): FetchRefusal =>
  new FetchRefusal(
    `the address ${address} is on the machine or on a private network, and it is refused`,
  );

const parsed = (raw: string, base?: URL): URL => {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    throw new FetchRefusal(`"${raw}" is not an address`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new FetchRefusal(
      `only an http or an https address is fetched, and this one is ${url.protocol.replace(/:$/u, '')}`,
    );
  // A client never sends the fragment, so two addresses that differ only in it give one page, and
  // the page is stored under one address.
  url.hash = '';
  return url;
};

/** The address under which a fetch stores the page of `raw`, before any redirect. It throws a
 * FetchRefusal for an address that is never fetched. */
export const pageAddress = (raw: string): string => parsed(raw.trim()).href;

// The socket asks this function for the address, and it gets only an address that passed.
const guardedLookup =
  (lookup: GetOptions['lookup'], refuses: (address: string) => boolean): LookupFunction =>
  (host, options, callback) => {
    (lookup ?? systemLookup)(host)
      .then((found) => {
        if (found.length === 0) throw new FetchRefusal(`the name ${host} resolves to no address`);
        const refused = found.find((entry) => refuses(entry.address));
        if (refused !== undefined) throw refusedSentence(refused.address);
        const wanted =
          options.family === 4 || options.family === 6
            ? found.filter((entry) => entry.family === options.family)
            : found;
        const [first] = wanted;
        if (first === undefined)
          throw new FetchRefusal(`the name ${host} has no address of the family asked for`);
        if (options.all === true)
          callback(
            null,
            wanted.map((entry): LookupAddress => ({
              address: entry.address,
              family: entry.family,
            })),
          );
        else callback(null, first.address, first.family);
      })
      .catch((fault: unknown) => {
        callback(fault instanceof Error ? fault : new Error(String(fault)), '');
      });
  };

const errorCode = (fault: unknown): string =>
  typeof fault === 'object' && fault !== null && 'code' in fault ? String(fault.code) : '';

const SILENT: FetchFault = { kind: 'silent' };

// External constraint: the codes of Node for a server that does not answer or drops the
// connection. A site that refuses some addresses often gives one of these, and no status.
const SILENT_CODES: ReadonlySet<string> = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const asRefusal = (fault: unknown, timeoutMs: number): FetchRefusal => {
  if (fault instanceof FetchRefusal) return fault;
  if (fault instanceof Error && (fault.name === 'AbortError' || fault.name === 'TimeoutError'))
    return new FetchRefusal(
      `the address gave no whole answer within ${timeoutMs / 1000} seconds`,
      SILENT,
    );
  const code = errorCode(fault);
  return new FetchRefusal(
    `the address could not be reached${code === '' ? '' : ` (${code})`}`,
    SILENT_CODES.has(code) ? SILENT : undefined,
  );
};

const opened = (url: URL, options: RequestOptions): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const send = url.protocol === 'https:' ? requestHttps : requestHttp;
    const request = send(url, options, resolve);
    request.on('error', reject);
    request.end();
  });

const overCap = (maxBytes: number): FetchRefusal =>
  new FetchRefusal(`the answer is larger than the cap of ${maxBytes} bytes, and nothing is kept`);

const bodyOf = (response: IncomingMessage, maxBytes: number): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const declared = Number(response.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      response.destroy();
      reject(overCap(maxBytes));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    response.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        response.destroy();
        reject(overCap(maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => {
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    response.on('error', reject);
  });

/** One GET, with its redirects. Each refusal is a FetchRefusal, and each comes before a write. */
export const guardedGet = async (raw: string, options: GetOptions): Promise<Got> => {
  const refuses = options.refuses ?? refusedAddress;
  const signal = AbortSignal.timeout(options.timeoutMs);
  const lookup = guardedLookup(options.lookup, refuses);
  let url = parsed(raw);
  for (let hop = 0; ; hop += 1) {
    // A literal address opens no lookup, so it is checked here.
    const host = url.hostname.replace(/^\[(.*)\]$/u, '$1');
    if (isIP(host) !== 0 && refuses(host)) throw refusedSentence(host);
    try {
      const response = await opened(url, { method: 'GET', headers: HEADERS, lookup, signal });
      const status = response.statusCode ?? 0;
      if (REDIRECTS.has(status)) {
        response.destroy();
        const location = response.headers.location;
        if (location === undefined || location === '')
          throw new FetchRefusal(`the server answered ${status} and named no new address`);
        if (hop >= options.maxRedirects)
          throw new FetchRefusal(`the address gave more than ${options.maxRedirects} redirects`);
        url = parsed(location, url);
        continue;
      }
      if (status < 200 || status > 299) {
        response.destroy();
        throw new FetchRefusal(`the server answered ${status}, and only a success is kept`, {
          kind: 'status',
          status,
        });
      }
      const bytes = await bodyOf(response, options.maxBytes);
      return {
        url: url.href,
        status,
        contentType: response.headers['content-type'] ?? null,
        bytes,
      };
    } catch (fault) {
      throw asRefusal(fault, options.timeoutMs);
    }
  }
};
