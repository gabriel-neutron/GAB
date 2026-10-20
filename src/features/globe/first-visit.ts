import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'first-visit';

interface FirstVisitWorkspace {
  readonly closed: boolean;
}

const DECLARED_KEYS: Readonly<Record<keyof FirstVisitWorkspace, true>> = { closed: true };

const isHeld = (value: unknown): value is Readonly<Record<string, unknown>> =>
  holdsOnlyDeclaredKeys(value, DECLARED_KEYS);

/** True when the reader closed the card of the first visit in this browser. */
export function readFirstVisitClosed(): boolean {
  return readWorkspace(FEATURE, isHeld, {})['closed'] === true;
}

export function keepFirstVisitClosed(): void {
  writeWorkspace(FEATURE, { closed: true } satisfies FirstVisitWorkspace);
}
