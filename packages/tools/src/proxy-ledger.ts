// The ceiling of the paid proxy, in the state folder of the supervisor. Each call reserves its cost
// before the call. The log holds the count and the cost, and no key and no address.

import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { locked, readState, saved, type StateClock } from './state-file.ts';

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
   * read then has a line in blocked.md. */
  reserve(read: string): Promise<void>;
  /** Ends a reserved call. A call that the proxy did not answer with a success costs nothing, and
   * the reserved cost returns. */
  settle(charged: boolean): Promise<void>;
}

/** The ceiling of the paid proxy is used up. */
export class ProxyCeiling extends Error {}

const fileText = (path: string): Promise<string> => readFile(path, 'utf8').catch(() => '');

/** The ledger of the paid proxy in the state folder. */
export const proxyLedger = (state: StateClock, costUsd: number = PROXY_PAGE_USD): ProxyLedger => {
  const file = join(state.dir, 'proxy-ledger.json');
  const blocked = join(state.dir, 'blocked.md');
  const empty: Ledger = { ceilingUsd: PROXY_CEILING_USD, spentUsd: 0, pages: 0, failed: 0 };
  const log = (line: string): Promise<void> =>
    appendFile(join(state.dir, 'proxy-log.md'), `${state.now().toISOString()} ${line}\n`, 'utf8');
  return {
    reserve: async (read) => {
      await locked(state, 'proxy', async () => {
        const ledger = await readState<Ledger>(file, empty);
        if (ledger.spentUsd + costUsd > ledger.ceilingUsd) {
          const line = `- ${read}: the proxy reached its ceiling of ${String(ledger.ceilingUsd)} USD\n`;
          // One read stopped many times is one line for the operator.
          if (!(await fileText(blocked)).includes(line)) await appendFile(blocked, line, 'utf8');
          throw new ProxyCeiling(
            `the hosted proxy reached its ceiling of ${String(ledger.ceilingUsd)} USD (waiting_ceiling)`,
          );
        }
        await saved(file, {
          ...ledger,
          spentUsd: ledger.spentUsd + costUsd,
          pages: ledger.pages + 1,
        });
      });
    },
    settle: async (charged) => {
      await locked(state, 'proxy', async () => {
        const ledger = await readState<Ledger>(file, empty);
        const next = charged
          ? ledger
          : {
              ...ledger,
              spentUsd: Math.max(0, ledger.spentUsd - costUsd),
              pages: Math.max(0, ledger.pages - 1),
              failed: ledger.failed + 1,
            };
        await saved(file, next);
        await log(
          `${charged ? 'page' : 'failed'}: ${String(next.pages)} pages, ${next.spentUsd.toFixed(4)} USD of ${String(next.ceilingUsd)}, ${String(next.failed)} failed`,
        );
      });
    },
  };
};
