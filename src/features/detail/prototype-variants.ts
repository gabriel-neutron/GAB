/**
 * **PROTOTYPE — throwaway.** What the search parameters of the host route may hold.
 *
 * The three layouts of the first pass (ledger, audit rail, source first) are gone: the operator
 * read all three as unreadable at the density that matters. One layout remains, and the only
 * choice left is the surface. ADR 0004 §6 deferred the layout, and this file decides nothing —
 * `?surface=` and `?src=` are scaffolding, and they disappear when the layout is folded in.
 */

export const SURFACE_KEYS = ['page', 'sidebar'] as const;
export type Surface = (typeof SURFACE_KEYS)[number];

export const SURFACE_NAMES: Readonly<Record<Surface, string>> = {
  page: 'Full page',
  sidebar: 'Sidebar, beside a map or a graph',
};

export function parseSurface(value: unknown): Surface {
  if (typeof value !== 'string') return 'page';
  return SURFACE_KEYS.find((key) => key === value) ?? 'page';
}

/** An identifier of a document to open on arrival, or an empty string for none. */
export function parseSource(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
