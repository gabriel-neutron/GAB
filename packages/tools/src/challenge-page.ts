// A bot filter (Qrator, Cloudflare, DataDome) refuses the plain GET and asks for a browser that runs
// its script. This module opens the page in the Chrome of the machine, through Patchright, which
// hides the signs of automation. A headless Chrome fails these filters, so the window is a real
// one, put off the screen. Nothing on the page is clicked, filled or solved: a CAPTCHA stays.
// The profile is kept between reads, so a filter that a read passed gives its cookie to the next.

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium, type BrowserContext } from 'patchright';

import { checkHost, FetchRefusal, type GetOptions } from './fetch-guard.ts';
import { unreadablePage } from './unreadable-page.ts';

/** The page that the browser shows when the filter let it through. */
export interface PassedPage {
  /** The address of the page, after the redirects. */
  readonly url: string;
  readonly html: string;
}

/** Opens one page in a browser. It gives null when the filter did not let the browser through. */
export type ChallengeReader = (
  url: string,
  options: Pick<GetOptions, 'lookup' | 'refuses'>,
) => Promise<PassedPage | null>;

// External constraint: the time that the common filters take to check a browser and reload the page.
const BUDGET_MS = 30_000;
const POLL_MS = 1_000;

// Chrome keeps a lock on its profile, so one read runs at a time.
let queue: Promise<unknown> = Promise.resolve();

const PROFILE = join(tmpdir(), 'gab-challenge-profile');

// A challenge page holds no text (Qrator) or the words of a challenge (Cloudflare, DataDome).
const passed = (text: string): boolean =>
  text.trim() !== '' && unreadablePage('text/html', [text]) === null;

const read = async (
  url: string,
  options: Pick<GetOptions, 'lookup' | 'refuses'>,
): Promise<PassedPage | null> => {
  await checkHost(new URL(url).hostname, options);
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(PROFILE, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      args: ['--window-position=-32000,-32000'],
    });
    // Each request of the page goes to a host that the range check passed.
    // shortcut: Chrome resolves the name again after the check, so a name server that changes its
    // answer between the two can reach a private address; upgrade to a local proxy that opens the
    // checked address if the tool reads pages of hosts that are not trusted.
    const checked = new Map<string, Promise<boolean>>();
    await context.route('**/*', async (route) => {
      const target = new URL(route.request().url());
      let ok = checked.get(target.hostname);
      if (ok === undefined) {
        ok = checkHost(target.hostname, options).then(
          () => true,
          () => false,
        );
        checked.set(target.hostname, ok);
      }
      await ((await ok) ? route.continue() : route.abort());
    });
    await context.routeWebSocket(/.*/u, (socket) => socket.close());
    const page = context.pages()[0] ?? (await context.newPage());
    const deadline = Date.now() + BUDGET_MS;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: BUDGET_MS }).catch(() => null);
    while (Date.now() < deadline) {
      const text = await page.innerText('body').catch(() => '');
      if (passed(text)) return { url: page.url(), html: await page.content() };
      await page.waitForTimeout(POLL_MS);
    }
    return null;
  } catch (fault) {
    if (fault instanceof FetchRefusal) throw fault;
    return null;
  } finally {
    await context?.close().catch(() => undefined);
  }
};

/** Opens the page in the Chrome of the machine and waits until the filter lets it through. */
export const readThroughFilter: ChallengeReader = (url, options) => {
  const turn = queue.then(() => read(url, options));
  queue = turn.catch(() => undefined);
  return turn;
};
