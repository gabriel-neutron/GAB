// The two functions place the labels of a focus: one for the names of nodes, one for relations.

/**
 * Moves each name down until it stands one gap under the name above it. The names of one side of
 * the picture are the input, and the nearer ones would print over each other.
 */
export function spreadDown(
  items: readonly { readonly id: string; readonly y: number }[],
  gap: number,
): ReadonlyMap<string, number> {
  const placed = new Map<string, number>();
  let floor = Number.NEGATIVE_INFINITY;
  for (const item of [...items].sort((one, two) => one.y - two.y)) {
    const y = Math.max(item.y, floor);
    placed.set(item.id, y);
    floor = y + gap;
  }
  return placed;
}

/** The space between two parallel relations, in pixels. */
const PARALLEL_GAP = 13;

/** The word stands this far above its line, so a node that the line meets stays in view. */
const LIFT = 8;

export interface EdgeLabelPlace {
  readonly x: number;
  readonly y: number;
  /** In radians, within a quarter turn of level: a word is never drawn upside down. */
  readonly angle: number;
}

/**
 * Where the type of a relation stands: beside the middle of the line, turned along it. Lines that
 * leave one node part from each other as they go, so words along them do not meet. A relation
 * that has a parallel one moves aside, across the line, by its index.
 */
export function edgeLabelPlace(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  index: number,
  count: number,
): EdgeLabelPlace {
  const raw = Math.atan2(to.y - from.y, to.x - from.x);
  const angle = raw > Math.PI / 2 ? raw - Math.PI : raw < -Math.PI / 2 ? raw + Math.PI : raw;
  // The normal of the upright direction points down the page, so the word goes against it.
  const aside = (index - (count - 1) / 2) * PARALLEL_GAP - LIFT;

  return {
    x: (from.x + to.x) / 2 - Math.sin(angle) * aside,
    y: (from.y + to.y) / 2 + Math.cos(angle) * aside,
    angle,
  };
}
