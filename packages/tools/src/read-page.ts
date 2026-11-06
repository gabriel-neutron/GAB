// The read route of a closer: it reads a live page and stores nothing, so a closer can test a fact on
// the web and the record does not change. It has no browser and no proxy, so it clicks, solves and
// pays for nothing.

import { extractText, RefusedImageError, RefusedTextError, UnsupportedTypeError } from '@gab/text';
import { z } from 'zod';

import { classOfAnswer } from './answer-class.ts';
import { decodedBody, declaredMime } from './compressed-body.ts';
import { deniedHostRefusal } from './denied-host.ts';
import { MAX_CHARACTERS } from './document-text.ts';
import { captchaHoldOf, MAX_BYTES, refusalOfFetch } from './fetch-document.ts';
import { FetchRefusal, guardedGet, holdsSecret, type GetOptions, type Got } from './fetch-guard.ts';
import { HostHeld, russianHostOf } from './host-lease.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// The same limits as a plain read of fetch_document.
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

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
    const denied = deniedHostRefusal(input.url);
    if (denied !== null) throw new ToolRefusal(denied);
    if (URL.canParse(input.url) && holdsSecret(input.url))
      throw new ToolRefusal('the address holds a user name, a password or a key');

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
    let lastHost = russianHostOf(input.url);
    let got: Got;
    try {
      if (lastHost !== null) await takeTurn(lastHost);
      got = await guardedGet(input.url, {
        ...options,
        beforeHop: async (next) => {
          const refused = deniedHostRefusal(next);
          if (refused !== null) throw new FetchRefusal(refused, { kind: 'guard' });
          lastHost = russianHostOf(next);
          if (lastHost !== null) await takeTurn(lastHost);
        },
      });
      const held = captchaHoldOf(got, reach.now().getTime());
      if (held !== null) {
        await lease?.hold(held.host, 'captcha', held.until);
        throw new ToolRefusal(`the page of ${held.host} asks for a CAPTCHA, and nothing solves it`);
      }
    } catch (fault) {
      if (!(fault instanceof FetchRefusal)) throw fault;
      // A limit or a CAPTCHA of the host holds for each worker, on this route too.
      if (lastHost !== null && fault.fault?.kind === 'status') {
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
        if (found.kind === 'quota' || found.kind === 'captcha')
          await lease?.hold(lastHost, found.kind, found.retryAt ?? now);
      }
      throw new ToolRefusal(refusalOfFetch(fault.message, fault.fault));
    } finally {
      for (const endTurn of turns.values()) await endTurn();
    }

    const bytes = decodedBody(got.bytes, got.contentEncoding, got.contentType, MAX_BYTES);
    const mime = declaredMime(got.contentType);
    let pages: readonly string[];
    try {
      ({ pages } = await extractText(bytes, got.contentType ?? mime));
    } catch (fault) {
      if (
        fault instanceof UnsupportedTypeError ||
        fault instanceof RefusedImageError ||
        fault instanceof RefusedTextError
      )
        throw new ToolRefusal(fault.message);
      throw new ToolRefusal(`no text is read from the answer of type ${mime}`);
    }
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
