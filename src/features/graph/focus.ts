export interface FocusInput {
  readonly centre: string;
  readonly hops: 1 | 2;
  /** The nodes whose neighbours the reader asked for, in the order of the asks. */
  readonly expanded: readonly string[];
  /** The neighbours that may be drawn, in the order they stand. The caller applies its filter. */
  readonly neighbours: (id: string) => readonly string[];
}

export interface FocusLayout {
  /** Where each drawn node stands, in units of the first ring. The centre stands at the origin. */
  readonly offsets: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
  /** How many hops from the centre a node stands. A node that an expand added counts its parent. */
  readonly hopOf: ReadonlyMap<string, number>;
}

// A first ring of many nodes grows, so the names on it keep a gap. Origin: invented; a ring of
// fourteen nodes at the unit radius leaves about 70 px between two names on a 512 px canvas.
const NODES_ON_UNIT_RING = 14;

// The second ring stands this far outside the first one, in units of the first ring.
const SECOND_RING_GAP = 0.85;

// The nodes of one slice of the second ring step in and out by this much, so two names that stand
// next to each other on the same slice do not meet.
const STAGGER = 0.22;

// A slice keeps this part of its angle for its own nodes, and leaves the rest as a gap.
const SLICE_FILL = 0.9;

// An expand puts the new nodes at this distance from their parent, in units of the first ring.
const EXPAND_DISTANCE = 0.9;

// An expand fans the new nodes over this part of a circle, turned away from the centre.
const EXPAND_FAN = 0.9 * Math.PI;

const TOP = -Math.PI / 2;

/**
 * Where a focus draws its nodes: the centre, a ring for the first hop, a ring for the second, and
 * a small fan beside each node that the reader expanded. The result depends on the input alone, so
 * a node stands at one place on each open, and an expand moves no node that is drawn already.
 */
export function layoutFocus(input: FocusInput): FocusLayout {
  const offsets = new Map<string, { x: number; y: number }>([[input.centre, { x: 0, y: 0 }]]);
  const hopOf = new Map<string, number>([[input.centre, 0]]);

  const fresh = (id: string): boolean => !offsets.has(id);

  const first = input.neighbours(input.centre).filter(fresh);
  const radius = Math.max(1, first.length / NODES_ON_UNIT_RING);
  const slice = first.length === 0 ? 0 : (2 * Math.PI) / first.length;

  first.forEach((id, index) => {
    const angle = TOP + index * slice;
    offsets.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    hopOf.set(id, 1);
  });

  if (input.hops === 2) {
    first.forEach((parent, index) => {
      const children = input.neighbours(parent).filter(fresh);
      // The next parent finds these children placed already, so a child has one parent.
      const centreAngle = TOP + index * slice;
      children.forEach((id, position) => {
        const share = (position + 1) / (children.length + 1) - 0.5;
        const angle = centreAngle + share * slice * SLICE_FILL;
        const out = radius + SECOND_RING_GAP + (position % 2) * STAGGER;
        offsets.set(id, { x: out * Math.cos(angle), y: out * Math.sin(angle) });
        hopOf.set(id, 2);
      });
    });
  }

  for (const parent of input.expanded) {
    const from = offsets.get(parent);
    if (from === undefined) continue;
    const children = input.neighbours(parent).filter(fresh);
    const turned = parent === input.centre || (from.x === 0 && from.y === 0);
    const away = turned ? TOP : Math.atan2(from.y, from.x);
    const fan = turned ? 2 * Math.PI : EXPAND_FAN;
    const parentHop = hopOf.get(parent) ?? 0;
    children.forEach((id, position) => {
      const share = turned
        ? position / children.length
        : children.length === 1
          ? 0
          : position / (children.length - 1) - 0.5;
      const angle = away + share * fan;
      offsets.set(id, {
        x: from.x + EXPAND_DISTANCE * Math.cos(angle),
        y: from.y + EXPAND_DISTANCE * Math.sin(angle),
      });
      hopOf.set(id, parentHop + 1);
    });
  }

  return { offsets, hopOf };
}
