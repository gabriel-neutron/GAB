/**
 * The macro reads of the graph: the communities, the isolates, and the largest degree.
 *
 * **The bridge and cut-point analysis is gone** — #82 row A3, Never asked for it, and **#61 is
 * closed with it**. The operator reports that the simple rules of colour and size are enough, and
 * that a red dot for a cut point teaches them nothing. The Tarjan walk, `Bridge`, `cutPoints`,
 * `bridges` and the floor that separated the two left this file, and the `--dissent` hue left
 * `model.ts`. #61 asked where that floor sits, and the question dies with the analysis.
 *
 * **What is left is the community run, and it is kept under a condition.** #82 row A2: the
 * operator keeps the colouring only until it is proved on a real corpus, and **#87
 * GRAPH-COLOUR-RULE** holds that proof. **If #87 drops the colouring, this whole file goes with
 * it**, because `communitySizes` and `community` are then read by nobody.
 *
 * Built from `docs/graph-surface.md` §4.1 and §8 step 1. UC1 of §2 says that the analyst
 * reads the macro structure with no label read, so this file gives the numbers that the paint
 * of §4.2 uses.
 *
 * **It holds no state, it reads no module and it imports no library.** It takes the topology as
 * an argument, so the day `src/contract/` exists the caller changes and this file does not.
 *
 * **Two runtime symbols live here, and they are one job.** `analyseStructure` reads a topology,
 * and `topologyOf` builds one from a node set and its relations. `Topology` is declared here, so
 * the file that owns the shape owns the one way to build it. `model.ts` and `layout.ts` each held
 * a copy of that block, over two different node sets, and two copies of an adjacency and a degree
 * can disagree with nobody to see it.
 *
 * **It names its reads and nothing else.** §4.1 gives the `Topology` shape below word for word.
 * The file therefore never touches the generic parameters of graphology, and it never depends on
 * the attribute shape of the graph.
 *
 * **It carries its own stack.** §4.1: a recursive depth-first walk of ten thousand nodes
 * overflows the stack of the language. The walk below holds its own stack in two arrays.
 *
 * **It is deterministic.** §4.1: the label propagation walks the nodes in insertion order and
 * breaks a tie on the lowest label, so the same corpus gives the same communities on every open.
 * That determinism is the contrast with the force layout of §3.2, and it is kept.
 */

/**
 * The four reads of `docs/graph-surface.md` §4.1, quoted word for word. Nothing else is read.
 *
 * **`forEachNeighbor` is never called by this file.** The walk below needs the whole neighbour
 * list at one time, and `neighbors` gives it. The member stays because §4.1 states this shape,
 * and a shape that is quoted is not edited here.
 */
export interface Topology {
  forEachNode(cb: (node: string) => void): void;
  /**
   * Declared by §4.1, implemented by `topologyOf` below, which is the one implementation, and
   * called by nothing here. **The member stays because §4.1 quotes this shape word for word**,
   * and a shape that is quoted is not edited here.
   */
  forEachNeighbor(node: string, cb: (neighbour: string) => void): void;
  neighbors(node: string): string[];
  degree(node: string): number;
}

/**
 * One relation, as a topology reads it: two endpoints, and nothing else.
 *
 * The caller decides which relation reaches this shape. An M4 relation names a relation at one
 * end, so it has no node there (§4.2 and ADR 0004 §4), and no caller gives it to `topologyOf`.
 */
export interface TopologyLink {
  readonly source: string;
  readonly target: string;
}

/**
 * The topology of one node set and the relations that join it.
 *
 * **`model.ts` and `layout.ts` built this block two times, over two node sets, and the two could
 * disagree in silence.** One of them counted a degree that the other did not, and the picture
 * then paints a structure that the placement does not hold. The node set stays the argument,
 * because the two callers genuinely differ: `model.ts` walks the entities it draws, and
 * `layout.ts` walks every entity of the read.
 *
 * **The links are the argument too, and each caller drops the same rows before it calls.** A row
 * that one caller drops and the other keeps is exactly the silent disagreement above: `layout.ts`
 * states the repeated relation identifier, which is the one row where the two could differ.
 *
 * **The walk needs the simple graph and the degree needs the multiplicity, so the two differ, and
 * they differ here only.** A self-loop adds no neighbour, so it adds nothing to the degree
 * either: a node with one self-loop and no other relation is an isolate, and it must not read as
 * a node of degree two that the walk cannot reach. A parallel relation adds one to the degree at
 * each end, and one neighbour.
 *
 * A link whose endpoint is outside `nodes` joins nothing, and it is dropped.
 */
export function topologyOf(nodes: Iterable<string>, links: Iterable<TopologyLink>): Topology {
  const adjacency = new Map<string, Set<string>>();
  const degrees = new Map<string, number>();
  for (const id of nodes) {
    adjacency.set(id, new Set<string>());
    degrees.set(id, 0);
  }

  for (const link of links) {
    if (link.source === link.target) continue;
    const source = adjacency.get(link.source);
    const target = adjacency.get(link.target);
    if (source === undefined || target === undefined) continue;
    source.add(link.target);
    target.add(link.source);
    degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1);
    degrees.set(link.target, (degrees.get(link.target) ?? 0) + 1);
  }

  return {
    forEachNode: (cb) => {
      for (const id of adjacency.keys()) cb(id);
    },
    forEachNeighbor: (node, cb) => {
      for (const neighbour of adjacency.get(node) ?? []) cb(neighbour);
    },
    neighbors: (node) => [...(adjacency.get(node) ?? [])],
    degree: (node) => degrees.get(node) ?? 0,
  };
}

export interface Structure {
  /** The community of each node. Index 0 is the largest community. */
  readonly community: ReadonlyMap<string, number>;
  readonly communityCount: number;
  /**
   * The size of each community, largest first. The index is the community number.
   *
   * `layout.ts` reads it to give each community a disc whose radius grows with the square root
   * of its member count, so the density of the picture stays even. It is not dead.
   */
  readonly communitySizes: readonly number[];
  /** Every node with no relation at all. */
  readonly isolates: readonly string[];
  /**
   * The largest degree in the graph.
   *
   * `model.ts` reads it to scale the size of a node: the range of the degree grows with the
   * corpus, so a fixed multiplier gives one size to every node at ten thousand entities. §4.4
   * puts the list of the rail in the order of the degree for the same reason — the useful head
   * of a list on a graph is the hubs.
   */
  readonly largestDegree: number;
}

/**
 * How many rounds the label propagation runs before it stops.
 *
 * A round that changes no label ends the walk, so this ceiling only holds a corpus whose labels
 * oscillate between two rounds and never settle. **The number is chosen here**: no document
 * gives one, label propagation settles in far fewer rounds on a corpus that is not adversarial,
 * and twenty rounds of ten thousand nodes cost a small part of the 51 ms of §4.1.
 *
 * **#61 owned this number, and #82 A3 closed it.** The bridge analysis is gone, so nothing is
 * left to calibrate here but this ceiling, and no ticket holds it.
 */
const MAX_ROUNDS = 20;

/**
 * Reads one number of an array by its index. **It is not `Array.at`**: it takes no negative
 * index, and it answers 0 where the array holds nothing at that place.
 *
 * The fallback is never used: every index below comes from the loop that filled the array.
 * `noUncheckedIndexedAccess` is on, and this keeps the intent of each read on one line.
 */
const numberAt = (values: readonly number[], index: number): number => values[index] ?? 0;

/** The most frequent label among the neighbours. A tie goes to the lowest label — §4.1. */
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

export function analyseStructure(graph: Topology): Structure {
  // The nodes in insertion order. Every array below is indexed by this order, so the whole file
  // is deterministic for one corpus.
  const nodes: string[] = [];
  graph.forEachNode((node) => nodes.push(node));
  const order = nodes.length;

  const numberOf = new Map<string, number>();
  nodes.forEach((node, index) => numberOf.set(node, index));

  const adjacency: number[][] = nodes.map((node) => {
    const list: number[] = [];
    for (const neighbour of graph.neighbors(node)) {
      const index = numberOf.get(neighbour);
      if (index !== undefined) list.push(index);
    }
    return list;
  });
  const neighboursOf = (index: number): readonly number[] => adjacency[index] ?? [];

  const degrees = nodes.map((node) => graph.degree(node));

  // ---------------------------------------------------------------- the communities ---

  const labels = nodes.map((_node, index) => index);
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let changed = false;
    for (let node = 0; node < order; node += 1) {
      const next = bestLabel(labels, neighboursOf(node), numberAt(labels, node));
      if (next !== numberAt(labels, node)) {
        labels[node] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Renumber, so that index 0 is the largest community. A tie between two communities of one
  // size goes to the one that holds the earlier node, which keeps the numbering deterministic.
  const members = new Map<number, number[]>();
  labels.forEach((label, node) => {
    const held = members.get(label);
    if (held === undefined) members.set(label, [node]);
    else held.push(node);
  });

  const ranked = [...members.values()].sort(
    (a, b) => b.length - a.length || numberAt(a, 0) - numberAt(b, 0),
  );
  const community = new Map<string, number>();
  ranked.forEach((group, rank) => {
    for (const node of group) {
      const name = nodes[node];
      if (name !== undefined) community.set(name, rank);
    }
  });

  return {
    community,
    communityCount: ranked.length,
    communitySizes: ranked.map((group) => group.length),
    isolates: nodes.filter((_node, index) => numberAt(degrees, index) === 0),
    largestDegree: degrees.reduce((largest, degree) => Math.max(largest, degree), 0),
  };
}
