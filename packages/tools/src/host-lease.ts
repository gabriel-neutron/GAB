// The shared budget of a rate-limited host: one worker at a time, a pace, a daily counter and a hold.
// The state is one file per host in the state folder of the supervisor, and not in the database, so
// a lease survives a stop of the database and each process of the machine reads the same state.
// Only this module and the supervisor write that folder. No file here holds a key or a full address.

import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export type HoldClass = 'quota' | 'captcha' | 'refused';

/** The state of a ticket on a hold of the host. The tick owns these words. */
export type HoldState = 'waiting_quota' | 'waiting_source';

interface Policy {
  readonly gapMs: number;
  /** The most calls in one UTC day, when the host states a limit. */
  readonly dailyCap: number | null;
}

// The method and the panel ruling give the first two paces. External constraint: the free key of
// Comtrade allows 500 calls a day. The pace of another Russian state host is an assumption of the
// first build, and no measure supports it.
const POLICIES: Readonly<Record<string, Policy>> = {
  'egrul.nalog.ru': { gapMs: 30_000, dailyCap: null },
  'comtradeapi.un.org': { gapMs: 2500, dailyCap: 500 },
};
const RUSSIAN_POLICY: Policy = { gapMs: 5000, dailyCap: null };

// Assumption: no read holds a host for longer. A worker that died gives the host back after this.
const LEASE_MS = 5 * 60 * 1000;
const POLL_MS = 500;
// Assumption: one write of the state takes far less. A lock of a dead process ends after this.
const STALE_LOCK_MS = 15_000;
const LOCK_TRIES = 200;

/** True for a host in .ru or in .рф (xn--p1ai). */
export const isRussianHost = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('.ru') || hostname.endsWith('.xn--p1ai');
  } catch {
    return false;
  }
};

/** The pace of a host, or null for a host that needs no lease. */
export const policyOf = (host: string): Policy | null =>
  POLICIES[host] ?? (host.endsWith('.ru') || host.endsWith('.xn--p1ai') ? RUSSIAN_POLICY : null);

/** The host stops the calls until the time that this error holds. */
export class HostHeld extends Error {
  readonly hold: HoldClass;
  readonly until: number;
  constructor(host: string, hold: HoldClass, until: number) {
    super(`${host} is on a ${hold} hold until ${new Date(until).toISOString()}`);
    this.hold = hold;
    this.until = until;
  }
}

export interface HostLease {
  /** Waits for the one turn of the host and its pace, and gives the function that ends the turn.
   * It throws HostHeld during a hold or above the daily cap. */
  acquire(host: string): Promise<() => Promise<void>>;
  /** Stops the calls to the host until this time, for each worker. */
  hold(host: string, hold: HoldClass, until: number): Promise<void>;
}

interface LeaseFile {
  holder: string | null;
  leaseUntil: number;
  lastStart: number;
  day: string;
  count: number;
  hold: { kind: HoldClass; until: number } | null;
}

const EMPTY: LeaseFile = {
  holder: null,
  leaseUntil: 0,
  lastStart: 0,
  day: '',
  count: 0,
  hold: null,
};

export interface StateClock {
  readonly dir: string;
  readonly now: () => Date;
  readonly sleep: (ms: number) => Promise<void>;
}

const isFault = (fault: unknown, code: string): boolean =>
  typeof fault === 'object' && fault !== null && 'code' in fault && fault.code === code;

// The lock is a folder, because the creation of a folder is atomic on each platform.
const locked = async <Result>(
  state: StateClock,
  name: string,
  work: () => Promise<Result>,
): Promise<Result> => {
  await mkdir(state.dir, { recursive: true });
  const lock = join(state.dir, `${name}.lock`);
  for (let tries = 0; tries < LOCK_TRIES; tries += 1) {
    try {
      await mkdir(lock);
      try {
        return await work();
      } finally {
        await rm(lock, { recursive: true, force: true });
      }
    } catch (fault) {
      if (!isFault(fault, 'EEXIST')) throw fault;
      const made = await stat(lock).catch(() => null);
      if (made !== null && Date.now() - made.mtimeMs > STALE_LOCK_MS)
        await rm(lock, { recursive: true, force: true });
      // This wait is a real wait, also in a test: another process holds the lock.
      await new Promise((done) => setTimeout(done, 10));
    }
  }
  throw new Error('the state of the host stayed locked');
};

const saved = async (path: string, value: unknown): Promise<void> => {
  const part = `${path}.${randomUUID()}.tmp`;
  await writeFile(part, JSON.stringify(value), 'utf8');
  await rename(part, path);
};

const readState = async <Value>(path: string, empty: Value): Promise<Value> => {
  try {
    return { ...empty, ...(JSON.parse(await readFile(path, 'utf8')) as Value) };
  } catch (fault) {
    if (isFault(fault, 'ENOENT')) return empty;
    throw fault;
  }
};

const nextDay = (now: Date): number =>
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

/** The lease that the state folder holds. */
export const hostLease = (state: StateClock): HostLease => {
  const fileOf = (host: string): string => join(state.dir, `lease-${host}.json`);
  const take = async (
    host: string,
    policy: Policy,
    token: string,
  ): Promise<{ wait: number; taken: boolean }> =>
    locked(state, `lease-${host}`, async () => {
      const file = await readState<LeaseFile>(fileOf(host), EMPTY);
      const now = state.now();
      const ms = now.getTime();
      if (file.hold !== null && ms < file.hold.until)
        throw new HostHeld(host, file.hold.kind, file.hold.until);
      if (file.holder !== null && ms < file.leaseUntil) return { wait: POLL_MS, taken: false };
      const day = now.toISOString().slice(0, 10);
      const count = file.day === day ? file.count : 0;
      if (policy.dailyCap !== null && count >= policy.dailyCap)
        throw new HostHeld(host, 'quota', nextDay(now));
      const slot = Math.max(ms, file.lastStart + policy.gapMs);
      await saved(fileOf(host), {
        holder: token,
        leaseUntil: slot + LEASE_MS,
        lastStart: slot,
        day,
        count: count + 1,
        hold: null,
      } satisfies LeaseFile);
      return { wait: slot - ms, taken: true };
    });
  return {
    acquire: async (host) => {
      const policy = policyOf(host) ?? RUSSIAN_POLICY;
      const token = randomUUID();
      for (;;) {
        const { wait, taken } = await take(host, policy, token);
        if (wait > 0) await state.sleep(wait);
        if (taken) break;
      }
      return async () => {
        await locked(state, `lease-${host}`, async () => {
          const file = await readState<LeaseFile>(fileOf(host), EMPTY);
          if (file.holder === token) await saved(fileOf(host), { ...file, holder: null });
        });
      };
    },
    hold: async (host, hold, until) => {
      await locked(state, `lease-${host}`, async () => {
        const file = await readState<LeaseFile>(fileOf(host), EMPTY);
        await saved(fileOf(host), { ...file, hold: { kind: hold, until } });
      });
    },
  };
};

/** The class of one answer of a host. */
export interface AnswerClass {
  readonly kind: 'ok' | 'not_found' | 'server' | HoldClass;
  /** The state of the ticket. A class with no hold gives null. */
  readonly holdState: HoldState | null;
  /** The time to ask again, for a class with a hold. */
  readonly retryAt: number | null;
}

// Assumption of the first build: the reset of the CAPTCHA and of a quota with no stated time are not
// measured. The first pilot measures each, and this value then changes.
const HOLD_MS = 60 * 60 * 1000;

/** The wait after a limit of a host that states no time. */
export const HOST_LIMIT_HOLD_MS = HOLD_MS;

const retryAfter = (value: string | undefined, now: number): number | null => {
  if (value === undefined) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1000;
  const day = Date.parse(value);
  return Number.isNaN(day) ? null : day;
};

/** The class of an answer. No code in this project solves a CAPTCHA: this class stops the calls. */
export const classOfAnswer = (
  answer: {
    readonly status: number;
    readonly body: string;
    readonly headers: Readonly<Record<string, string>>;
  },
  now: number,
): AnswerClass => {
  // A normal answer of the register holds this field with the value false, and that is no CAPTCHA.
  const body = answer.body.replace(/"captchaRequired"\s*:\s*false/gu, '');
  if (/captcha/iu.test(body))
    return { kind: 'captcha', holdState: 'waiting_source', retryAt: now + HOLD_MS };
  if (answer.status === 429 || /volume quota|quota exceeded|rate limit/iu.test(body))
    return {
      kind: 'quota',
      holdState: 'waiting_quota',
      retryAt: retryAfter(answer.headers['retry-after'], now) ?? now + HOLD_MS,
    };
  if (answer.status === 403)
    return { kind: 'refused', holdState: 'waiting_source', retryAt: now + HOLD_MS };
  if (answer.status === 404) return { kind: 'not_found', holdState: null, retryAt: null };
  if (answer.status >= 200 && answer.status <= 299)
    return { kind: 'ok', holdState: null, retryAt: null };
  return { kind: 'server', holdState: null, retryAt: null };
};

/** The ceiling of the operator on the paid proxy, in USD. The state file holds the value in use. */
export const PROXY_CEILING_USD = 25;

// External constraint: the list price of the Web Unlocker of Bright Data is 1.50 USD per 1000 pages.
// Not checked against an invoice. The pilot of about 100 pages measures the true cost.
export const PROXY_PAGE_USD = 0.0015;

interface Ledger {
  ceilingUsd: number;
  spentUsd: number;
  pages: number;
  failed: number;
}

export interface ProxyLedger {
  /** Reserves the cost of one call before the call. It throws ProxyCeiling with no room, and the
   * ticket then goes to blocked.md. */
  reserve(ticket: string): Promise<void>;
  /** Ends a reserved call. A failed call costs nothing, and the reserved cost returns. */
  settle(ok: boolean): Promise<void>;
}

/** The ceiling of the paid proxy is used up. */
export class ProxyCeiling extends Error {}

/** The ledger of the paid proxy in the state folder. The log holds the count and the cost, and no
 * key and no address. */
export const proxyLedger = (state: StateClock, costUsd: number = PROXY_PAGE_USD): ProxyLedger => {
  const file = join(state.dir, 'proxy-ledger.json');
  const empty: Ledger = { ceilingUsd: PROXY_CEILING_USD, spentUsd: 0, pages: 0, failed: 0 };
  const log = (line: string): Promise<void> =>
    appendFile(join(state.dir, 'proxy-log.md'), `${state.now().toISOString()} ${line}\n`, 'utf8');
  return {
    reserve: async (ticket) => {
      await locked(state, 'proxy', async () => {
        const ledger = await readState<Ledger>(file, empty);
        if (ledger.spentUsd + costUsd > ledger.ceilingUsd) {
          await appendFile(
            join(state.dir, 'blocked.md'),
            `- ${ticket}: the proxy reached its ceiling of ${String(ledger.ceilingUsd)} USD\n`,
            'utf8',
          );
          throw new ProxyCeiling(
            `the hosted proxy reached its ceiling of ${String(ledger.ceilingUsd)} USD`,
          );
        }
        await saved(file, {
          ...ledger,
          spentUsd: ledger.spentUsd + costUsd,
          pages: ledger.pages + 1,
        });
      });
    },
    settle: async (ok) => {
      await locked(state, 'proxy', async () => {
        const ledger = await readState<Ledger>(file, empty);
        const next = ok
          ? ledger
          : {
              ...ledger,
              spentUsd: Math.max(0, ledger.spentUsd - costUsd),
              pages: Math.max(0, ledger.pages - 1),
              failed: ledger.failed + 1,
            };
        await saved(file, next);
        await log(
          `${ok ? 'page' : 'failed'}: ${String(next.pages)} pages, ${next.spentUsd.toFixed(4)} USD of ${String(next.ceilingUsd)}, ${String(next.failed)} failed`,
        );
      });
    },
  };
};

/** The lease and the ledger of a surface. GAB_STATE_DIR names the folder, and each process of the
 * machine must read the same one. The default is one folder per user. */
export const hostGuards = (
  env: Readonly<Record<string, string | undefined>>,
): { readonly hostLease: HostLease; readonly proxyLedger: ProxyLedger } => {
  const given = env['GAB_STATE_DIR']?.trim() ?? '';
  const state: StateClock = {
    dir: resolve(given === '' ? join(homedir(), '.cache', 'gab-host-state') : given),
    now: () => new Date(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  };
  return { hostLease: hostLease(state), proxyLedger: proxyLedger(state) };
};
