// Whether the write service is online. The application reads the public answer of the writer
// once at the start, and again at each retry. Until the first answer arrives, the status is
// unknown, and an entry that needs the writer stays hidden.

import { useSyncExternalStore } from 'react';
import { z } from 'zod';

export type WriterStatus = 'unknown' | 'online' | 'offline';

// The development server proxies this address to the writer. A public site that has no writer
// answers 404 or a page of the site, and neither one says the writer is online.
const ADDRESS = '/writer-status';

const answer = z.object({ online: z.literal(true) });

let status: WriterStatus = 'unknown';
let probing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

const hold = (next: WriterStatus): void => {
  status = next;
  listeners.forEach((listener) => {
    listener();
  });
};

const ask = async (): Promise<boolean> => {
  try {
    const reply = await fetch(ADDRESS);
    return reply.ok && answer.safeParse(await reply.json()).success;
  } catch {
    return false;
  }
};

/** Read the answer of the writer again, and hold it. */
export function recheckWriter(): Promise<boolean> {
  const own: Promise<boolean> = ask().then((online) => {
    if (probing === own) hold(online ? 'online' : 'offline');
    return online;
  });
  probing = own;
  return own;
}

/** The answer of the first read, or of the last one. A route awaits it before it opens. */
export function probeWriter(): Promise<boolean> {
  return probing ?? recheckWriter();
}

export const writerStatus = (): WriterStatus => status;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** True only when the writer said it is online. */
export function useWriterOnline(): boolean {
  return useSyncExternalStore(subscribe, writerStatus) === 'online';
}
