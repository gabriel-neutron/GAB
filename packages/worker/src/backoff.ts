// The count of attempts is the only history a job row keeps. This wait grows from that count
// alone, doubling with each lost claim and capped, and never from an elapsed time the row does
// not record.
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

/** The wait, in milliseconds, before this worker acts on a job of the given attempt count. */
export const backoffMs = (attempt: number): number =>
  Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
