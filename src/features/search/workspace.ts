import { holdsOnlyDeclaredKeys, readWorkspace, writeWorkspace } from '@/shared/storage';

const FEATURE = 'search';

interface SearchWorkspace {
  readonly query: string;
}

const DECLARED_KEYS: Readonly<Record<keyof SearchWorkspace, true>> = { query: true };

const isHeld = (value: unknown): value is Readonly<Record<string, unknown>> =>
  holdsOnlyDeclaredKeys(value, DECLARED_KEYS);

/** An address that carries `?q=` fills the field, and the kept query fills it otherwise. */
export function readLastQuery(): string {
  const asked = new URLSearchParams(window.location.search).get('q');
  if (asked !== null && asked !== '') return asked;
  const held = readWorkspace(FEATURE, isHeld, {})['query'];
  return typeof held === 'string' ? held : '';
}

export function keepLastQuery(query: string): void {
  writeWorkspace(FEATURE, { query } satisfies SearchWorkspace);
}
