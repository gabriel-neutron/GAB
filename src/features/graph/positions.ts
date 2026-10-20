// Every entity takes a position, so no entity is dropped from the picture in silence. A stored
// position comes from the layout run; an entity the run did not place takes a position that is a
// pure function of its identifier and of the stored places of its neighbours, so it stands in the
// same place on every open.

import type { Entity, EntityPosition } from '@/shared/read/model';

import type { NodePosition } from './model';

const TAU = Math.PI * 2;

// An unplaced entity stands outside the reach of the stored picture, in a ring of this depth, so
// that it reads as unplaced and does not set the bounding box that Sigma normalises on its own.
const RING_INNER = 1.1;
const RING_DEPTH = 0.15;

// The reach of a corpus that carries no stored position at all. The ring is then the whole
// picture, and only the ratios between the dots matter.
const BARE_REACH = 1;

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

const reachOf = (stored: ReadonlyMap<string, EntityPosition>): number => {
  let furthest = 0;
  for (const { x, y } of stored.values()) furthest = Math.max(furthest, Math.hypot(x, y));
  return furthest === 0 ? BARE_REACH : furthest;
};

/** The two ends of a relation, as the placement reads them. */
export interface PlacementLink {
  readonly srcKind: string;
  readonly srcId: string;
  readonly dstKind: string;
  readonly dstId: string;
}

/** Where the canvas draws each entity, and which entities stand on the ring. */
interface GraphPlacement {
  readonly positions: ReadonlyMap<string, NodePosition>;
  /** The entities with no place: the layout run did not place them, and no placed entity joins
   * them. Their place on the ring means nothing. */
  readonly unplaced: ReadonlySet<string>;
}

// A new entity stands this far from the middle of its placed neighbours, in units of the reach.
// The distance keeps two new entities of one neighbour apart, inside the cluster.
const NEAR_MIN = 0.01;
const NEAR_SPAN = 0.02;

/** Where the canvas draws each entity: the stored position where the layout run gave one; near
 * the middle of its placed neighbours where it gave none and a neighbour has a place; else on the
 * ring. The pass reads the stored places only, so the order of the entities changes nothing. */
export function graphPositions(
  entities: readonly Entity[],
  stored: ReadonlyMap<string, EntityPosition>,
  relations: readonly PlacementLink[],
): GraphPlacement {
  const reach = reachOf(stored);
  const neighbours = new Map<string, string[]>();
  const join = (from: string, to: string): void => {
    if (!stored.has(to)) return;
    const held = neighbours.get(from);
    if (held === undefined) neighbours.set(from, [to]);
    else held.push(to);
  };
  for (const relation of relations) {
    if (relation.srcKind !== 'entity' || relation.dstKind !== 'entity') continue;
    join(relation.srcId, relation.dstId);
    join(relation.dstId, relation.srcId);
  }

  const positions = new Map<string, NodePosition>();
  const unplaced = new Set<string>();

  for (const entity of entities) {
    const held = stored.get(entity.id);
    if (held !== undefined) {
      positions.set(entity.id, held);
      continue;
    }
    const angle = TAU * unitOf(entity.id, 1);
    const near = neighbours.get(entity.id);
    if (near !== undefined) {
      let sumX = 0;
      let sumY = 0;
      for (const id of near) {
        const at = stored.get(id);
        sumX += at?.x ?? 0;
        sumY += at?.y ?? 0;
      }
      const away = reach * (NEAR_MIN + NEAR_SPAN * unitOf(entity.id, 2));
      positions.set(entity.id, {
        x: sumX / near.length + away * Math.cos(angle),
        y: sumY / near.length + away * Math.sin(angle),
      });
      continue;
    }
    const ring = reach * (RING_INNER + RING_DEPTH * unitOf(entity.id, 2));
    positions.set(entity.id, { x: ring * Math.cos(angle), y: ring * Math.sin(angle) });
    unplaced.add(entity.id);
  }

  return { positions, unplaced };
}
