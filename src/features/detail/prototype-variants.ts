/**
 * **PROTOTYPE — throwaway.** What the search parameters of the host route may hold.
 *
 * `?surface=` chooses the full page or the sidebar. `?variant=` chooses one of three readings of
 * the record — see `claim-views.tsx`. `?src=` opens the page at one document, which is how the
 * sidebar hands a source to a new tab.
 *
 * All three are scaffolding. ADR 0004 §6 deferred the layout, and this file decides nothing: the
 * parameters go when a reading wins and is folded into the real code.
 */

export const VARIANT_KEYS = ['A', 'B', 'C'] as const;
export type VariantKey = (typeof VARIANT_KEYS)[number];

export const VARIANT_NAMES: Readonly<Record<VariantKey, string>> = {
  A: 'Grouped — the group names what the row is',
  B: 'Bare table — no box until the pointer asks',
  C: 'Folded — a hundred claims open as nine lines',
};

export const SURFACE_KEYS = ['page', 'sidebar'] as const;
export type Surface = (typeof SURFACE_KEYS)[number];

export const SURFACE_NAMES: Readonly<Record<Surface, string>> = {
  page: 'Full page',
  sidebar: 'Sidebar',
};

export function parseVariant(value: unknown): VariantKey {
  if (typeof value !== 'string') return 'A';
  return VARIANT_KEYS.find((key) => key === value) ?? 'A';
}

export function parseSurface(value: unknown): Surface {
  if (typeof value !== 'string') return 'page';
  return SURFACE_KEYS.find((key) => key === value) ?? 'page';
}

/** An identifier of a document to open on arrival, or an empty string for none. */
export function parseSource(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function nextVariant(current: VariantKey, step: number): VariantKey {
  const at = VARIANT_KEYS.indexOf(current);
  const size = VARIANT_KEYS.length;
  return VARIANT_KEYS[(at + step + size) % size] ?? 'A';
}
