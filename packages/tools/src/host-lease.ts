// The shared budget of a rate-limited host: one worker at a time, a pace, a daily counter and a hold.
// The state is one file per host in the state folder of the supervisor, and not in the database, so
// a lease survives a stop of the database and each process of the machine reads the same state.
// Only this module and the supervisor write that folder. No file here holds a key or a full address.

import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import type { HoldClass } from './answer-class.ts';
import { proxyLedger, type ProxyLedger } from './proxy-ledger.ts';
import { locked, readState, saved, type StateClock } from './state-file.ts';

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

/** A read of a host ends inside this time. A worker that died gives the host back after it, so
 * each tool keeps its read shorter. */
export const LEASE_MS = 5 * 60 * 1000;
const POLL_MS = 500;

// A name can end in a dot, and it is the same host.
const plainHost = (host: string): string => host.replace(/\.$/u, '').toLowerCase();

const isRussianName = (host: string): boolean => host.endsWith('.ru') || host.endsWith('.xn--p1ai');

/** The host of a Russian address, in the form that the lease names it, or null for another address. */
export const russianHostOf = (url: string): string | null => {
  const parsed = URL.parse(url);
  if (parsed === null) return null;
  const host = plainHost(parsed.hostname);
  return isRussianName(host) ? host : null;
};

/** True for a host in .ru or in .рф (xn--p1ai). */
export const isRussianHost = (url: string): boolean => russianHostOf(url) !== null;

/** The pace of a host, or null for a host that needs no lease. */
export const policyOf = (given: string): Policy | null => {
  const host = plainHost(given);
  return POLICIES[host] ?? (isRussianName(host) ? RUSSIAN_POLICY : null);
};

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
   * It throws HostHeld during a hold or above the daily cap. The end of a turn never throws: a turn
   * that a fault keeps ends with the time of its lease. A read that can last longer than LEASE_MS
   * names its longest time. */
  acquire(host: string, readMs?: number): Promise<() => Promise<void>>;
  /** Stops the calls to the host until this time, for each worker. A longer hold stays. */
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

const nextDay = (now: Date): number =>
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

/** The lease that the state folder holds. */
export const hostLease = (state: StateClock): HostLease => {
  const fileOf = (host: string): string => join(state.dir, `lease-${host}.json`);
  const take = async (
    host: string,
    policy: Policy,
    token: string,
    leaseMs: number,
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
        leaseUntil: slot + leaseMs,
        lastStart: slot,
        day,
        count: count + 1,
        hold: null,
      } satisfies LeaseFile);
      return { wait: slot - ms, taken: true };
    });
  return {
    acquire: async (given, readMs = LEASE_MS) => {
      const host = plainHost(given);
      const policy = policyOf(host) ?? RUSSIAN_POLICY;
      const token = randomUUID();
      for (;;) {
        const { wait, taken } = await take(host, policy, token, Math.max(LEASE_MS, readMs));
        if (wait > 0) await state.sleep(wait);
        if (taken) break;
      }
      return async () => {
        await locked(state, `lease-${host}`, async () => {
          const file = await readState<LeaseFile>(fileOf(host), EMPTY);
          if (file.holder === token) await saved(fileOf(host), { ...file, holder: null });
        }).catch(() => undefined);
      };
    },
    hold: async (given, hold, until) => {
      const host = plainHost(given);
      await locked(state, `lease-${host}`, async () => {
        const file = await readState<LeaseFile>(fileOf(host), EMPTY);
        const kept =
          file.hold !== null && file.hold.until > until ? file.hold : { kind: hold, until };
        await saved(fileOf(host), { ...file, hold: kept });
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
