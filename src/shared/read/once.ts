/** One read, held for every later caller. A failure clears the memory: a rejected promise that
 * stayed would answer every later attempt with the first failure. */
export interface Once<T> {
  readonly load: () => Promise<T>;
  /** Forget the answer. A caller that has changed the record must reach the later state, and a
   * held promise is the one thing between it and that state. */
  readonly forget: () => void;
}

export function readOnce<T>(read: () => Promise<T>): Once<T> {
  let reading: Promise<T> | null = null;

  return {
    load: () => {
      reading ??= read().catch((reason: unknown) => {
        reading = null;
        throw reason;
      });
      return reading;
    },
    forget: () => {
      reading = null;
    },
  };
}
