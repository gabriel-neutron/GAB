// The browser opens no socket itself: its resolver finds no name, and each request of the page
// goes through the guarded GET of the fetch tool, so the range check holds for every address that
// the page asks for. A page that builds its text with a script then gives that text.

import { chromium, type Browser, type Route } from 'playwright';

import {
  FetchRefusal,
  guardedGet,
  refusedAddress,
  type FetchMetadata,
  type GetOptions,
} from './fetch-guard.ts';

interface RenderOptions extends GetOptions {
  /** The time of the whole render: launch, load, the requests of the page and the read. */
  readonly budgetMs: number;
}

interface RenderedPage {
  readonly html: string;
  /** Each request of the page that the range check refused. */
  readonly refused: number;
  /** True when the budget ended before the page was quiet, and the HTML is what it had then. */
  readonly timedOut: boolean;
}

// A picture, a sound or a font adds no text, so it is not fetched.
const SKIPPED = new Set(['image', 'media', 'font']);

// The browser resolves no name, so a request that escapes the route can reach no host. WebRTC
// opens no UDP path that a proxy does not carry.
const ARGS = [
  '--host-resolver-rules=MAP * ~NOTFOUND',
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
];

// A route can settle after the page closed, and the browser then has no request to answer.
const settled = async (work: () => Promise<void>): Promise<void> => {
  try {
    await work();
  } catch {
    // The page is gone, and nothing waits for this answer.
  }
};

const isTimeout = (fault: unknown): boolean =>
  fault instanceof Error && fault.name === 'TimeoutError';

// A script that never yields holds the read of the page too, so the read gets a short time of its
// own after the budget.
const READ_GRACE_MS = 2_000;

const withinTime = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('the page gave no HTML within the time'));
    }, ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (fault: unknown) => {
        clearTimeout(timer);
        reject(fault instanceof Error ? fault : new Error(String(fault)));
      },
    );
  });

// External constraint: the sec-fetch-dest and sec-fetch-mode that Chrome sends for each kind of
// request (Fetch Metadata Request Headers, W3C). A filter can compare them with the kind of the
// request, so a script is not asked for as a page.
const DEST: Readonly<Record<string, string>> = {
  document: 'iframe',
  script: 'script',
  stylesheet: 'style',
  image: 'image',
  font: 'font',
  media: 'video',
  manifest: 'manifest',
};
const CORS = new Set(['xhr', 'fetch', 'eventsource', 'font', 'manifest']);

// shortcut: the site is the last two labels of the host name, so a host under a public suffix of
// two labels (co.uk) is same-site with another host of that suffix. Upgrade with a list of public
// suffixes if a filter refuses the render for this reason.
const siteOf = (host: string): string => host.split('.').slice(-2).join('.');

/** The fetch metadata of a part of the page at `page`. */
export const partMetadata = (page: string, part: string, kind: string): FetchMetadata => {
  const from = new URL(page);
  const to = new URL(part);
  return {
    dest: DEST[kind] ?? 'empty',
    mode: kind === 'document' ? 'navigate' : CORS.has(kind) ? 'cors' : 'no-cors',
    site:
      from.origin === to.origin
        ? 'same-origin'
        : siteOf(from.hostname) === siteOf(to.hostname)
          ? 'same-site'
          : 'cross-site',
  };
};

/** Loads one page in Chromium from the bytes already fetched, and returns its HTML. */
export const renderPage = async (
  url: string,
  originBytes: Uint8Array,
  originMime: string,
  opts: RenderOptions,
): Promise<RenderedPage> => {
  const deadline = Date.now() + opts.budgetMs;
  const remaining = (): number => Math.max(0, deadline - Date.now());
  // Playwright reads a timeout of 0 as no timeout, so a spent budget gives the smallest one.
  const left = (): number => Math.max(1, remaining());
  const base = opts.refuses ?? refusedAddress;
  let refused = 0;
  const refuses = (address: string): boolean => {
    const out = base(address);
    if (out) refused += 1;
    return out;
  };
  let mainServed = false;

  const subresource = async (route: Route): Promise<void> => {
    const request = route.request();
    if (request.method() !== 'GET' || SKIPPED.has(request.resourceType())) {
      await settled(() => route.abort());
      return;
    }
    const timeoutMs = remaining();
    if (timeoutMs === 0) {
      await settled(() => route.abort());
      return;
    }
    let got;
    try {
      got = await guardedGet(request.url(), {
        ...opts,
        timeoutMs,
        refuses,
        subresource: partMetadata(url, request.url(), request.resourceType()),
      });
    } catch (fault) {
      if (!(fault instanceof FetchRefusal)) throw fault;
      await settled(() => route.abort());
      return;
    }
    const answer = got;
    // The bytes go to the browser as the server sent them, so the browser decodes a compressed
    // body when the server names its encoding.
    const headers: Record<string, string> = {};
    if (answer.contentType !== null) headers['content-type'] = answer.contentType;
    if (answer.contentEncoding !== null) headers['content-encoding'] = answer.contentEncoding;
    await settled(() =>
      route.fulfill({
        status: 200,
        headers,
        body: Buffer.from(answer.bytes),
      }),
    );
  };

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true, args: ARGS, timeout: left() });
    const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    const page = await context.newPage();
    // A second window of the page is a second navigation, and only one is made.
    context.on('page', (opened) => {
      if (opened !== page) void settled(() => opened.close());
    });
    await context.routeWebSocket(/.*/u, (socket) => {
      void settled(() => socket.close());
    });
    await context.route('**/*', async (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        if (mainServed) {
          await settled(() => route.abort());
          return;
        }
        mainServed = true;
        await settled(() =>
          route.fulfill({
            status: 200,
            headers: { 'content-type': originMime },
            body: Buffer.from(originBytes),
          }),
        );
        return;
      }
      await subresource(route).catch(() => settled(() => route.abort()));
    });

    let timedOut = false;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: left() });
      await page.waitForLoadState('networkidle', { timeout: left() });
    } catch (fault) {
      if (!isTimeout(fault)) throw fault;
      timedOut = true;
    }
    const html = await withinTime(page.content(), remaining() + READ_GRACE_MS);
    return { html, refused, timedOut };
  } finally {
    await browser?.close().catch(() => undefined);
  }
};
