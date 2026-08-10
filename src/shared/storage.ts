/**
 * The workspace store of ADR 0004 §7.
 *
 * One key per feature, `gab.<feature>.v1`. The version is part of the key, so a later shape
 * writes a later key and never reads this one. A read returns the fallback on every fault the
 * browser can produce: no storage, absent key, broken JSON, or a value that fails the guard.
 * A value that fails the guard is a value of another version, so the two cases are one.
 */

// `index.html` holds a copy of the key `gab.shell.v1`, because the theme class must reach the
// document before the first paint and no module runs that early. Change this line and that
// script together. Nothing checks the two.
const keyOf = (feature: string): string => `gab.${feature}.v1`;

export function readWorkspace<T>(
  feature: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(keyOf(feature));
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }

  return isValid(parsed) ? parsed : fallback;
}

export function writeWorkspace(feature: string, value: unknown): void {
  try {
    window.localStorage.setItem(keyOf(feature), JSON.stringify(value));
  } catch {
    // The quota is full, or the browser refuses storage. The workspace is a convenience and
    // never the source of truth, so a failed write is not an error the operator can act on.
  }
}
