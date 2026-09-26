/** Departure: one read, held for every later caller. A failure clears the memory of its own read
 * only: a rejected promise that stayed would answer every later attempt with the first failure,
 * and a read that forget() let go must not clear the read that came after it. */
export interface Once<T> {
  readonly load: () => Promise<T>;
  /** Departure: forget the answer. A caller that has changed the record must reach the later
   * state, and a held promise is the one thing between it and that state. */
  readonly forget: () => void;
}

export function readOnce<T>(read: () => Promise<T>): Once<T> {
  let reading: Promise<T> | null = null;

  return {
    load: () => {
      if (reading !== null) return reading;
      const own: Promise<T> = read().catch((reason: unknown) => {
        if (reading === own) reading = null;
        throw reason;
      });
      reading = own;
      return own;
    },
    forget: () => {
      reading = null;
    },
  };
}
