/** The one sentence an act leaves on the screen, and whether the analyst must act on it now. */
export interface Said {
  readonly sentence: string;
  readonly urgent: boolean;
}

/** A sentence that waits its turn. */
export const calm = (sentence: string): Said => ({ sentence, urgent: false });

/** A sentence that interrupts. A doubt about a write that may have run whole is the thing the
 * analyst acts on before anything else, so it must not wait for a second look at the page. */
export const interrupt = (sentence: string): Said => ({ sentence, urgent: true });
