// Where the graph draws each entity. A position is presentation and never data: it is computed
// away from the browser and stored, because a layout run in the browser draws a different picture
// on every open and blocks the main thread for seconds at corpus size.

import { readRows } from './http';
import { toDomain } from './map';
import type { Entity, EntityPosition } from './model';
import { readOnce } from './once';

/** The stored position of each entity the last layout run placed. An entity it did not place is
 * absent from the map, and the surface that draws it places that entity itself. */
const memory = readOnce<ReadonlyMap<string, EntityPosition>>(async () => {
  const rows = await readRows('layout');
  const placed = new Map<string, EntityPosition>();
  for (const row of rows) {
    const { entityId, position } = toDomain.placement(row);
    if (position !== null) placed.set(entityId, position);
  }
  return placed;
});

/** The held layout while it places every entity of the corpus, and a later read when it does
 * not. The layout job runs outside the browser, so a later run can place an entity that the held
 * answer lacks. The same object comes back while it is whole, so the canvas does not rebuild. */
export async function loadLayout(
  entities: readonly Entity[],
): Promise<ReadonlyMap<string, EntityPosition>> {
  const held = await memory.load();
  if (entities.every((one) => held.has(one.id))) return held;
  // shortcut: while an entity is unplaced, each visit reads the layout again and the canvas rebuilds once, keep the older answer when the new one places no more entities if this flickers.
  memory.forget();
  return memory.load();
}
