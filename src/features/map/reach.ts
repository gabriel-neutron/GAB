import type { GeoLink, Projection } from './projection';

// The depth of `api.neighbourhood`, which is the walk of the read path: it reads no direction,
// and its default depth is two. Measured on the loaded corpus: 13.1 entities at two hops on
// average, and 151 at the widest.
const HOPS = 2;

/** The relations drawn around one selection. Nothing selected reaches none, and a relation is
 * reached while both of its ends are, as the graph lights an edge. */
export function relationsInReach(
  projection: Projection,
  selected: string | null,
): readonly GeoLink[] {
  if (selected === null) return [];

  const reached = new Set<string>([selected]);
  let frontier: readonly string[] = [selected];
  for (let hop = 0; hop < HOPS; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const link of projection.linksByEntity.get(id) ?? []) {
        for (const end of [link.from.id, link.to.id]) {
          if (reached.has(end)) continue;
          reached.add(end);
          next.push(end);
        }
      }
    }
    frontier = next;
  }

  return projection.links.filter((link) => reached.has(link.from.id) && reached.has(link.to.id));
}
