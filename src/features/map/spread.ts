// An entity with no point of its own draws at its ancestor's point, which the halo marks
// `inherited`. Two or more such entities then draw on the exact same spot and hide one another.
// This file answers one question: at which position in a circle around it each one stands.

import type { GeoEntity } from './projection';

/** Where one entity stands in the circle around a shared point. */
export interface SpreadSlot {
  /** 0-based position in the circle. */
  readonly order: number;
  /** How many entities share this circle. Always at least 1. */
  readonly count: number;
}

// Seven decimals of a degree is under a millimetre on the ground, well past what two coordinates
// written by the same walk could differ by and still mean "the same point".
const POINT_KEY_DECIMALS = 7;

const pointKey = (entity: GeoEntity): string =>
  `${entity.lon.toFixed(POINT_KEY_DECIMALS)},${entity.lat.toFixed(POINT_KEY_DECIMALS)}`;

/** Every entity that shares its point with at least one other entity, mapped to its place in the
 * circle around that point. An entity at its own point (`parentId === null`) never gets a slot: it
 * anchors the centre. Where no drawn entity owns the point, every sharer takes a slot instead. */
export function spreadSlots(entities: readonly GeoEntity[]): ReadonlyMap<string, SpreadSlot> {
  const byPoint = new Map<string, GeoEntity[]>();
  for (const entity of entities) {
    const key = pointKey(entity);
    const held = byPoint.get(key);
    if (held === undefined) byPoint.set(key, [entity]);
    else held.push(entity);
  }

  const slots = new Map<string, SpreadSlot>();
  for (const group of byPoint.values()) {
    if (group.length < 2) continue;
    const orbiting = group
      .filter((entity) => entity.parentId !== null)
      .sort((one, other) => one.label.localeCompare(other.label) || one.id.localeCompare(other.id));
    orbiting.forEach((entity, order) => {
      slots.set(entity.id, { order, count: orbiting.length });
    });
  }
  return slots;
}

/** The offset from the shared point to one entity's slot, in pixels on the screen. Index 0 stands
 * at the top, and the rest follow clockwise, so a group of one reads the same as a compass mark. */
export function spreadOffsetPx(
  slot: SpreadSlot,
  radiusPx: number,
): { readonly dx: number; readonly dy: number } {
  const angle = -Math.PI / 2 + (slot.order * 2 * Math.PI) / slot.count;
  return { dx: radiusPx * Math.cos(angle), dy: radiusPx * Math.sin(angle) };
}
