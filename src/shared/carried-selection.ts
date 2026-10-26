/** The two surfaces that hold a selection in the address. */
const SURFACES: ReadonlySet<string> = new Set(['/map', '/graph']);

/** The selection that a link to `to` carries from the page at `pathname` with the query
 * `search`. A page that is not a surface carries none. Both keys are written out, because each
 * surface declares both. The map can hold both keys, and its panel then names the relation; the
 * graph reads the entity first, so the relation goes alone to the graph. A link to the same
 * surface keeps both keys. */
export const carriedSelection = (
  pathname: string,
  search: string,
  to: '/map' | '/graph',
): { readonly entity: string; readonly relation: string } => {
  if (!SURFACES.has(pathname)) return { entity: '', relation: '' };
  const params = new URLSearchParams(search);
  const entity = params.get('entity') ?? '';
  const relation = params.get('relation') ?? '';
  // The map holds both keys, so a link to it carries both.
  if (to === '/map') return { entity, relation };
  return { entity: relation === '' || pathname === to ? entity : '', relation };
};
