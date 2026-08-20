/**
 * The macro reads of the graph: the communities, the isolates, and the largest degree.
 *
 * **The bridge and cut-point analysis is gone.** Nobody asked for it, and the question of where
 * its floor sits is closed with it. The operator reports that the simple rules of colour and size
 * are enough, and that a red dot for a cut point teaches them nothing. The Tarjan walk, `Bridge`,
 * `cutPoints`, `bridges` and the floor that separated the two left this file, and the `--dissent`
 * hue left `model.ts`.
 *
 * **The community run no longer paints anything, and it places every node.** The rule is that a
 * hue is a grouping and never an identity, that a community number is a rank of size which
 * renumbers at each change of the corpus, and that no word on the screen said what a hue meant.
 * So the paint is the type of an entity now, and `layout.ts` is the one reader left.
 *
 * **The condition of survival of this file is therefore the placement, and no longer the paint.**
 * An earlier note said the opposite — "if the community run goes too, the whole file goes with
 * it" — and that was wrong even when it was written. `layout.ts` is scaffolding that dies with
 * the stored position, so this file lives at least that long. `isolates` and `largestDegree`
 * outlive both: `model.ts` reads them for the grey of an isolate and for the size by degree, and
 * both are kept.
 *
 * **`communityCount` and `communitySizes` left this shape.** Each was built at every run and read
 * by nobody, and the comment on `communitySizes` claimed that `layout.ts` read it, which was
 * false: `layout.ts` counts the members itself. A comment that lies is obeyed as confidently as a
 * true one.
 *
 * UC1 says that the analyst reads the macro structure with no label read, so this file gives the
 * numbers that the paint uses.
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
 * **It names its reads and nothing else.** The `Topology` shape below is given word for word.
 * The file therefore never touches the generic parameters of graphology, and it never depends on
 * the attribute shape of the graph.
 *
 * **It carries its own stack.** A recursive depth-first walk of ten thousand nodes overflows the
 * stack of the language. The walk below holds its own stack in two arrays.
 *
 * **It is deterministic.** The label propagation walks the nodes in insertion order and breaks a
 * tie on the lowest label, so the same corpus gives the same communities on every open. That
 * determinism is the contrast with the force layout, and it is kept.
 */

/**
 * The reads of a topology. Nothing else is read.
 *
 * **`forEachNeighbor` is gone.** It was declared because the surface quoted this shape word for
 * word, and it was implemented once and called by nobody. That document is deleted, and the rule
 * is interface plus its own machinery: a member that drives no drawing is not machinery.
 */
export interface Topology {
  forEachNode(cb: (node: string) => void): void;
  neighbors(node: string): string[];
  degree(node: string): number;
}

/**
 * One relation, as a topology reads it: two endpoints, and nothing else.
 *
 * The caller decides which relation reaches this shape. An M4 relation names a relation at one
 * end, so it has no node there, and no caller gives it to `topologyOf`.
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
    neighbors: (node) => [...(adjacency.get(node) ?? [])],
    degree: (node) => degrees.get(node) ?? 0,
  };
}

export interface Structure {
  /**
   * The community of each node. Index 0 is the largest community.
   *
   * **`layout.ts` reads it, and nothing else does.** It was the paint of a node, and the paint is
   * the type now. So this number places a node and never colours one.
   *
   * **It is a rank of size, and that is why it stopped being a colour.** The renumbering below
   * puts the largest community at index 0, so one new entity can renumber the whole run. A
   * colour keyed to it repainted the whole picture at each change of the corpus.
   */
  readonly community: ReadonlyMap<string, number>;
  /** Every node with no relation at all. */
  readonly isolates: readonly string[];
  /**
   * The largest degree in the graph.
   *
   * `model.ts` reads it to scale the size of a node: the range of the degree grows with the
   * corpus, so a fixed multiplier gives one size to every node at ten thousand entities. The list
   * of the rail is in the order of the degree for the same reason — the useful head of a list on
   * a graph is the hubs.
   */
  readonly largestDegree: number;
}

/**
 * How many rounds the label propagation runs before it stops.
 *
 * A round that changes no label ends the walk, so this ceiling only holds a corpus whose labels
 * oscillate between two rounds and never settle. **The number is chosen here**: no document
 * gives one, label propagation settles in far fewer rounds on a corpus that is not adversarial,
 * and twenty rounds of ten thousand nodes cost a small part of the 51 ms the analysis costs.
 *
 * **No ticket owns this number any more.** The bridge analysis is gone, so nothing is left to
 * calibrate here but this ceiling.
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

/** The most frequent label among the neighbours. A tie goes to the lowest label. */
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
    isolates: nodes.filter((_node, index) => numberAt(degrees, index) === 0),
    largestDegree: degrees.reduce((largest, degree) => Math.max(largest, degree), 0),
  };
}
