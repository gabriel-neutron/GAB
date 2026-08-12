/**
 * The macro reads of the graph: the communities, the cut points, the bridges, the isolates.
 *
 * Built from `docs/graph-surface.md` §4.1, §3.4 and §8 step 1. UC1 of §2 says that the analyst
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
 * **It names four reads and nothing else.** §4.1 gives the `Topology` shape below word for word.
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

/**
 * One cut point that severs a piece which is large enough to draw — §3.4.
 *
 * `severs` is the size of the smaller **side** that the removal of this node makes: the largest
 * piece it cuts away, against everything else that stays. That is the rank of §3.4, and it is
 * the reason the list is short.
 */
export interface Bridge {
  readonly node: string;
  readonly severs: number;
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
  /** Every node whose removal breaks its component. §3.4 counted 675 of them at 10k nodes. */
  readonly cutPoints: ReadonlySet<string>;
  /** The cut points above the floor of §3.4, the largest smaller side first. */
  readonly bridges: readonly Bridge[];
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
 * **This number guesses at #61**, which owns it together with the floor below.
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

/**
 * The floor of §3.4, which **scales with the order of the graph**.
 *
 * §3.4 measured 675 cut points at ten thousand nodes and twenty-five thousand relations, and most
 * of them detach one leaf. To paint all of them fills the picture with one colour and reads as
 * noise. Above the floor about 50 remain, and each one is a bridge an analyst wants to be shown.
 *
 * **The shape of this function is chosen here, and it guesses at #61**, which owns the floor that
 * separates a bridge from a cut point. §3.4 gives the rule ("a floor that scales with the order")
 * and one measurement, and no formula. The square root of the order gives 100 at ten thousand
 * nodes, which is the order of magnitude that the measurement asks for. That measurement is the
 * only calibration available: §6 removes the inflater that grew the fixture to 10k/25k, so it
 * cannot be produced a second time.
 *
 * **Zero bridges is a true result on a small corpus.** The fixture of 27 entities gives 5 cut
 * points and no bridge, because a corpus that small severs no piece worth painting. Read the
 * count of cut points beside it — `model.ts` puts both on the legend for that reason.
 *
 * **Degree is the wrong measure**, and §3.4 says so: a node of degree two that holds two halves
 * apart is worth more than a hub that severs one leaf. So the floor is on the severed piece and
 * never on the degree.
 */
const floorOf = (order: number): number => Math.max(2, Math.ceil(Math.sqrt(order)));

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

  // ---------------------------------------------------------------- the cut points ---

  // An iterative Tarjan walk. §4.1: a recursive walk of ten thousand nodes overflows the stack
  // of the language, so this walk holds its own stack in `walkNode` and `walkEdge`.
  const NONE = -1;
  const discovered = new Array<number>(order).fill(NONE);
  const low = new Array<number>(order).fill(0);
  const subtree = new Array<number>(order).fill(1);
  const parent = new Array<number>(order).fill(NONE);
  const rootChildren = new Array<number>(order).fill(0);
  const componentSize = new Array<number>(order).fill(1);
  // For each node, the size of each piece that its removal cuts away from the rest.
  const severed: number[][] = nodes.map(() => []);

  let clock = 0;
  for (let root = 0; root < order; root += 1) {
    if (numberAt(discovered, root) !== NONE) continue;

    const reached: number[] = [root];
    discovered[root] = clock;
    low[root] = clock;
    clock += 1;

    const walkNode: number[] = [root];
    const walkEdge: number[] = [0];
    while (walkNode.length > 0) {
      const node = numberAt(walkNode, walkNode.length - 1);
      const edge = numberAt(walkEdge, walkEdge.length - 1);
      const neighbours = neighboursOf(node);

      if (edge < neighbours.length) {
        walkEdge[walkEdge.length - 1] = edge + 1;
        const neighbour = numberAt(neighbours, edge);
        // Every edge back to the parent is skipped, because the edge the walk arrived on is not
        // a back edge and must not lower `low`. The test is on each neighbour, so a repeated
        // parent is skipped each time. **`Topology` promises no unique neighbour list**, and
        // `topologyOf` above gives a set today: a repeated neighbour that is **not** the parent is
        // walked two times, which costs time and changes no result.
        if (neighbour === numberAt(parent, node)) continue;

        if (numberAt(discovered, neighbour) !== NONE) {
          low[node] = Math.min(numberAt(low, node), numberAt(discovered, neighbour));
          continue;
        }

        parent[neighbour] = node;
        if (node === root) rootChildren[root] = numberAt(rootChildren, root) + 1;
        discovered[neighbour] = clock;
        low[neighbour] = clock;
        clock += 1;
        reached.push(neighbour);
        walkNode.push(neighbour);
        walkEdge.push(0);
        continue;
      }

      walkNode.pop();
      walkEdge.pop();
      const above = numberAt(parent, node);
      if (above === NONE) continue;
      low[above] = Math.min(numberAt(low, above), numberAt(low, node));
      subtree[above] = numberAt(subtree, above) + numberAt(subtree, node);
      // The piece below `node` reaches nothing above `above`, so the removal of `above` cuts it.
      const pieces = severed[above];
      if (pieces !== undefined && numberAt(low, node) >= numberAt(discovered, above)) {
        pieces.push(numberAt(subtree, node));
      }
    }

    for (const node of reached) componentSize[node] = reached.length;
  }

  const cutPoints = new Set<string>();
  const bridges: Bridge[] = [];
  const floor = floorOf(order);
  nodes.forEach((name, node) => {
    const pieces: readonly number[] = severed[node] ?? [];
    const isRoot = numberAt(parent, node) === NONE;
    const isCutPoint = isRoot ? numberAt(rootChildren, node) > 1 : pieces.length > 0;
    if (!isCutPoint) return;

    cutPoints.add(name);

    // §3.4 asks for the size of the smaller **side**. So: the largest piece the removal cuts
    // away, against everything else the removal leaves — the component, less this node and less
    // that piece.
    //
    // **This was the smallest piece, and that was a defect.** The two agree only where a node
    // cuts the graph in exactly two. A hub that cuts one leaf away and four thousand entities
    // away scored 1 and was dropped, and §3.4 names that node as one an analyst wants to be
    // shown. Do not restore the minimum.
    const largest = pieces.reduce((biggest, piece) => Math.max(biggest, piece), 0);
    const severs = Math.min(largest, numberAt(componentSize, node) - 1 - largest);
    if (severs >= floor) bridges.push({ node: name, severs });
  });
  bridges.sort((a, b) => b.severs - a.severs || a.node.localeCompare(b.node));

  return {
    community,
    communityCount: ranked.length,
    communitySizes: ranked.map((group) => group.length),
    cutPoints,
    bridges,
    isolates: nodes.filter((_node, index) => numberAt(degrees, index) === 0),
    largestDegree: degrees.reduce((largest, degree) => Math.max(largest, degree), 0),
  };
}
