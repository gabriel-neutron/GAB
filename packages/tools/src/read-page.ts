// The read route of a closer: it reads a live page and stores nothing, so a closer can test a fact on
// the web and the record does not change. It has no browser and no proxy, so it clicks, solves and
// pays for nothing. The node audit (tools/node-audit.ts) uses readLive for the same read.

import { extractText, RefusedImageError, RefusedTextError, UnsupportedTypeError } from '@gab/text';
import { z } from 'zod';

import { classOfAnswer } from './answer-class.ts';
import { decodedBody, declaredMime } from './compressed-body.ts';
import { deniedHostRefusal } from './denied-host.ts';
import { MAX_CHARACTERS } from './document-text.ts';
import { captchaHoldOf, MAX_BYTES, refusalOfFetch } from './fetch-document.ts';
import { FetchRefusal, guardedGet, holdsSecret, type GetOptions, type Got } from './fetch-guard.ts';
import { HostHeld, russianHostOf } from './host-lease.ts';
import { defineTool, ToolRefusal, type Reach } from './tool.ts';

// The same limits as a plain read of fetch_document.
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

// External constraint: the statuses that a bot filter or a rate limit gives.
const BLOCK_STATUSES: ReadonlySet<number> = new Set([401, 403, 429]);

/** The cause of a failed live read: a host rule or a filter, no answer, or no text. */
export type LiveFault = 'blocked' | 'unreachable' | 'not_text';

/** A live read that failed, with its cause. */
export class LiveRefusal extends ToolRefusal {
  readonly fault: LiveFault;
  constructor(message: string, fault: LiveFault) {
    super(message);
    this.fault = fault;
  }
}

/** One live read of an address, with the deny list, the host lease and the CAPTCHA hold of the
 * fetch tools. It stores nothing. Each failure is a LiveRefusal. */
export const readLive = async (
  url: string,
  reach: Reach,
): Promise<{ got: Got; mime: string; pages: readonly string[] }> => {
  const denied = deniedHostRefusal(url);
  if (denied !== null) throw new LiveRefusal(denied, 'blocked');
  if (URL.canParse(url) && holdsSecret(url))
    throw new LiveRefusal('the address holds a user name, a password or a key', 'blocked');

  const lease = reach.hostLease;
  const turns = new Map<string, () => Promise<void>>();
  const takeTurn = async (host: string): Promise<void> => {
    if (turns.has(host)) return;
    if (lease === undefined)
      throw new FetchRefusal('this surface gives no host lease, so it reads no Russian host', {
        kind: 'guard',
      });
    try {
      turns.set(host, await lease.acquire(host));
    } catch (fault) {
      if (fault instanceof HostHeld)
        throw new FetchRefusal(`${fault.message}, so try again then`, { kind: 'guard' });
      throw fault;
    }
  };
  const options: GetOptions = {
    maxBytes: MAX_BYTES,
    timeoutMs: reach.fetchTimeoutMs ?? TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    ...(reach.lookup === undefined ? {} : { lookup: reach.lookup }),
    ...(reach.refuses === undefined ? {} : { refuses: reach.refuses }),
    ...(reach.extraRoot === undefined ? {} : { extraRoot: reach.extraRoot }),
  };
  let lastHost = russianHostOf(url);
  let got: Got;
  try {
    if (lastHost !== null) await takeTurn(lastHost);
    got = await guardedGet(url, {
      ...options,
      beforeHop: async (next) => {
        lastHost = russianHostOf(next);
        if (lastHost !== null) await takeTurn(lastHost);
      },
    });
    const held = captchaHoldOf(got, reach.now().getTime());
    if (held !== null) {
      await lease?.hold(held.host, 'captcha', held.until);
      throw new LiveRefusal(
        `the page of ${held.host} asks for a CAPTCHA, and nothing solves it`,
        'blocked',
      );
    }
  } catch (fault) {
    if (!(fault instanceof FetchRefusal)) throw fault;
    let blocked = fault.fault?.kind === 'guard';
    // A limit or a CAPTCHA of the host holds for each worker, on this route too.
    if (fault.fault?.kind === 'status') {
      const { status, head, retryAfter } = fault.fault;
      const now = reach.now().getTime();
      const found = classOfAnswer(
        {
          status,
          body: head ?? '',
          headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter },
        },
        now,
      );
      const limited = found.kind === 'quota' || found.kind === 'captcha';
      if (lastHost !== null && limited)
        await lease?.hold(lastHost, found.kind, found.retryAt ?? now);
      blocked = limited || BLOCK_STATUSES.has(status);
    }
    throw new LiveRefusal(
      refusalOfFetch(fault.message, fault.fault),
      blocked ? 'blocked' : 'unreachable',
    );
  } finally {
    for (const endTurn of turns.values()) await endTurn();
  }

  const bytes = decodedBody(got.bytes, got.contentEncoding, got.contentType, MAX_BYTES);
  const mime = declaredMime(got.contentType);
  try {
    const { pages } = await extractText(bytes, got.contentType ?? mime);
    return { got, mime, pages };
  } catch (fault) {
    if (
      fault instanceof UnsupportedTypeError ||
      fault instanceof RefusedImageError ||
      fault instanceof RefusedTextError
    )
      throw new LiveRefusal(fault.message, 'not_text');
    throw new LiveRefusal(`no text is read from the answer of type ${mime}`, 'not_text');
  }
};

export const readPage = defineTool({
  name: 'read_page',
  description:
    'Reads one live web page or file at one http or https address, and gives its text. It stores ' +
    'nothing, so nothing it gives can be cited: a fact cites a stored document. It refuses a host ' +
    'on the deny list before any connection, also after a redirect. A Russian host takes one ' +
    'worker at a time at its pace, so a call can wait. When "next" is present, give it as ' +
    'fromCharacter to read on.',
  input: z.strictObject({
    url: z.string().trim().min(1).max(2048),
    fromCharacter: z.number().int().min(0).default(0),
  }),
  output: z.strictObject({
    url: z.string(),
    status: z.number().int(),
    mime: z.string(),
    text: z.string(),
    next: z.number().int().nullable(),
    notice: z.string().nullable(),
  }),
  async run(_session, input, reach) {
    if (reach === undefined) throw new ToolRefusal('this surface gives no read of the web');
    // A LiveRefusal is a ToolRefusal, so the agent gets its sentence.
    const { got, mime, pages } = await readLive(input.url, reach);
    const text = pages.join('\n\n');
    const end = input.fromCharacter + MAX_CHARACTERS;
    return {
      url: got.url,
      status: got.status,
      mime,
      text: text.slice(input.fromCharacter, end),
      next: end < text.length ? end : null,
      notice:
        got.certFingerprint === null
          ? null
          : 'a state authority can intercept this read: the Russian root signed the certificate',
    };
  },
});
