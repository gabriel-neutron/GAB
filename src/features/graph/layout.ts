/**
 * A stand-in position for each node. **Scaffolding, and it must not ship.**
 *
 * **Where a position is stored is open, and this file does not answer it.** A measurement of two
 * force layouts of one corpus: the displacement is 0.49 of the width of the picture and the
 * correlation of the pair distances is 0.18 at ten thousand nodes. Convergence does not repair
 * it. So a position must be **precomputed and stored**, and the tracker carries where. This file
 * stores nothing, reads no store, and guesses nothing about what a stored position carries.
 *
 * **What it gives instead is determinism.** The same corpus gives the same coordinates on every
 * open, because a placement here is a pure function of the identifier of the entity, of its
 * community and of its degree, with a seeded generator and no randomness. Determinism is the one
 * property a force layout loses, and the community analysis already keeps it.
 *
 * **It is the same class as the raster stand-in the map carries, and it is deleted the day the
 * store answers.** It is scaffolding that the rebuild leaves behind.
 *
 * **It adds no dependency.** `graphology-layout-forceatlas2` is not installed, and the reason it
 * must not be is 4 536 ms of a blocked main thread at ten thousand nodes.
 *
 * **It takes the corpus as an argument, and it imports the type alone.** `model.ts` and
 * `src/features/map/projection.ts` do the same, so this file imports no read module and the day
 * `src/contract/` replaces the fixtures only the caller changes. The caller is then one line:
 * `buildGraphModel(corpus, standInPositions(corpus), palette)`.
 *
 * **`analyseStructure` runs two times, and the cost is accepted.** It runs here to cluster the
 * placement, and again inside `buildGraphModel` to paint. The analysis measures 51 ms at ten
 * thousand nodes, so the two runs are about 100 ms, against the 4 536 ms of the layout that is
 * refused. **No cache repairs it**: a layout held in a module is scaffolding, and it would make a
 * second place that holds a position. The whole file goes when the store answers.
 */

import type { Corpus } from '@/shared/fixtures/types';

import type { NodePosition } from './model';
import { analyseStructure, topologyOf, type TopologyLink } from './structure';

/**
 * The radius of the disc of a community of one member. A community grows by the square root.
 *
 * **It is a guess**, because this file is a stand-in and the store is open.
 */
const DISC = 12;

/**
 * The gap between two discs on the ring, so that two communities read as two.
 *
 * **It is a guess**, with the disc above.
 */
const GAP = 8;

/**
 * How far a hub is pulled towards the centre of its disc, as a fraction of the radius. UC1 reads
 * the picture with no label, so a hub must sit inside its cluster and not on the edge of it.
 *
 * **It is a guess**, with the disc above.
 */
const HUB_PULL = 0.6;

/**
 * How far outside the structure the band of the isolates sits, as a fraction of the reach of the
 * structure.
 *
 * **An isolate is not a community like the others.** The analysis makes it a community of one,
 * which is right for the count and wrong for the placement. The defect: six lone isolates took
 * six of the thirteen angular slots of the fixture and sat as far from the centre as the four
 * clusters that carry the whole structure. Sigma normalises each coordinate into the viewport, so
 * those six dots set the bounding box and the four clusters were squeezed into about a third of
 * the canvas.
 *
 * **12 % is close enough that the isolates do not set the picture, and far enough that they read
 * as outside the structure.** They sit beyond the outer edge of every disc, and they add about a
 * tenth to the reach of the picture. UC1 asks for an outlier to be **found**, and not hidden.
 *
 * **It is a guess**, with the disc above.
 */
const ISOLATE_BAND = 1.12;

const TAU = Math.PI * 2;

/**
 * FNV-1a over the identifier, with a salt, and one final mix.
 *
 * **The seed is the identifier, so no seed is stored.** A stored seed is a stored position under
 * another name, and the store is open. `Math.imul` keeps the multiply in 32 bits, which every
 * engine gives the same answer for.
 */
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

/**
 * Where each node is drawn, until the store answers.
 *
 * A community that holds the structure is a disc on one ring, and each member sits inside the disc
 * of its community, so the picture reads as macro structure: the clusters, and the bridges between
 * them. Each community takes angular space in proportion to its disc.
 *
 * **An isolate does not go on that ring.** The analysis makes it a community of one, which is
 * right for the count and wrong for the placement. The isolates sit in one band just outside the
 * ring, where UC1 can find them and where they do not set the size of the picture.
 */
export function standInPositions(corpus: Corpus): ReadonlyMap<string, NodePosition> {
  // **Every entity takes a position**, so the stand-in loses none of them. A repeated identifier
  // is one node, because the read comes from outside and `model.ts` drops the second row too.
  const nodes = new Set(corpus.entities.map((entity) => entity.id));

  // The topology, built by `./structure`, which declares the shape. Only a relation with an
  // entity at each end joins two nodes: an M4 relation names a relation, so it has no node at one
  // end. The self-loop and the unknown endpoint are dropped there.
  //
  // **A repeated relation identifier is dropped here, because `model.ts` drops it too.** That
  // file refuses a repeated key on the multigraph and counts the second row as a duplicate, so a
  // corpus with a repeated relation id gave that pair degree 2 in the placement and degree 1 in
  // the paint — two topologies that disagree with nobody to see it, which is the fault the one
  // `topologyOf` exists to prevent. The fixture holds no repeated id, so no count moves today.
  const links = new Map<string, TopologyLink>();
  for (const relation of corpus.relations) {
    if (relation.srcKind !== 'entity' || relation.dstKind !== 'entity') continue;
    if (links.has(relation.id)) continue;
    links.set(relation.id, { source: relation.srcId, target: relation.dstId });
  }
  const topology = topologyOf(nodes, links.values());
  const structure = analyseStructure(topology);

  // **The ring carries the communities that hold the structure, and never a lone isolate.** An
  // isolate has no relation, so the analysis gives it a community of its own. On the ring it would
  // one whole angular slot and sit as far out as a cluster of five hundred.
  const isolates = new Set(structure.isolates);
  const members = new Map<number, number>();
  topology.forEachNode((node) => {
    if (isolates.has(node)) return;
    const community = structure.community.get(node) ?? 0;
    members.set(community, (members.get(community) ?? 0) + 1);
  });

  // The community numbers are in the order `analyseStructure` gives them, largest first, and the
  // sort keeps that order after the isolates leave. The same corpus therefore gives the same ring.
  const ringCommunities = [...members.keys()].sort((one, two) => one - two);

  // The radius of each disc. A member count of `size` covers an area that grows with `size`, so
  // the radius grows with its square root and the density stays even.
  const radii = new Map<number, number>();
  for (const community of ringCommunities) {
    radii.set(community, DISC * Math.sqrt(Math.max(members.get(community) ?? 1, 1)));
  }

  // **Each community takes angular space in proportion to its disc, and never an equal share.**
  // With an equal share a community of one takes the same arc as a community of five hundred, and
  // the large disc then overlaps its neighbours while the small one sits in an empty field.
  const arcs = ringCommunities.map((community) => 2 * (radii.get(community) ?? DISC) + GAP);

  // The ring is wide enough to carry every disc side by side, so two discs never overlap. The
  // circumference is the sum of the diameters and the gaps, and the radius follows from it.
  const span = arcs.reduce((total, arc) => total + arc, 0);
  const ring = ringCommunities.length > 1 ? span / TAU : 0;

  // Where the disc of each community sits. The angle is the middle of the arc of that community.
  const centres = new Map<number, { readonly x: number; readonly y: number }>();
  let walked = 0;
  ringCommunities.forEach((community, index) => {
    const arc = arcs[index] ?? 0;
    const angle = span === 0 ? 0 : (TAU * (walked + arc / 2)) / span;
    walked += arc;
    centres.set(community, { x: ring * Math.cos(angle), y: ring * Math.sin(angle) });
  });

  // The largest degree inside each community. A degree is meaningful against the neighbours a
  // node has, and not against the largest hub of the whole corpus.
  const largest = new Map<number, number>();
  topology.forEachNode((node) => {
    const community = structure.community.get(node) ?? 0;
    const degree = topology.degree(node);
    largest.set(community, Math.max(largest.get(community) ?? 0, degree));
  });

  const positions = new Map<string, NodePosition>();
  topology.forEachNode((node) => {
    // The band below carries each isolate.
    if (isolates.has(node)) return;

    const community = structure.community.get(node) ?? 0;
    const radius = radii.get(community) ?? DISC;
    const centre = centres.get(community) ?? { x: 0, y: 0 };

    // `sqrt` of a uniform number spreads the members evenly over the area of the disc. Without
    // it every member crowds the centre and the disc reads as one dot.
    const spread = Math.sqrt(unitOf(node, 1));
    const angle = TAU * unitOf(node, 2);

    const top = largest.get(community) ?? 0;
    const pull = top > 0 ? topology.degree(node) / top : 0;
    const distance = radius * spread * (1 - HUB_PULL * pull);

    positions.set(node, {
      x: centre.x + distance * Math.cos(angle),
      y: centre.y + distance * Math.sin(angle),
    });
  });

  // **The isolates sit in one band outside the structure** — UC1 wants an outlier to be found.
  // The reach of the structure is the outer edge of the disc that stands furthest out.
  const reach = ringCommunities.reduce(
    (furthest, community) => Math.max(furthest, ring + (radii.get(community) ?? 0)),
    0,
  );
  // The band must also be long enough to carry each isolate side by side, which is the case where
  // a corpus holds many isolates and few relations. A corpus of isolates alone has no structure to
  // stand outside, so the band is then the whole picture.
  const band = Math.max(reach * ISOLATE_BAND, (structure.isolates.length * GAP) / TAU, DISC);
  structure.isolates.forEach((node, index) => {
    const angle = (TAU * index) / Math.max(structure.isolates.length, 1);
    positions.set(node, { x: band * Math.cos(angle), y: band * Math.sin(angle) });
  });

  return positions;
}
