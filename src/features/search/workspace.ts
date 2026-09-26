import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'search';

interface SearchWorkspace {
  readonly query: string;
}

const DECLARED_KEYS: Readonly<Record<keyof SearchWorkspace, true>> = { query: true };

const isHeld = (value: unknown): value is Readonly<Record<string, unknown>> =>
  holdsOnlyDeclaredKeys(value, DECLARED_KEYS);

export function readLastQuery(): string {
  const held = readWorkspace(FEATURE, isHeld, {})['query'];
  return typeof held === 'string' ? held : '';
}

export function keepLastQuery(query: string): void {
  writeWorkspace(FEATURE, { query } satisfies SearchWorkspace);
}
