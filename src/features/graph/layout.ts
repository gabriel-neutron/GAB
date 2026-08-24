// A force layout blocks the main thread at full corpus size, and it draws a different picture on
// each run, so a position here is a pure function of the entity id. The analysis is not cached: a
// layout held in a module makes a second place that holds a position.

import type { Corpus } from '@/shared/fixtures/types';

import type { NodePosition } from './model';
import { analyseStructure, topologyOf, type TopologyLink } from './structure';

/**
 * The radius of the disc of a community of one member. It is a guess: this file is a stand-in.
 */
const DISC = 12;

/** The gap between two discs on the ring, so two communities read as two. It is a guess. */
const GAP = 8;

/**
 * A hub must sit inside its cluster, not on the edge: this fraction of the radius. It is a guess.
 */
const HUB_PULL = 0.6;

// Six lone isolates took six of the thirteen angular slots of the fixture, set the bounding box
// that Sigma normalises, and squeezed the four clusters into a third of the canvas. 12 % keeps
// them outside the structure and adds about a tenth to the reach of the picture.
const ISOLATE_BAND = 1.12;

const TAU = Math.PI * 2;

/**
 * FNV-1a on the id, with a salt. `Math.imul` keeps the multiply in 32 bits on every engine.
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

export function standInPositions(corpus: Corpus): ReadonlyMap<string, NodePosition> {
  // **Every entity takes a position**, so the stand-in loses none of them. A repeated identifier
  // is one node, because the read comes from outside and `model.ts` drops the second row too.
  const nodes = new Set(corpus.entities.map((entity) => entity.id));

  // Only a relation with an entity at each end joins two nodes. A repeated relation id is dropped
  // here because `model.ts` drops it too: two topologies that disagree would give one pair degree
  // 2 in the placement and degree 1 in the paint.
  const links = new Map<string, TopologyLink>();
  for (const relation of corpus.relations) {
    if (relation.srcKind !== 'entity' || relation.dstKind !== 'entity') continue;
    if (links.has(relation.id)) continue;
    links.set(relation.id, { source: relation.srcId, target: relation.dstId });
  }
  const topology = topologyOf(nodes, links.values());
  const structure = analyseStructure(topology);

  // **The ring carries the communities that hold the structure, and never a lone isolate.** An
  // isolate has no relation, so the analysis gives it a community of its own. On the ring it
  // would take one whole angular slot and sit as far out as a cluster of five hundred.
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

  // **The isolates sit in one band outside the structure**, so an outlier is found and not hidden.
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
