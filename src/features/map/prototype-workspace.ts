/**
 * PROTOTYPE — throwaway. The one workspace record of the map, under ADR 0004 §7.
 *
 * The camera, the basemap in use, the hidden types and whether the left bar is open. All three are workspace by the
 * test of #33 — they are how *you* left the tool and they mean nothing to anyone else — so they
 * live in `localStorage` and never in the address. The selected entity is **not** here: it is
 * identity, it lives in the address, and #33 carries the argument.
 *
 * One record, one key, and every writer patches rather than replaces. Two writers with two
 * partial records would each erase the other's field.
 */

import { readWorkspace, writeWorkspace } from '@/shared/storage';

/** ADR 0005 §3 names both. The vector basemap of §2 is not built, so `osm` stands in for it. */
export type Basemap = 'satellite' | 'osm';

export interface MapWorkspace {
  readonly lon: number;
  readonly lat: number;
  readonly zoom: number;
  readonly hidden: readonly string[];
  readonly barOpen: boolean;
  readonly basemap: Basemap;
}

/**
 * The first view, for an empty store. It is an invented number, like the zoom breakpoints and
 * the buffer radius that ADR 0005 §2 leaves to calibration. Reported to #33, not settled here.
 */
const FALLBACK: MapWorkspace = {
  lon: 30,
  lat: 58,
  zoom: 3,
  hidden: [],
  barOpen: true,
  basemap: 'satellite',
};

/**
 * Strict on purpose. A record written before a field existed fails here and falls back, which
 * costs the operator one camera position, once. The alternative is a tolerant guard that lets
 * two shapes live under one key, and that is the fault the version in the key exists to prevent.
 */
const isMapWorkspace = (value: unknown): value is MapWorkspace =>
  typeof value === 'object' &&
  value !== null &&
  'lon' in value &&
  typeof value.lon === 'number' &&
  'lat' in value &&
  typeof value.lat === 'number' &&
  'zoom' in value &&
  typeof value.zoom === 'number' &&
  'hidden' in value &&
  Array.isArray(value.hidden) &&
  'barOpen' in value &&
  typeof value.barOpen === 'boolean' &&
  'basemap' in value &&
  (value.basemap === 'satellite' || value.basemap === 'osm');

export const readMapWorkspace = (): MapWorkspace =>
  readWorkspace('map-prototype', isMapWorkspace, FALLBACK);

export function patchMapWorkspace(patch: Partial<MapWorkspace>): void {
  writeWorkspace('map-prototype', { ...readMapWorkspace(), ...patch });
}
