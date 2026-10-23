// Whether the write service is online. The application reads the public answer of the writer
// once at the start, and again at each retry. Until the first answer arrives, the status is
// unknown, and an entry that needs the writer stays hidden.

import { useSyncExternalStore } from 'react';
import { z } from 'zod';

export type WriterStatus = 'unknown' | 'online' | 'offline';

// The `/write` prefix covers this address, in the development proxy and in the host. A public site
// that has no writer answers 404 or a page of the site, and neither one says the writer is online.
const ADDRESS = '/write/status';

const answer = z.object({ online: z.literal(true) });

let status: WriterStatus = 'unknown';
let probing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

const setStatus = (next: WriterStatus): void => {
  status = next;
  listeners.forEach((listener) => {
    listener();
  });
};

// A built site with no read service address is the public site of a release (ADR 0028): it has no
// writer, and a request to the host could only answer 404 and log an error in the console.
const isPublicSite = (): boolean => {
  const held: unknown = import.meta.env['VITE_API_URL'];
  return !import.meta.env.DEV && (typeof held !== 'string' || held.trim() === '');
};

const ask = async (): Promise<boolean> => {
  if (isPublicSite()) return false;
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
    if (probing === own) setStatus(online ? 'online' : 'offline');
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
  // The render at the release has no writer, and the browser asks it after the first paint.
  return useSyncExternalStore(subscribe, writerStatus, () => 'unknown') === 'online';
}
