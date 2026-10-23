// What a page says about the release when the application reads its files: the day of the
// version and the two contact links. It is null while the service answers, because the record is
// then the live one and no page names a version.

import { useSyncExternalStore } from 'react';

export interface ReleaseNote {
  readonly version: string;
  /** The day of the release, YYYY-MM-DD. */
  readonly date: string;
  readonly reportError: string;
  readonly rightOfReply: string;
}

let note: ReleaseNote | null = null;
const listeners = new Set<() => void>();

export function setReleaseNote(next: ReleaseNote | null): void {
  note = next;
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

export const useReleaseNote = (): ReleaseNote | null =>
  useSyncExternalStore(
    subscribe,
    () => note,
    () => note,
  );
