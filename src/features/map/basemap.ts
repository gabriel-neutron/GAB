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

// `raster-brightness-min: 1` with `raster-brightness-max: 0` inverts the luminance of one layer,
// and a half turn of the hue puts the water back to blue. A CSS filter cannot do this, because
// there is one canvas and the entity points are on it.
const IMAGERY_DARK = 0.7;

interface GroundPaint {
  readonly 'raster-brightness-min': number;
  readonly 'raster-brightness-max': number;
  readonly 'raster-hue-rotate': number;
}

// The inversion is a property of the ground and not of one date: a plan reads inverted, and any
// satellite image dims. So the table is by ground, and no imagery states it a second time.
const INVERTS_IN_DARK: Readonly<Record<Ground, boolean>> = { plan: true, imagery: false };

export function groundPaint(ground: Ground, dark: boolean): GroundPaint {
  if (!dark)
    return { 'raster-brightness-min': 0, 'raster-brightness-max': 1, 'raster-hue-rotate': 0 };
  if (!INVERTS_IN_DARK[ground]) {
    return {
      'raster-brightness-min': 0,
      'raster-brightness-max': IMAGERY_DARK,
      'raster-hue-rotate': 0,
    };
  }
  return { 'raster-brightness-min': 1, 'raster-brightness-max': 0, 'raster-hue-rotate': 180 };
}

export const EVERY_GROUND: readonly Ground[] = ['plan', 'imagery'];
