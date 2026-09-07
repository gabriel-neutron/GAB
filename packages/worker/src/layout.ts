// The picture: one disc for each community, side by side on a ring, and the entities that carry
// no relation in a band outside it. A hub is pulled towards the centre of the disc it sits in.

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

// The radius of the disc of a community of one member, and the space between two discs on the
// ring so that two communities read as two. Both are chosen: no measurement gives either.
const DISC = 12;
const GAP = 8;

// How far a hub is pulled towards the centre of its disc, as a fraction of the radius. Chosen.
const HUB_PULL = 0.6;

// Six lone isolates once took six of the thirteen angular slots of the picture, set the bounding
// box, and squeezed the four real clusters into a third of the canvas. This band keeps them
// outside the structure and adds about a tenth to the reach of the picture.
const ISOLATE_BAND = 1.12;

// A round that changes no label ends the walk, so this ceiling stops only a walk that never
// settles. No proof bounds that case, and no corpus here reaches twenty rounds.
const MAX_ROUNDS = 20;

const TAU = Math.PI * 2;

// FNV-1a on the identifier, with a salt. `Math.imul` keeps the multiply in 32 bits on every
// engine, and the two shifts spread the low bits of a short identifier over the whole word.
const hashOf = (id: string, salt: number): number => {
  let hash = 0x811c9dc5 ^ salt;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2545f491);
  hash ^= hash >>> 13;
  return hash >>> 0;
};

/** One number in [0, 1) from the identifier and the salt. */
const unitOf = (id: string, salt: number): number => hashOf(id, salt) / 0x1_0000_0000;

interface Topology {
  readonly nodes: readonly string[];
  readonly neighbours: readonly (readonly number[])[];
  readonly degrees: readonly number[];
}

// The walk needs the simple graph and the degree needs the multiplicity. A self-loop adds no
// neighbour and no degree, so an entity with only a self-loop stays an isolate. A link with an
// end that no entity carries is dropped: it joins nothing that is drawn.
function topologyOf(entities: readonly string[], links: Iterable<LayoutLink>): Topology {
  const nodes = [...new Set(entities)];
  const numberOf = new Map(nodes.map((node, index) => [node, index]));
  const neighbours = nodes.map(() => new Set<number>());
  const degrees = nodes.map(() => 0);

  for (const link of links) {
    const source = numberOf.get(link.source);
    const target = numberOf.get(link.target);
    if (source === undefined || target === undefined || source === target) continue;
    neighbours[source]?.add(target);
    neighbours[target]?.add(source);
    degrees[source] = (degrees[source] ?? 0) + 1;
    degrees[target] = (degrees[target] ?? 0) + 1;
  }

  return { nodes, neighbours: neighbours.map((held) => [...held]), degrees };
}

const numberAt = (values: readonly number[], index: number): number => values[index] ?? 0;

function bestLabel(labels: readonly number[], neighbours: readonly number[], own: number): number {
  if (neighbours.length === 0) return own;

  const counts = new Map<number, number>();
  for (const neighbour of neighbours) {
    const label = numberAt(labels, neighbour);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let best = own;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount || (count === bestCount && label < best)) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

// The community of each node, numbered by size, largest first. A tie between two communities of
// one size goes to the one that holds the earlier node, so one corpus gives one numbering.
function communitiesOf(topology: Topology): readonly number[] {
  const order = topology.nodes.length;
  const labels = topology.nodes.map((_node, index) => index);

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let changed = false;
    for (let node = 0; node < order; node += 1) {
      const next = bestLabel(labels, topology.neighbours[node] ?? [], numberAt(labels, node));
      if (next !== numberAt(labels, node)) {
        labels[node] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const members = new Map<number, number[]>();
  labels.forEach((label, node) => {
    const held = members.get(label);
    if (held === undefined) members.set(label, [node]);
    else held.push(node);
  });

  const ranked = [...members.values()].sort(
    (one, two) => two.length - one.length || numberAt(one, 0) - numberAt(two, 0),
  );
  const rankOf = labels.map(() => 0);
  ranked.forEach((group, rank) => {
    for (const node of group) rankOf[node] = rank;
  });
  return rankOf;
}

/** Where each entity is drawn, from the entities and the relations between them. */
export function entityLayout(
  entities: readonly string[],
  links: Iterable<LayoutLink>,
): readonly LayoutPosition[] {
  const topology = topologyOf(entities, links);
  const community = communitiesOf(topology);

  // The ring carries the communities that hold the structure and never a lone isolate. An isolate
  // is a community of its own, and on the ring it would take one whole angular slot and stand as
  // far out as a cluster of five hundred.
  const members = new Map<number, number>();
  topology.nodes.forEach((_node, index) => {
    if (numberAt(topology.degrees, index) === 0) return;
    const rank = numberAt(community, index);
    members.set(rank, (members.get(rank) ?? 0) + 1);
  });
  const ring = [...members.keys()].sort((one, two) => one - two);

  // A community of `size` members covers an area that grows with `size`, so the radius of its
  // disc grows with the square root and the density inside stays even.
  const radii = new Map<number, number>();
  for (const rank of ring) radii.set(rank, DISC * Math.sqrt(Math.max(members.get(rank) ?? 1, 1)));

  // Each community takes angular space in proportion to its disc and never an equal share. With
  // an equal share the large disc overlaps its neighbours while a community of one sits alone in
  // an empty field. The ring is then wide enough to carry every disc side by side.
  const arcs = ring.map((rank) => 2 * (radii.get(rank) ?? DISC) + GAP);
  const span = arcs.reduce((total, arc) => total + arc, 0);
  const radius = ring.length > 1 ? span / TAU : 0;

  const centres = new Map<number, { readonly x: number; readonly y: number }>();
  let walked = 0;
  ring.forEach((rank, index) => {
    const arc = arcs[index] ?? 0;
    const angle = span === 0 ? 0 : (TAU * (walked + arc / 2)) / span;
    walked += arc;
    centres.set(rank, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  });

  // The largest degree inside each community. A degree reads against the neighbours the members
  // of one cluster have, and never against the largest hub of the whole corpus.
  const largest = new Map<number, number>();
  topology.nodes.forEach((_node, index) => {
    const rank = numberAt(community, index);
    largest.set(rank, Math.max(largest.get(rank) ?? 0, numberAt(topology.degrees, index)));
  });

  const isolates = topology.nodes.filter((_node, index) => numberAt(topology.degrees, index) === 0);
  const slotOf = new Map(isolates.map((node, slot) => [node, slot]));

  // The reach of the structure is the outer edge of the disc that stands furthest out. The band
  // must also be long enough to carry each isolate side by side, and a corpus of isolates alone
  // has no structure to stand outside, so the band is then the whole picture.
  const reach = ring.reduce(
    (furthest, rank) => Math.max(furthest, radius + (radii.get(rank) ?? 0)),
    0,
  );
  const band = Math.max(reach * ISOLATE_BAND, (isolates.length * GAP) / TAU, DISC);

  const placed: LayoutPosition[] = [];
  topology.nodes.forEach((node, index) => {
    if (numberAt(topology.degrees, index) === 0) {
      const angle = (TAU * (slotOf.get(node) ?? 0)) / Math.max(isolates.length, 1);
      placed.push({ id: node, x: band * Math.cos(angle), y: band * Math.sin(angle) });
      return;
    }

    const rank = numberAt(community, index);
    const disc = radii.get(rank) ?? DISC;
    const centre = centres.get(rank) ?? { x: 0, y: 0 };

    // `sqrt` of a uniform number spreads the members evenly over the area of the disc. Without
    // it every member crowds the centre and the disc reads as one dot.
    const spread = Math.sqrt(unitOf(node, 1));
    const angle = TAU * unitOf(node, 2);
    const top = largest.get(rank) ?? 0;
    const pull = top > 0 ? numberAt(topology.degrees, index) / top : 0;
    const distance = disc * spread * (1 - HUB_PULL * pull);

    placed.push({
      id: node,
      x: centre.x + distance * Math.cos(angle),
      y: centre.y + distance * Math.sin(angle),
    });
  });

  return placed;
}
