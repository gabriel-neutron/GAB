/**
 * **PROTOTYPE — throwaway.** What the search parameters of the host route may hold.
 *
 * `?surface=` chooses the full page or the sidebar, and `?src=` opens the page at one document,
 * which is how the sidebar hands a source to a new tab.
 *
 * The three readings of 11 August are gone: the operator read the bare table as unreadable and
 * the folded one as unusable on this data. What is left is the grouped one, cleaned. Both
 * parameters are scaffolding, and ADR 0004 §6 stays deferred — this file decides nothing.
 */

export const SURFACE_KEYS = ['page', 'sidebar'] as const;
export type Surface = (typeof SURFACE_KEYS)[number];

export const SURFACE_NAMES: Readonly<Record<Surface, string>> = {
  page: 'Full page',
  sidebar: 'Sidebar',
};

export function parseSurface(value: unknown): Surface {
  if (typeof value !== 'string') return 'page';
  return SURFACE_KEYS.find((key) => key === value) ?? 'page';
}

/** An identifier of a document to open on arrival, or an empty string for none. */
export function parseSource(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
