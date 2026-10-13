// A bot filter (Qrator, Cloudflare, DataDome) refuses the plain GET and asks for a browser that runs
// its script. This module opens the page in the Chrome of the machine, through Patchright, which
// hides the signs of automation. A headless Chrome fails these filters, so the window is a real
// one, put off the screen. Nothing on the page is clicked, filled or solved: a CAPTCHA stays.
// The profile is kept between reads, so a filter that a read passed gives its cookie to the next.
// Each connection of Chrome goes through a local proxy that opens only an address that passed the
// range check, so a redirect, a service worker or a second resolution reaches no private address.

import { createServer, request as requestHttp, type Server } from 'node:http';
import { connect, isIP, type AddressInfo } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { chromium, type BrowserContext } from 'patchright';

import { checkHost, guardedLookup, refusedAddress, type GetOptions } from './fetch-guard.ts';
import { unreadablePage } from './unreadable-page.ts';

/** The page that the browser shows when the filter let it through. */
export interface PassedPage {
  /** The address of the page, after the redirects. */
  readonly url: string;
  readonly html: string;
}

type Guard = Pick<GetOptions, 'lookup' | 'refuses'>;

/** Opens one page in a browser. It gives the page, or the sentence that says why it did not. */
export type ChallengeReader = (url: string, options: Guard) => Promise<PassedPage | string>;

// External constraint: the time that the common filters take to check a browser and reload the page.
const BUDGET_MS = 30_000;
const POLL_MS = 1_000;
// A script that never yields holds a read of the page, so the window closes a short time after
// the budget, whatever the page does.
const GRACE_MS = 5_000;

// Chrome keeps a lock on its profile, so one read runs at a time.
let queue: Promise<unknown> = Promise.resolve();

const PROFILE = join(homedir(), '.cache', 'gab-challenge-profile');

const hostAndPort = (authority: string): [string, number] => {
  const match = /^\[?([^\]]*)\]?:(\d+)$/u.exec(authority);
  return match === null ? ['', 0] : [match[1] ?? '', Number(match[2])];
};

/** A local HTTP proxy that opens only an address that passed the range check. */
export const guardProxy = async (options: Guard): Promise<Server> => {
  const refuses = options.refuses ?? refusedAddress;
  const lookup = guardedLookup(options.lookup, refuses);
  // A literal address opens no lookup, so it is checked here.
  const literalRefused = (host: string): boolean => isIP(host) !== 0 && refuses(host);

  const server = createServer((asked, answer) => {
    // A proxy request names an absolute address. Any other is refused.
    const target = URL.parse(asked.url ?? '');
    if (
      target?.protocol !== 'http:' ||
      literalRefused(target.hostname.replace(/^\[(.*)\]$/u, '$1'))
    ) {
      answer.writeHead(403).end();
      return;
    }
    const out = requestHttp(
      target,
      { method: asked.method, headers: asked.headers, lookup },
      (got) => {
        answer.writeHead(got.statusCode ?? 502, got.headers);
        got.pipe(answer);
      },
    );
    out.on('error', () => {
      if (answer.headersSent) answer.destroy();
      else answer.writeHead(502).end();
    });
    asked.pipe(out);
  });
  server.on('connect', (asked, client, head) => {
    const [host, port] = hostAndPort(asked.url ?? '');
    client.on('error', () => client.destroy());
    if (host === '' || literalRefused(host)) {
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const upstream = connect({ host, port, lookup }, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    upstream.on('error', () => client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
    client.on('close', () => upstream.destroy());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
};

// A challenge page holds no text (Qrator) or the words of a challenge (Cloudflare, DataDome), and
// it comes with a status that is not a success. A filter that passed reloads the page with a 200.
const passed = (status: number, url: string, title: string, text: string): boolean =>
  status >= 200 &&
  status <= 299 &&
  /^https?:/u.test(url) &&
  text.trim() !== '' &&
  unreadablePage('text/html', [`${title}\n${text}`]) === null;

const read = async (url: string, options: Guard): Promise<PassedPage | string> => {
  try {
    await checkHost(new URL(url).hostname, options);
  } catch (fault) {
    return fault instanceof Error ? fault.message : String(fault);
  }
  const proxy = await guardProxy(options);
  let context: BrowserContext | undefined;
  const timer = setTimeout(() => {
    void context?.close().catch(() => undefined);
  }, BUDGET_MS + GRACE_MS);
  try {
    context = await chromium.launchPersistentContext(PROFILE, {
      channel: 'chrome',
      headless: false,
      viewport: null,
      serviceWorkers: 'block',
      args: [
        '--window-position=-32000,-32000',
        `--proxy-server=http://127.0.0.1:${String((proxy.address() as AddressInfo).port)}`,
        // Chrome sends an address of the machine past the proxy unless it is told not to.
        '--proxy-bypass-list=<-loopback>',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    });
    const page = context.pages()[0] ?? (await context.newPage());
    let status = 0;
    page.on('response', (response) => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame())
        status = response.status();
    });
    const deadline = Date.now() + BUDGET_MS;
    const left = (): number => Math.max(1, deadline - Date.now());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: left() }).catch(() => null);
    while (Date.now() < deadline) {
      const text = await page.innerText('body', { timeout: left() }).catch(() => '');
      const title = await page.title().catch(() => '');
      if (passed(status, page.url(), title, text))
        return { url: page.url(), html: await page.content() };
      await page.waitForTimeout(POLL_MS);
    }
    return `the filter did not let the Chrome window through within ${String(BUDGET_MS / 1000)} seconds`;
  } catch (fault) {
    const reason = (fault instanceof Error ? fault.message : String(fault)).split('\n')[0] ?? '';
    return `the Chrome window could not read the page: ${reason.slice(0, 200)}`;
  } finally {
    clearTimeout(timer);
    await context?.close().catch(() => undefined);
    proxy.close();
  }
};

/** Opens the page in the Chrome of the machine and waits until the filter lets it through. */
export const readThroughFilter: ChallengeReader = (url, options) => {
  const turn = queue.then(() => read(url, options));
  queue = turn.catch(() => undefined);
  return turn;
};
