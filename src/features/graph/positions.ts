// Every entity takes a position, so no entity is dropped from the picture in silence. A stored
// position comes from the layout run; an entity the run did not place takes a position that is a
// pure function of its identifier, so it stands in the same place on every open.

import type { Entity, EntityPosition } from '@/shared/read/model';

import type { NodePosition } from './model';

const TAU = Math.PI * 2;

// An unplaced entity stands outside the reach of the stored picture, in a band of this depth, so
// that it reads as unplaced and does not set the bounding box that Sigma normalises on its own.
const BAND_INNER = 1.1;
const BAND_DEPTH = 0.15;

// The reach of a corpus that carries no stored position at all. The band is then the whole
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

/** Where the canvas draws each entity: the stored position where the layout run gave one, and a
 * place read from the identifier where it gave none. */
export function graphPositions(
  entities: readonly Entity[],
  stored: ReadonlyMap<string, EntityPosition>,
): ReadonlyMap<string, NodePosition> {
  const reach = reachOf(stored);
  const positions = new Map<string, NodePosition>();

  for (const entity of entities) {
    const held = stored.get(entity.id);
    if (held !== undefined) {
      positions.set(entity.id, held);
      continue;
    }
    const angle = TAU * unitOf(entity.id, 1);
    const band = reach * (BAND_INNER + BAND_DEPTH * unitOf(entity.id, 2));
    positions.set(entity.id, { x: band * Math.cos(angle), y: band * Math.sin(angle) });
  }

  return positions;
}
