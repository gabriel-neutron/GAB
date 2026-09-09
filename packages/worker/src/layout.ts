/** One relation, as the layout reads it: two entities, and nothing else. */
export interface LayoutLink {
  readonly source: string;
  readonly target: string;
}

/** Where one entity is drawn. The units are the units of the picture and never pixels. */
export interface LayoutPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

// The distance the relaxation holds between two entities that share a relation, and the space
// between two components so that two read as two. Both are chosen: no measurement gives either.
const SPACING = 24;
const GAP = 16;

// The relaxation stops where the temperature falls to zero, so this count is the whole walk and
// not a ceiling on it. Chosen: no measurement gives it.
const ROUNDS = 160;

// Two entities can land on one point, and a direction is then a divide by zero. This floor keeps
// the direction finite and moves the two apart on the round after it.
const FLOOR = 0.01;

// A group of entities wider than this share of its distance is read member by member, and a
// narrower one pushes as one mass at its centre. It is the opening angle of a Barnes-Hut walk, and
// it stays under the root of a half, above which a square can stand for an entity inside it.
const THETA = 0.7;

// Two entities can hold one point, and no split parts them. The depth stops the split, and the
// entities that share the deepest square push each other one by one.
const DEPTH = 20;

const TAU = Math.PI * 2;

// The golden angle: one whole turn divided by the square of the golden ratio. It spreads the
// seeds of a spiral evenly, so no two seeds of one component start on one line out of the centre.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface Point {
  readonly x: number;
  readonly y: number;
}

const ORIGIN: Point = { x: 0, y: 0 };

interface Topology {
  readonly nodes: readonly string[];
  readonly neighbours: readonly (readonly number[])[];
}

// A self-loop joins one entity to itself, so it adds no neighbour and that entity stands alone. A
// link with an end that no entity carries is dropped: it joins nothing that is drawn.
function topologyOf(entities: readonly string[], links: Iterable<LayoutLink>): Topology {
  const nodes = [...new Set(entities)];
  const numberOf = new Map(nodes.map((node, index) => [node, index]));
  const neighbours = nodes.map(() => new Set<number>());

  for (const link of links) {
    const source = numberOf.get(link.source);
    const target = numberOf.get(link.target);
    if (source === undefined || target === undefined || source === target) continue;
    neighbours[source]?.add(target);
    neighbours[target]?.add(source);
  }

  return { nodes, neighbours: neighbours.map((held) => [...held]) };
}

const numberAt = (values: readonly number[], index: number): number => values[index] ?? 0;

const neighboursAt = (topology: Topology, node: number): readonly number[] =>
  topology.neighbours[node] ?? [];

// The members of each connected component, largest first. A component is a measured fact of the
// corpus. A tie between two of one size goes to the one that holds the earlier node.
function componentsOf(topology: Topology): readonly (readonly number[])[] {
  const seen = topology.nodes.map(() => false);
  const groups: number[][] = [];

  topology.nodes.forEach((_node, start) => {
    if (seen[start] === true) return;
    seen[start] = true;
    const group = [start];
    for (let head = 0; head < group.length; head += 1) {
      for (const neighbour of neighboursAt(topology, numberAt(group, head))) {
        if (seen[neighbour] === true) continue;
        seen[neighbour] = true;
        group.push(neighbour);
      }
    }
    groups.push(group);
  });

  return groups.sort((one, two) => two.length - one.length || numberAt(one, 0) - numberAt(two, 0));
}

interface Relaxation {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly radius: number;
}

function edgesOf(members: readonly number[], topology: Topology): readonly (readonly number[])[] {
  const localOf = new Map(members.map((node, index) => [node, index]));
  const edges: number[][] = [];
  members.forEach((node, index) => {
    for (const neighbour of neighboursAt(topology, node)) {
      const other = localOf.get(neighbour);
      if (other !== undefined && other > index) edges.push([index, other]);
    }
  });
  return edges;
}

// One square of the tree. It holds the entities under it as a count and a sum, so the walk reads
// their centre without reading them.
interface Square {
  readonly half: number;
  readonly midX: number;
  readonly midY: number;
  mass: number;
  sumX: number;
  sumY: number;
  bodies: number[];
  quarters: Square[] | null;
}

const squareOf = (midX: number, midY: number, half: number): Square => ({
  half,
  midX,
  midY,
  mass: 0,
  sumX: 0,
  sumY: 0,
  bodies: [],
  quarters: null,
});

function addTo(
  square: Square,
  index: number,
  xs: readonly number[],
  ys: readonly number[],
  depth: number,
): void {
  square.mass += 1;
  square.sumX += numberAt(xs, index);
  square.sumY += numberAt(ys, index);

  if (square.quarters === null) {
    if (square.bodies.length === 0 || depth === DEPTH) {
      square.bodies.push(index);
      return;
    }
    const held = square.bodies;
    const quarter = square.half / 2;
    square.bodies = [];
    square.quarters = [
      squareOf(square.midX - quarter, square.midY - quarter, quarter),
      squareOf(square.midX + quarter, square.midY - quarter, quarter),
      squareOf(square.midX - quarter, square.midY + quarter, quarter),
      squareOf(square.midX + quarter, square.midY + quarter, quarter),
    ];
    for (const body of held) intoQuarter(square, body, xs, ys, depth);
  }

  intoQuarter(square, index, xs, ys, depth);
}

function intoQuarter(
  square: Square,
  index: number,
  xs: readonly number[],
  ys: readonly number[],
  depth: number,
): void {
  const east = numberAt(xs, index) >= square.midX ? 1 : 0;
  const north = numberAt(ys, index) >= square.midY ? 2 : 0;
  const quarter = square.quarters?.[east + north];
  if (quarter !== undefined) addTo(quarter, index, xs, ys, depth + 1);
}

function treeOf(count: number, xs: readonly number[], ys: readonly number[]): Square {
  let leastX = Infinity;
  let mostX = -Infinity;
  let leastY = Infinity;
  let mostY = -Infinity;
  for (let index = 0; index < count; index += 1) {
    leastX = Math.min(leastX, numberAt(xs, index));
    mostX = Math.max(mostX, numberAt(xs, index));
    leastY = Math.min(leastY, numberAt(ys, index));
    mostY = Math.max(mostY, numberAt(ys, index));
  }
  const root = squareOf(
    (leastX + mostX) / 2,
    (leastY + mostY) / 2,
    Math.max(mostX - leastX, mostY - leastY) / 2 + FLOOR,
  );
  for (let index = 0; index < count; index += 1) addTo(root, index, xs, ys, 0);
  return root;
}

// The push on one entity, from the whole tree. A square that is narrow against its distance stands
// for its members. Such a square holds the entity itself only where every member is inside the
// floor of it, and the push of the mass is then the push of the members, term for term.
function repelFrom(
  square: Square,
  one: number,
  xs: readonly number[],
  ys: readonly number[],
  push: { x: number; y: number },
): void {
  if (square.mass === 0) return;

  if (square.quarters === null) {
    for (const two of square.bodies) {
      if (two === one) continue;
      const dx = numberAt(xs, one) - numberAt(xs, two);
      const dy = numberAt(ys, one) - numberAt(ys, two);
      const span = Math.max(Math.hypot(dx, dy), FLOOR);
      const scale = (SPACING * SPACING) / (span * span);
      push.x += dx * scale;
      push.y += dy * scale;
    }
    return;
  }

  const dx = numberAt(xs, one) - square.sumX / square.mass;
  const dy = numberAt(ys, one) - square.sumY / square.mass;
  const span = Math.max(Math.hypot(dx, dy), FLOOR);
  if (square.half * 2 < THETA * span) {
    const scale = (SPACING * SPACING * square.mass) / (span * span);
    push.x += dx * scale;
    push.y += dy * scale;
    return;
  }

  for (const quarter of square.quarters) repelFrom(quarter, one, xs, ys, push);
}

// A pair pushes apart with the square of the spacing over the distance, a relation pulls with the
// distance over the spacing, and a falling temperature caps each step. The seed is a spiral, so
// one corpus gives one picture and a related pair settles near.
function relaxationOf(members: readonly number[], topology: Topology): Relaxation {
  const count = members.length;
  const extent = SPACING * Math.sqrt(count);
  const seeds = members.map((_node, index) => ({
    reach: extent * Math.sqrt(index / count),
    angle: index * GOLDEN_ANGLE,
  }));
  const xs = seeds.map((seed) => seed.reach * Math.cos(seed.angle));
  const ys = seeds.map((seed) => seed.reach * Math.sin(seed.angle));
  const edges = edgesOf(members, topology);
  const pushX = xs.map(() => 0);
  const pushY = xs.map(() => 0);

  for (let round = 0; round < ROUNDS; round += 1) {
    const heat = extent * (1 - round / ROUNDS);

    const tree = treeOf(count, xs, ys);
    for (let one = 0; one < count; one += 1) {
      const push = { x: 0, y: 0 };
      repelFrom(tree, one, xs, ys, push);
      pushX[one] = push.x;
      pushY[one] = push.y;
    }

    for (const edge of edges) {
      const one = numberAt(edge, 0);
      const two = numberAt(edge, 1);
      const dx = numberAt(xs, one) - numberAt(xs, two);
      const dy = numberAt(ys, one) - numberAt(ys, two);
      const scale = Math.max(Math.hypot(dx, dy), FLOOR) / SPACING;
      pushX[one] = numberAt(pushX, one) - dx * scale;
      pushY[one] = numberAt(pushY, one) - dy * scale;
      pushX[two] = numberAt(pushX, two) + dx * scale;
      pushY[two] = numberAt(pushY, two) + dy * scale;
    }

    for (let index = 0; index < count; index += 1) {
      const dx = numberAt(pushX, index);
      const dy = numberAt(pushY, index);
      const span = Math.max(Math.hypot(dx, dy), FLOOR);
      const step = Math.min(span, heat) / span;
      xs[index] = numberAt(xs, index) + dx * step;
      ys[index] = numberAt(ys, index) + dy * step;
    }
  }

  const middleX = xs.reduce((total, value) => total + value, 0) / Math.max(count, 1);
  const middleY = ys.reduce((total, value) => total + value, 0) / Math.max(count, 1);
  const centred = { xs: xs.map((x) => x - middleX), ys: ys.map((y) => y - middleY) };
  const radius = centred.xs.reduce(
    (far, x, index) => Math.max(far, Math.hypot(x, numberAt(centred.ys, index))),
    0,
  );

  return { xs: centred.xs, ys: centred.ys, radius: radius + SPACING / 2 };
}

const isFree = (
  spot: Point,
  radius: number,
  centres: readonly Point[],
  radii: readonly number[],
): boolean =>
  centres.every(
    (centre, index) =>
      Math.hypot(spot.x - centre.x, spot.y - centre.y) >= radius + numberAt(radii, index) + GAP,
  );

interface Spot {
  readonly point: Point;
  readonly ring: number;
  readonly slot: number;
}

const FIRST: Spot = { point: ORIGIN, ring: 1, slot: 0 };

// The first free spot on a spiral out of the centre. The step is the reach of the component that
// is placed, so a spot that touches the ones already placed is read before a spot further out.
function freeSpot(
  radius: number,
  centres: readonly Point[],
  radii: readonly number[],
  from: Spot,
): Spot {
  const step = radius + GAP;
  const bound = centres.reduce(
    (far, centre, index) =>
      Math.max(far, Math.hypot(centre.x, centre.y) + numberAt(radii, index) + GAP),
    0,
  );
  const rings = Math.ceil((bound + radius) / step) + 1;

  for (let ring = from.ring; ring <= rings; ring += 1) {
    const reach = ring * step;
    const slots = Math.max(Math.ceil((TAU * reach) / step), 1);
    for (let slot = ring === from.ring ? from.slot : 0; slot < slots; slot += 1) {
      const angle = (TAU * slot) / slots + ring * GOLDEN_ANGLE;
      const spot = { x: reach * Math.cos(angle), y: reach * Math.sin(angle) };
      if (isFree(spot, radius, centres, radii)) return { point: spot, ring, slot: slot + 1 };
    }
  }

  return { point: { x: bound + radius, y: 0 }, ring: rings, slot: 0 };
}

// The largest component takes the middle and each other one packs around it, so the picture fills
// a disc. Side by side on one ring, the radius grew with the count and every component collapsed
// into one thin band.
function packedCentres(radii: readonly number[]): readonly Point[] {
  const centres: Point[] = [];
  let scan = FIRST;
  let scanned = Number.NaN;

  for (const radius of radii) {
    if (centres.length === 0) {
      centres.push(ORIGIN);
      continue;
    }
    // Every slot the scan passed is blocked, and a placed component never moves, so a scan from
    // the centre would read the same spot. A new reach reads a new ring, so it starts again.
    if (radius !== scanned) {
      scan = FIRST;
      scanned = radius;
    }
    scan = freeSpot(radius, centres, radii, scan);
    centres.push(scan.point);
  }

  return centres;
}

/** Where each entity is drawn, from the entities and the relations between them. */
export function entityLayout(
  entities: readonly string[],
  links: Iterable<LayoutLink>,
): readonly LayoutPosition[] {
  const topology = topologyOf(entities, links);
  const groups = componentsOf(topology);
  const relaxations = groups.map((group) => relaxationOf(group, topology));
  const centres = packedCentres(relaxations.map((relaxation) => relaxation.radius));

  const placed: LayoutPosition[] = [];
  groups.forEach((group, rank) => {
    const relaxation = relaxations[rank];
    const centre = centres[rank] ?? ORIGIN;
    if (relaxation === undefined) return;
    group.forEach((node, index) => {
      const name = topology.nodes[node];
      if (name === undefined) return;
      placed.push({
        id: name,
        x: centre.x + numberAt(relaxation.xs, index),
        y: centre.y + numberAt(relaxation.ys, index),
      });
    });
  });

  return placed;
}
