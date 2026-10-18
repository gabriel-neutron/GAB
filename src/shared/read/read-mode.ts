// Where the record is read from. The read service answers, or it does not and the files of the
// release that the application was built with take over (ADR 0028). The mode comes from the
// answer of the service only: there is no build flag. The first read that finds the service down
// sets the mode, and a retry (`forgetReadMode`) asks the service again.

import { ReadServiceDown } from './http';

export type ReadMode = 'service' | 'release';

let mode: ReadMode | null = null;

/** Read from the service, and from the release when the service is down. Another fault passes
 * through: a row that the contract refuses is a bug, and the release must not hide it. */
export async function readFrom<T>(
  service: () => Promise<T>,
  release: () => Promise<T>,
): Promise<T> {
  if (mode === 'release') return release();
  try {
    const read = await service();
    mode = 'service';
    return read;
  } catch (cause) {
    if (!(cause instanceof ReadServiceDown)) throw cause;
    const fallback = await release();
    mode = 'release';
    return fallback;
  }
}

export const readMode = (): ReadMode | null => mode;

export function forgetReadMode(): void {
  mode = null;
}
