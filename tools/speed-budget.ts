// The speed budget of the public site. A manual command, not a required check.
//
//   pnpm speed:budget [--site <folder>] [--entity <path>]
//
// It serves a built site (default `dist`, or the folder `gab-site-<date>` of a release), opens the
// home page, the map and one entity page in headless Chromium on a slow network, and prints one
// table. It exits with 1 when a budget is passed. The budgets are in `speed-budget.json`.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium, type Page } from 'playwright';

import {
  compare,
  passes,
  table,
  type PageBudget,
  type PageMeasure,
} from './speed-budget-compare.ts';

interface BudgetFile {
  readonly measuredOn: string;
  readonly network: {
    readonly downloadKbps: number;
    readonly uploadKbps: number;
    readonly latencyMs: number;
  };
  readonly pages: Readonly<Record<string, PageBudget>>;
}

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

const MAIN_WAIT_MS = 45_000;
const PAN_STEPS = 90;

/** A static server for one folder. A path with a folder or no extension gets its `index.html`,
 * and a missing page gets the root `index.html`, as the host of the site does. */
function serve(root: string): Promise<{ port: number; close: () => void }> {
  const server = createServer((request, reply) => {
    let path: string;
    try {
      path = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
    } catch {
      path = '/';
    }
    const target = join(root, normalize(path).replace(/^(\.\.[/\\])+/u, ''));
    const candidates = [target, join(target, 'index.html'), join(root, 'index.html')];
    const file = candidates.find((one) => existsSync(one) && statSync(one).isFile());
    // A missing file, or a missing page under /entity/, is a 404: the home page must not answer.
    const missing = file === undefined || (file === candidates[2] && path.startsWith('/entity/'));
    if (file === undefined || missing) {
      reply.statusCode = 404;
      reply.end();
      return;
    }
    reply.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    reply.end(readFileSync(file));
  });
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      done({ port: (server.address() as AddressInfo).port, close: () => server.close() });
    });
  });
}

/** Time to the first element of the selector, counted from the start of the navigation. */
const mainContentMs = (page: Page, selector: string): Promise<number | null> =>
  page
    .waitForSelector(selector, { state: 'visible', timeout: MAIN_WAIT_MS })
    .then(() => page.evaluate(() => performance.now()))
    .catch(() => null);

/** Time from a key press to the second frame after it. */
async function inputMs(page: Page): Promise<number> {
  await page.evaluate(() => {
    document.addEventListener(
      'keydown',
      (event) => {
        const start = event.timeStamp;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            (window as unknown as { __input: number }).__input = performance.now() - start;
          });
        });
      },
      { capture: true, once: true },
    );
  });
  await page.keyboard.press('Tab');
  const answered = await page
    .waitForFunction(() => '__input' in window, undefined, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!answered) return Number.POSITIVE_INFINITY;
  return page.evaluate(() => (window as unknown as { __input: number }).__input);
}

/** The frame rate of a scripted pan: a drag across the canvas, counted by animation frames. */
async function panFps(page: Page): Promise<number | null> {
  const box = await page.locator('main canvas').first().boundingBox();
  if (box === null) return null;
  await page.evaluate(() => {
    const state = { frames: 0, running: true };
    (window as unknown as { __pan: typeof state }).__pan = state;
    const tick = (): void => {
      state.frames += 1;
      if (state.running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const startX = box.x + box.width * 0.7;
  const startY = box.y + box.height * 0.5;
  const started = Date.now();
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= PAN_STEPS; step += 1) {
    const turn = (step / PAN_STEPS) * Math.PI * 2;
    await page.mouse.move(startX - Math.sin(turn) * 150, startY + (1 - Math.cos(turn)) * 60);
  }
  await page.mouse.up();
  const seconds = (Date.now() - started) / 1000;
  const frames = await page.evaluate(() => {
    const state = (window as unknown as { __pan: { frames: number; running: boolean } }).__pan;
    state.running = false;
    return state.frames;
  });
  return frames / seconds;
}

interface Target {
  readonly name: string;
  readonly path: string | null;
  readonly selector: string;
  readonly isMap: boolean;
}

/** True when the browser can make a WebGL context. */
const hasWebgl = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  });

async function measure(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  base: string,
  target: Target,
  network: BudgetFile['network'],
  hasRelease: boolean,
): Promise<PageMeasure> {
  if (target.path === null) return { skipped: 'no entity page in the site' };
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: network.latencyMs,
      downloadThroughput: (network.downloadKbps * 1000) / 8,
      uploadThroughput: (network.uploadKbps * 1000) / 8,
    });
    let bytes = 0;
    session.on('Network.loadingFinished', (event: { encodedDataLength: number }) => {
      bytes += event.encodedDataLength;
    });
    await page.goto(`${base}${target.path}`, { waitUntil: 'commit' });
    const main = await mainContentMs(page, target.selector);
    if (main === null) {
      // The map is skipped only when it cannot render by design. Else a broken map fails.
      if (target.isMap && !hasRelease) return { skipped: 'the site holds no release data' };
      if (target.isMap && !(await hasWebgl(page))) return { skipped: 'the browser has no WebGL' };
      return target.isMap
        ? { mainContentMs: Number.POSITIVE_INFINITY, inputMs: 0, weightKb: bytes / 1000, fps: 0 }
        : { mainContentMs: Number.POSITIVE_INFINITY, inputMs: 0, weightKb: bytes / 1000 };
    }
    await page.waitForLoadState('networkidle', { timeout: MAIN_WAIT_MS }).catch(() => undefined);
    const input = await inputMs(page);
    const fps = target.isMap ? await panFps(page) : undefined;
    return {
      mainContentMs: main,
      inputMs: input,
      weightKb: bytes / 1000,
      ...(fps === null || fps === undefined ? {} : { fps }),
    };
  } finally {
    await context.close();
  }
}

const firstEntity = (site: string): string | null => {
  const folder = join(site, 'entity');
  if (!existsSync(folder)) return null;
  const one = readdirSync(folder).find((name) => existsSync(join(folder, name, 'index.html')));
  return one === undefined ? null : `/entity/${one}/`;
};

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { site: { type: 'string' }, entity: { type: 'string' } },
  });
  const site = resolve(values.site ?? 'dist');
  if (!existsSync(join(site, 'index.html'))) {
    console.error(`No built site in ${site}. Build one, or pass --site <folder>.`);
    return 2;
  }
  const budgetFile = JSON.parse(
    readFileSync(join(import.meta.dirname, 'speed-budget.json'), 'utf8'),
  ) as BudgetFile;
  const targets: readonly Target[] = [
    { name: 'home', path: '/', selector: 'main h1', isMap: false },
    { name: 'map', path: '/map/', selector: 'main canvas', isMap: true },
    { name: 'entity', path: values.entity ?? firstEntity(site), selector: 'main h1', isMap: false },
  ];
  const server = await serve(site);
  const browser = await chromium.launch();
  try {
    const measures: Record<string, PageMeasure> = {};
    for (const target of targets)
      measures[target.name] = await measure(
        browser,
        `http://127.0.0.1:${String(server.port)}`,
        target,
        budgetFile.network,
        existsSync(join(site, 'release')),
      );
    const rows = compare(budgetFile.pages, measures);
    console.log(`Budgets measured on ${budgetFile.measuredOn}`);
    console.log(table(rows));
    if (passes(rows)) return 0;
    console.error('A budget is passed.');
    return 1;
  } finally {
    await browser.close();
    server.close();
  }
}

process.exitCode = await main();
