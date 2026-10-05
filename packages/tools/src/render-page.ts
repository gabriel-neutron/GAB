// The browser opens no socket itself: its resolver finds no name, and each request of the page
// goes through the guarded GET of the fetch tool, so the range check holds for every address that
// the page asks for. A page that builds its text with a script then gives that text.

import { chromium, type Browser, type Route } from 'playwright';

import { FetchRefusal, guardedGet, refusedAddress, type GetOptions } from './fetch-guard.ts';

export interface RenderOptions extends GetOptions {
  /** The time of the whole render: launch, load, the requests of the page and the read. */
  readonly budgetMs: number;
}

export interface RenderedPage {
  readonly html: string;
  /** Each request of the page that the range check refused. */
  readonly refused: number;
  /** True when the page asked more files than the cap, and the rest were stopped. */
  readonly capped: boolean;
  /** True when the budget ended before the page was quiet, and the HTML is what it had then. */
  readonly timedOut: boolean;
}

// The text of a page needs its scripts and its data, and a search result page asks a few dozen
// files. A page that asks more is a page that this tool reads only in part.
export const MAX_SUBRESOURCES = 100;

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
  let asked = 0;
  let capped = false;
  let mainServed = false;

  const subresource = async (route: Route): Promise<void> => {
    const request = route.request();
    if (request.method() !== 'GET' || SKIPPED.has(request.resourceType())) {
      await settled(() => route.abort());
      return;
    }
    if (asked >= MAX_SUBRESOURCES) {
      capped = true;
      await settled(() => route.abort());
      return;
    }
    asked += 1;
    const timeoutMs = remaining();
    if (timeoutMs === 0) {
      await settled(() => route.abort());
      return;
    }
    let got;
    try {
      got = await guardedGet(request.url(), { ...opts, timeoutMs, refuses });
    } catch (fault) {
      if (!(fault instanceof FetchRefusal)) throw fault;
      await settled(() => route.abort());
      return;
    }
    const answer = got;
    await settled(() =>
      route.fulfill({
        status: 200,
        headers: answer.contentType === null ? {} : { 'content-type': answer.contentType },
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
    return { html, refused, capped, timedOut };
  } finally {
    await browser?.close().catch(() => undefined);
  }
};
