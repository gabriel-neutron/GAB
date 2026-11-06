// The lease, the pace, the classes of an answer and the ceiling of the proxy. The state is a temporary
// folder, as the state folder of the supervisor is a folder. Two processes prove that the lease holds
// across processes. No test reaches the network or a database.

import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { classOfAnswer } from './answer-class.ts';
import { hostLease, HostHeld, isRussianHost, policyOf } from './host-lease.ts';
import { ProxyCeiling, proxyLedger } from './proxy-ledger.ts';
import type { StateClock } from './state-file.ts';

const START = Date.parse('2026-11-06T10:00:00Z');
const HOST = 'egrul.nalog.ru';

let dir = '';
let now = START;
let sleeps: number[] = [];

const state = (): StateClock => ({
  dir,
  now: () => new Date(now),
  sleep: (ms) => {
    sleeps.push(ms);
    now += ms;
    return Promise.resolve();
  },
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gab-lease-'));
  now = START;
  sleeps = [];
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test('each host with a known limit has its pace, and each Russian host has a lease', () => {
  expect(policyOf(HOST)).toStrictEqual({ gapMs: 30_000, dailyCap: null });
  expect(policyOf('comtradeapi.un.org')).toStrictEqual({ gapMs: 2500, dailyCap: 500 });
  expect(policyOf('www.cbr.ru')?.gapMs).toBeGreaterThan(0);
  expect(policyOf('xn--80aa.xn--p1ai')).not.toBeNull();
  expect(policyOf('example.com')).toBeNull();
  // A name that ends in a dot is the same host.
  expect(policyOf('egrul.nalog.ru.')?.gapMs).toBe(30_000);
  expect(isRussianHost('https://egrul.nalog.ru./x')).toBe(true);
});

test('a second worker waits until the first ends its turn, and then waits the pace', async () => {
  const lease = hostLease(state());
  const release = await lease.acquire(HOST);
  let second = false;
  const waiter = lease.acquire(HOST).then((end) => {
    second = true;
    return end;
  });
  await new Promise((done) => setTimeout(done, 50));
  expect(second).toBe(false);
  await release();
  await (
    await waiter
  )();
  expect(second).toBe(true);
  expect(sleeps.reduce((all, one) => all + one, 0)).toBeGreaterThanOrEqual(30_000);
});

test('a worker that died gives the host back after the time of its lease', async () => {
  const lease = hostLease(state());
  await lease.acquire(HOST); // This worker never ends its turn.
  await (
    await lease.acquire(HOST)
  )();
  expect(now - START).toBeGreaterThanOrEqual(5 * 60 * 1000);
});

test('a read that names a longer time keeps its turn for that time', async () => {
  const lease = hostLease(state());
  await lease.acquire(HOST, 20 * 60 * 1000);
  await (
    await lease.acquire(HOST)
  )();
  expect(now - START).toBeGreaterThanOrEqual(20 * 60 * 1000);
});

test('the lease survives a new process of the tool, because a file holds it', async () => {
  const end = await hostLease(state()).acquire(HOST);
  const file = JSON.parse(readFileSync(join(dir, `lease-${HOST}.json`), 'utf8')) as {
    holder: string | null;
    count: number;
  };
  expect(file.holder).not.toBeNull();
  expect(file.count).toBe(1);
  await end();
});

test('two processes take turns, and their starts keep the pace', async () => {
  const module = pathToFileURL(join(import.meta.dirname, 'host-lease.ts')).href;
  const script = `
    import { hostLease } from ${JSON.stringify(module)};
    const lease = hostLease({
      dir: process.argv[1],
      now: () => new Date(),
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    });
    const end = await lease.acquire('comtradeapi.un.org');
    const start = Date.now();
    await new Promise((done) => setTimeout(done, 200));
    console.log(start + ' ' + Date.now());
    await end();`;
  const worker = (): Promise<number[]> =>
    new Promise((resolve, reject) => {
      execFile(process.execPath, ['--input-type=module', '-e', script, dir], (fault, out) => {
        if (fault === null) resolve(out.trim().split(' ').map(Number));
        else reject(new Error('a worker failed', { cause: fault }));
      });
    });
  const [one, two] = await Promise.all([worker(), worker()]);
  const [firstStart = 0, firstEnd = 0] = (one[0] ?? 0) < (two[0] ?? 0) ? one : two;
  const [secondStart = 0] = (one[0] ?? 0) < (two[0] ?? 0) ? two : one;
  // The second starts after the first ended, and after the gap.
  expect(secondStart).toBeGreaterThanOrEqual(firstEnd);
  // The lease sets the slot before acquire returns, so a loaded machine shortens this measure.
  expect(secondStart - firstStart).toBeGreaterThanOrEqual(2000);
}, 30_000);

test('a hold stops each worker until its time, with the class and the retry time', async () => {
  const lease = hostLease(state());
  const until = START + 60_000;
  await lease.hold(HOST, 'captcha', until);
  const other = hostLease(state());
  await expect(other.acquire(HOST)).rejects.toMatchObject({ hold: 'captcha', until });
  now = until;
  await (
    await other.acquire(HOST)
  )();
});

test('a shorter hold does not replace a longer one', async () => {
  const lease = hostLease(state());
  const until = START + 3_600_000;
  await lease.hold(HOST, 'quota', until);
  await lease.hold(HOST, 'quota', START + 60_000);
  await expect(lease.acquire(HOST)).rejects.toMatchObject({ until });
});

test('a lock of a dead process stops no caller', async () => {
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, `lease-${HOST}.lock`);
  mkdirSync(lock);
  const old = new Date(Date.now() - 60_000);
  utimesSync(lock, old, old);
  await (
    await hostLease(state()).acquire(HOST)
  )();
  expect(existsSync(lock)).toBe(false);
});

test('the end of a turn never throws', async () => {
  const end = await hostLease(state()).acquire(HOST);
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(dir, 'a file in place of the folder');
  await expect(end()).resolves.toBeUndefined();
  rmSync(dir, { force: true });
});

test('the daily cap gives a quota hold until the next day, and the count starts again', async () => {
  const lease = hostLease(state());
  for (let call = 0; call < 500; call += 1) {
    // The lease of each call ends, so only the pace and the count act.
    await (
      await lease.acquire('comtradeapi.un.org')
    )();
    if (call === 498) break;
  }
  await (
    await lease.acquire('comtradeapi.un.org')
  )();
  now = Date.parse('2026-11-06T23:59:00Z');
  const held = await lease.acquire('comtradeapi.un.org').catch((fault: unknown) => fault);
  expect(held).toBeInstanceOf(HostHeld);
  expect(held).toMatchObject({ hold: 'quota', until: Date.parse('2026-11-07T00:00:00Z') });
  now = Date.parse('2026-11-07T00:00:00Z');
  await (
    await lease.acquire('comtradeapi.un.org')
  )();
}, 60_000);

test.each([
  [{ status: 429, body: '', headers: { 'retry-after': '120' } }, 'quota', 'waiting_quota', 120_000],
  [{ status: 429, body: '', headers: {} }, 'quota', 'waiting_quota', 3_600_000],
  [
    { status: 403, body: 'Out of call volume quota', headers: {} },
    'quota',
    'waiting_quota',
    3_600_000,
  ],
  [
    { status: 200, body: '{"captchaRequired":true}', headers: {} },
    'captcha',
    'waiting_source',
    3_600_000,
  ],
  [
    { status: 200, body: '<form>captcha</form>', headers: {} },
    'captcha',
    'waiting_source',
    3_600_000,
  ],
  [{ status: 403, body: 'no', headers: {} }, 'refused', 'waiting_source', 3_600_000],
])('an answer gets its class and its hold state: %j', (answer, kind, holdState, wait) => {
  expect(classOfAnswer(answer, START)).toStrictEqual({
    kind,
    holdState,
    retryAt: START + wait,
  });
});

test('a stated wait has a limit, so a wrong value does not stop a host for ever', () => {
  const answer = { status: 429, body: '', headers: { 'retry-after': '10000000000000' } };
  expect(classOfAnswer(answer, START).retryAt).toBe(START + 24 * 60 * 60 * 1000);
});

test.each([
  [{ status: 404, body: 'gone', headers: {} }, 'not_found'],
  [{ status: 404, body: 'a form with captcha', headers: {} }, 'not_found'],
  [{ status: 500, body: 'a form with captcha', headers: {} }, 'server'],
  [{ status: 200, body: '{"captchaRequired":false}', headers: {} }, 'ok'],
  [{ status: 503, body: 'down', headers: {} }, 'server'],
])('an answer with no hold: %j', (answer, kind) => {
  expect(classOfAnswer(answer, START)).toStrictEqual({ kind, holdState: null, retryAt: null });
});

test('the ledger logs count and cost, and a failed call costs nothing', async () => {
  const ledger = proxyLedger(state(), 1);
  await ledger.reserve('O2-01');
  await ledger.settle(true);
  await ledger.reserve('O2-01');
  await ledger.settle(false);
  const stored = JSON.parse(readFileSync(join(dir, 'proxy-ledger.json'), 'utf8')) as unknown;
  expect(stored).toStrictEqual({ ceilingUsd: 25, spentUsd: 1, pages: 1, failed: 1 });
  const log = readFileSync(join(dir, 'proxy-log.md'), 'utf8');
  expect(log).toContain('1 pages, 1.0000 USD of 25');
  expect(log).toContain('failed');
  expect(existsSync(join(dir, 'blocked.md'))).toBe(false);
});

test('at the ceiling the batch stops, and the ticket goes to blocked.md', async () => {
  const ledger = proxyLedger(state(), 10);
  await ledger.reserve('O2-01');
  await ledger.settle(true);
  await ledger.reserve('O2-01');
  await ledger.settle(true);
  await expect(ledger.reserve('O2-01')).rejects.toBeInstanceOf(ProxyCeiling);
  await expect(ledger.reserve('O2-01')).rejects.toBeInstanceOf(ProxyCeiling);
  // One read stopped two times is one line.
  expect(readFileSync(join(dir, 'blocked.md'), 'utf8').match(/O2-01/gu)).toHaveLength(1);
});
