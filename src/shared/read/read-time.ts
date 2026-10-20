// The time of the last read of the record. A read of the service or of the release sets it, and a
// refresh sets it again, so the footer shows when the counts on the screen were true.

import { useSyncExternalStore } from 'react';

let readAt: Date | null = null;
const listeners = new Set<() => void>();

export function setReadAt(next: Date | null): void {
  readAt = next;
  listeners.forEach((listener) => {
    listener();
  });
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const readTimeNow = (): Date | null => readAt;

export const useReadAt = (): Date | null =>
  useSyncExternalStore(
    subscribe,
    () => readAt,
    () => readAt,
  );

/** The time as `YYYY-MM-DD HH:MM UTC`. UTC, so that two readers see the same words. */
export const readTimeText = (time: Date): string =>
  `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
