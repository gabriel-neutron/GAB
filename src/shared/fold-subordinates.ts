import type { Relation } from '@/shared/read/model';

/** One line of a folder list: how deep it stands, and whether it opens. */
export interface NestedRow {
  readonly id: string;
  readonly depth: number;
  readonly subordinates: number;
  readonly open: boolean;
}

export interface UnitHierarchy {
  readonly subordinatesOf: (unit: string) => readonly string[];
  readonly foldedUnder: (open: ReadonlySet<string>) => ReadonlySet<string>;
  /** Departure: it answers the same set where the entity is not folded, so a caller can compare. */
  readonly revealing: (open: ReadonlySet<string>, entity: string) => ReadonlySet<string>;
  /** Departure: each open unit that the close folds closes as well. */
  readonly closing: (open: ReadonlySet<string>, unit: string) => ReadonlySet<string>;
  // Departure: the members keep the order of the caller at each level, and a folded member gets
  // no line. The fold shapes the list alone, and the canvas draws each member.
  readonly nested: (members: readonly string[], open: ReadonlySet<string>) => readonly NestedRow[];
  // Departure: a name search reads every member, folded or not, on one level. A choice then
  // reveals the member, so the search reaches what no open folder shows yet.
  readonly listed: (members: readonly string[], open: ReadonlySet<string>) => readonly NestedRow[];
}

const SUBORDINATE_TO = 'subordinate_to';

const NONE: readonly string[] = [];

function hold(index: Map<string, Set<string>>, key: string, value: string): void {
  const held = index.get(key);
  if (held === undefined) index.set(key, new Set([value]));
  else held.add(value);
}

const inOrder = (ids: Iterable<string>): string[] =>
  [...ids].sort((one, two) => one.localeCompare(two));

// External constraint: `src_id` is the subordinate and `dst_id` is its parent. The relation type
// alone makes the hierarchy and no entity type does, so a subordinate that is not a unit folds too.
export function unitHierarchy(
  relations: readonly Relation[],
  drawn: ReadonlySet<string>,
): UnitHierarchy {
  const below = new Map<string, Set<string>>();
  const above = new Map<string, Set<string>>();
  for (const relation of relations) {
    if (relation.type !== SUBORDINATE_TO) continue;
    if (relation.srcKind !== 'entity' || relation.dstKind !== 'entity') continue;
    const { srcId: child, dstId: parent } = relation;
    if (child === parent || !drawn.has(child) || !drawn.has(parent)) continue;
    hold(below, parent, child);
    hold(above, child, parent);
  }

  const subordinates = new Map<string, readonly string[]>();
  for (const [parent, children] of below) subordinates.set(parent, inOrder(children));
  const subordinatesOf = (unit: string): readonly string[] => subordinates.get(unit) ?? NONE;

  const walk = (
    seeds: readonly string[],
    opens: (unit: string) => boolean,
    into: Set<string>,
  ): void => {
    let frontier = seeds;
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const unit of frontier) {
        if (!opens(unit)) continue;
        for (const child of subordinatesOf(unit)) {
          if (into.has(child)) continue;
          into.add(child);
          next.push(child);
        }
      }
      frontier = next;
    }
  };

  // External constraint: bad source data can hold a ring of `subordinate_to`, and a ring has no
  // top. Its first member in the order of identifiers stands as a top, or the ring stays folded.
  const tops = [...below.keys()].filter((unit) => !above.has(unit));
  const reachable = new Set(tops);
  walk(tops, () => true, reachable);
  for (const child of inOrder(above.keys())) {
    if (reachable.has(child)) continue;
    tops.push(child);
    reachable.add(child);
    walk([child], () => true, reachable);
  }

  const foldedUnder = (open: ReadonlySet<string>): ReadonlySet<string> => {
    const shown = new Set(tops);
    walk(tops, (unit) => open.has(unit), shown);
    const folded = new Set<string>();
    for (const child of above.keys()) if (!shown.has(child)) folded.add(child);
    return folded;
  };

  const revealing = (open: ReadonlySet<string>, entity: string): ReadonlySet<string> => {
    const folded = foldedUnder(open);
    if (!folded.has(entity)) return open;
    // Departure: the climb goes one hop at a time, so it opens the shortest path to a unit that is
    // not folded, and no other. Each unit on it opens one level, so its other subordinates appear
    // as well.
    const stepDown = new Map<string, string>();
    let frontier = [entity];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const node of frontier) {
        for (const parent of inOrder(above.get(node) ?? [])) {
          if (parent === entity || stepDown.has(parent)) continue;
          stepDown.set(parent, node);
          if (!folded.has(parent)) {
            const opened = new Set(open);
            let unit: string | undefined = parent;
            while (unit !== undefined && unit !== entity) {
              opened.add(unit);
              unit = stepDown.get(unit);
            }
            return opened;
          }
          next.push(parent);
        }
      }
      frontier = next;
    }
    return open;
  };

  const closing = (open: ReadonlySet<string>, unit: string): ReadonlySet<string> => {
    if (!open.has(unit)) return open;
    const rest = new Set(open);
    rest.delete(unit);
    // Departure: a unit that the close folds keeps no open state, so the next open shows one level.
    const folded = foldedUnder(rest);
    for (const held of rest) if (folded.has(held)) rest.delete(held);
    return rest;
  };

  const rowOf = (open: ReadonlySet<string>, id: string, depth: number): NestedRow => ({
    id,
    depth,
    subordinates: subordinatesOf(id).length,
    open: open.has(id),
  });

  const nested = (members: readonly string[], open: ReadonlySet<string>): readonly NestedRow[] => {
    const folded = foldedUnder(open);
    const shown = members.filter((id) => !folded.has(id));
    const shownSet = new Set(shown);
    const rank = new Map(members.map((id, at) => [id, at]));
    const rows: NestedRow[] = [];
    const placed = new Set<string>();

    const place = (id: string, depth: number): void => {
      placed.add(id);
      rows.push(rowOf(open, id, depth));
      if (!open.has(id)) return;
      const children = subordinatesOf(id)
        .filter((child) => shownSet.has(child))
        .sort((one, two) => (rank.get(one) ?? 0) - (rank.get(two) ?? 0));
      for (const child of children) if (!placed.has(child)) place(child, depth + 1);
    };

    // Departure: a member of two open parents stands under the first one placed, and only there.
    // A member whose open parent is of another type stands at the top of this list.
    const underOpenParent = (id: string): boolean =>
      [...(above.get(id) ?? [])].some((parent) => open.has(parent) && shownSet.has(parent));
    for (const id of shown) if (!placed.has(id) && !underOpenParent(id)) place(id, 0);
    for (const id of shown) if (!placed.has(id)) place(id, 0);
    return rows;
  };

  const listed = (members: readonly string[], open: ReadonlySet<string>): readonly NestedRow[] =>
    members.map((id) => rowOf(open, id, 0));

  return { subordinatesOf, foldedUnder, revealing, closing, nested, listed };
}
