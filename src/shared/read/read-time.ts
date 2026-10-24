// The time of the last read of the record. A read of the service or of the release sets it, and a
// refresh sets it again.

let readAt: Date | null = null;

export function setReadAt(next: Date | null): void {
  readAt = next;
}

export const readTimeNow = (): Date | null => readAt;

/** The time as `YYYY-MM-DD HH:MM UTC`. UTC, so that two readers see the same words. */
export const readTimeText = (time: Date): string =>
  `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
