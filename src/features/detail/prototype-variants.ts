/**
 * **PROTOTYPE — throwaway.** Three layouts of the entity detail surface, on the one route
 * `/entity/$id`, chosen by `?variant=`. `?surface=` chooses the full page or the narrow sidebar.
 *
 * ADR 0004 §6 decided "pages, not a panel shell" and deferred the layout. This file holds the
 * keys of the exploration; it decides nothing. The winner is folded into the real code and the
 * rest goes to a throwaway branch.
 */

export const VARIANT_KEYS = ['A', 'B', 'C'] as const;
export type VariantKey = (typeof VARIANT_KEYS)[number];

export const VARIANT_NAMES: Readonly<Record<VariantKey, string>> = {
  A: 'Ledger — one column of claim rows',
  B: 'Audit rail — claims left, source cards right',
  C: 'Source first — claims grouped under the document',
};

export const SURFACE_KEYS = ['page', 'sidebar'] as const;
export type Surface = (typeof SURFACE_KEYS)[number];

export const SURFACE_NAMES: Readonly<Record<Surface, string>> = {
  page: 'Full page',
  sidebar: 'Sidebar, beside a map or a graph',
};

export function parseVariant(value: unknown): VariantKey {
  if (typeof value !== 'string') return 'A';
  return VARIANT_KEYS.find((key) => key === value) ?? 'A';
}

export function parseSurface(value: unknown): Surface {
  if (typeof value !== 'string') return 'page';
  return SURFACE_KEYS.find((key) => key === value) ?? 'page';
}

export function nextVariant(current: VariantKey, step: number): VariantKey {
  const at = VARIANT_KEYS.indexOf(current);
  const size = VARIANT_KEYS.length;
  return VARIANT_KEYS[(at + step + size) % size] ?? 'A';
}
