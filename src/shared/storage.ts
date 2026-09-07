// The version is part of the key `gab.<feature>.v1`, so a later shape writes a later key. A read
// returns the fallback on every browser fault. `index.html` holds a copy of `gab.shell.v1`,
// because the theme class must reach the document before the first paint. Nothing checks the two.
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

/** Every key of the stored record is a key the code still declares. A record that carries any
 * other key falls back, because a guard that admits one lets the patch below write that dead key
 * back for ever, long after the code that read it was deleted. */
export function holdsOnlyDeclaredKeys(
  value: unknown,
  declared: Readonly<Record<string, true>>,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => Object.hasOwn(declared, key));
}
