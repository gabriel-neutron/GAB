import { imageryGround, type Imagery } from './imagery';
import type { Ground } from './workspace';

// Vite replaces `import.meta.env` at build time, so an absent key is the empty string and never
// `undefined` in a built bundle. Whitespace comes from a copied example file.
const hosted = (): string | null => {
  const held: unknown = import.meta.env['VITE_MAP_PLAN_TILES'];
  if (typeof held !== 'string') return null;
  const trimmed = held.trim();
  return trimmed === '' ? null : trimmed;
};

// Tile policy of the OpenStreetMap Foundation: casual and low-volume use, and not a tile service
// for an application. Do not raise the zoom above 19: those tiles stop there, and MapLibre then
// asks for a tile that does not exist.
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface GroundSource {
  readonly tiles: string;
  readonly tileSize: number;
  readonly maxZoom: number;
  // An attribution is an obligation of a licence and not a caption. Do not shorten this string
  // and do not reword it.
  readonly attribution: string;
}

const PLAN: GroundSource = {
  tiles: hosted() ?? OSM_TILES,
  tileSize: 256,
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
};

// Both grounds live in the style at one time and one is hidden. A style built again drops every
// source with it, so a change of imagery rebuilds one source and one layer, and never the style.
export function groundSource(ground: Ground, imagery: Imagery): GroundSource {
  return ground === 'plan' ? PLAN : imageryGround(imagery);
}

interface GroundPaint {
  readonly 'raster-saturation': number;
  readonly 'raster-brightness-min': number;
  readonly 'raster-brightness-max': number;
  readonly 'raster-opacity': number;
}

// The mean grey of the land of an OpenStreetMap tile, 0 to 1. A plan has no vector layers to
// recolour, so it is drawn in greyscale and the brightness range puts this land on `map-land`.
const PLAN_LAND_GREY = 0.94;
// Imagery is opt in and shown at this opacity over the water, so the markers keep their contrast.
const IMAGERY_OPACITY = 0.6;

const greyOf = (hex: string): number => {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
  return channels.reduce((sum, one) => sum + one, 0) / 3;
};

/** Both grounds are greyscale. The plan keeps its land on the `map-land` grey of the theme. */
export function groundPaint(ground: Ground, land: string): GroundPaint {
  if (ground === 'imagery') {
    return {
      'raster-saturation': -1,
      'raster-brightness-min': 0,
      'raster-brightness-max': 1,
      'raster-opacity': IMAGERY_OPACITY,
    };
  }
  return {
    'raster-saturation': -1,
    'raster-brightness-min': 0,
    'raster-brightness-max': Math.min(1, greyOf(land) / PLAN_LAND_GREY),
    'raster-opacity': 1,
  };
}

export const EVERY_GROUND: readonly Ground[] = ['plan', 'imagery'];
