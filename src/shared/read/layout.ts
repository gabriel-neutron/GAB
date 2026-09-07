// Where the graph draws each entity. A position is presentation and never data: it is computed
// away from the browser and stored, because a layout run in the browser draws a different picture
// on every open and blocks the main thread for seconds at corpus size.

import { readRows } from './http';
import { toDomain } from './map';
import type { EntityPosition } from './model';
import { readOnce } from './once';

/** The stored position of each entity the last layout run placed. An entity it did not place is
 * absent from the map, and the surface that draws it places that entity itself. */
export const loadLayout = readOnce<ReadonlyMap<string, EntityPosition>>(async () => {
  const rows = await readRows('layout');
  const placed = new Map<string, EntityPosition>();
  for (const row of rows) {
    const { entityId, position } = toDomain.placement(row);
    if (position !== null) placed.set(entityId, position);
  }
  return placed;
}).load;
