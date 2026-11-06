// One JSON file in the state folder of the supervisor, changed under a lock that each process of the
// machine sees. The lease and the ledger of the proxy keep their state here, and not in the database,
// so their state survives a stop of the database.

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface StateClock {
  readonly dir: string;
  readonly now: () => Date;
  readonly sleep: (ms: number) => Promise<void>;
}

// Assumption: one write of the state takes far less. A lock of a dead process ends after this.
const STALE_LOCK_MS = 15_000;
// A caller waits longer than a stale lock lasts, so a dead process stops no caller.
const LOCK_WAIT_MS = 45_000;
const LOCK_POLL_MS = 10;
const SAVE_TRIES = 20;

const codeOf = (fault: unknown): unknown =>
  typeof fault === 'object' && fault !== null && 'code' in fault ? fault.code : undefined;

// External constraint: Windows gives these codes to a folder or a file that another process is
// removing or holds open for a short time.
const isBusy = (fault: unknown): boolean =>
  ['EEXIST', 'EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY'].includes(String(codeOf(fault)));

// This wait is a real wait, also in a test: another process holds the lock.
const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

const takeLock = async (lock: string): Promise<void> => {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      // The creation of a folder is atomic on each platform.
      await mkdir(lock);
      return;
    } catch (fault) {
      if (!isBusy(fault)) throw fault;
    }
    const made = await stat(lock).catch(() => null);
    if (made !== null && Date.now() - made.mtimeMs > STALE_LOCK_MS) {
      // A rename has one winner, so two waiters do not both remove the lock of a dead process.
      const moved = `${lock}.${randomUUID()}.stale`;
      await rename(lock, moved)
        .then(() => rm(moved, { recursive: true, force: true }))
        .catch(() => undefined);
    }
    await pause(LOCK_POLL_MS);
  }
  throw new Error('the state file stayed locked');
};

/** Runs the work under the lock of this name. */
export const locked = async <Result>(
  state: StateClock,
  name: string,
  work: () => Promise<Result>,
): Promise<Result> => {
  await mkdir(state.dir, { recursive: true });
  const lock = join(state.dir, `${name}.lock`);
  await takeLock(lock);
  try {
    return await work();
  } finally {
    // A lock that stays here ends as a stale lock.
    await rm(lock, { recursive: true, force: true }).catch(() => undefined);
  }
};

/** Replaces the file in one step. */
export const saved = async (path: string, value: unknown): Promise<void> => {
  const part = `${path}.${randomUUID()}.tmp`;
  await writeFile(part, JSON.stringify(value), 'utf8');
  for (let tries = 1; ; tries += 1) {
    try {
      await rename(part, path);
      return;
    } catch (fault) {
      if (!isBusy(fault) || tries >= SAVE_TRIES) throw fault;
      await pause(LOCK_POLL_MS * tries);
    }
  }
};

/** The file, or the empty value when it does not exist. */
export const readState = async <Value>(path: string, empty: Value): Promise<Value> => {
  try {
    return { ...empty, ...(JSON.parse(await readFile(path, 'utf8')) as Value) };
  } catch (fault) {
    if (codeOf(fault) === 'ENOENT') return empty;
    throw fault;
  }
};
