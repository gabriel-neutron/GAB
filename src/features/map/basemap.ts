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

// EOX Sentinel-2 cloudless 2025 is WMTS: the path is `{z}/{y}/{x}`, not `{z}/{x}/{y}`. The last
// two exchanged draw a world mirrored about its diagonal, and report no fault.
const EOX_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg';

export interface GroundSource {
  readonly tiles: string | null;
  readonly tileSize: number;
  readonly maxZoom: number;
  // An attribution is an obligation of a licence and not a caption. Do not shorten this string
  // and do not reword it.
  readonly attribution: string;
  readonly invertsInDark: boolean;
  readonly missing: string;
}

// Both grounds live in the style at one time and one is hidden. A style built again drops every
// source with it, and the selection, the hidden types and the relations must be applied again.
export const GROUNDS: Readonly<Record<Ground, GroundSource>> = {
  plan: {
    tiles: hosted() ?? OSM_TILES,
    tileSize: 256,
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
    invertsInDark: true,
    missing: 'No plan ground is configured.',
  },
  imagery: {
    tiles: EOX_TILES,
    tileSize: 256,
    maxZoom: 14,
    attribution:
      'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)',
    invertsInDark: false,
    missing: 'No imagery ground is configured.',
  },
};

export const planIsHosted = (): boolean => hosted() !== null;

// `raster-brightness-min: 1` with `raster-brightness-max: 0` inverts the luminance of one layer,
// and a half turn of the hue puts the water back to blue. A CSS filter cannot do this, because
// there is one canvas and the entity points are on it.
const IMAGERY_DARK = 0.7;

export interface GroundPaint {
  readonly 'raster-brightness-min': number;
  readonly 'raster-brightness-max': number;
  readonly 'raster-hue-rotate': number;
}

export function groundPaint(ground: Ground, dark: boolean): GroundPaint {
  const source = GROUNDS[ground];
  if (!dark)
    return { 'raster-brightness-min': 0, 'raster-brightness-max': 1, 'raster-hue-rotate': 0 };
  if (!source.invertsInDark) {
    return {
      'raster-brightness-min': 0,
      'raster-brightness-max': IMAGERY_DARK,
      'raster-hue-rotate': 0,
    };
  }
  return { 'raster-brightness-min': 1, 'raster-brightness-max': 0, 'raster-hue-rotate': 180 };
}

export const EVERY_GROUND: readonly Ground[] = ['plan', 'imagery'];
