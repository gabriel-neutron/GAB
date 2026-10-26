import type { MapOptions } from 'maplibre-gl';

import { imageryGround, type Imagery } from './imagery';
import type { MapTokens } from './map-tokens';
import type { Ground } from './workspace';

// `maplibre-gl` 6 exports no `LayerSpecification`, so the shape comes from the option that carries it.
type StyleSpec = Exclude<MapOptions['style'], string | undefined>;
export type LayerSpec = StyleSpec['layers'][number];

// Vite replaces `import.meta.env` at build time, so an absent key is the empty string and never
// `undefined` in a built bundle. Whitespace comes from a copied example file.
const hosted = (): string | null => {
  const held: unknown = import.meta.env['VITE_MAP_PLAN_TILES'];
  if (typeof held !== 'string') return null;
  const trimmed = held.trim();
  return trimmed === '' ? null : trimmed;
};

// OpenFreeMap: vector tiles of the OpenMapTiles schema, free and with no key. A hosted archive in
// the same schema replaces it with `VITE_MAP_PLAN_TILES` (a TileJSON address).
const PLAN_TILEJSON = 'https://tiles.openfreemap.org/planet';

/** The one vector source of the plan. The layers below read a few of its tile layers. */
export const PLAN_SOURCE = 'plan';
export const planSource = (): { type: 'vector'; url: string; attribution: string } => ({
  type: 'vector',
  url: hosted() ?? PLAN_TILEJSON,
  // An attribution is an obligation of a licence and not a caption. Do not shorten this string
  // and do not reword it.
  attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
});

// The glyph files are in `public/map-fonts`, and `tools/map-glyphs` builds them from the Geist
// fonts of the application. They stay on this origin, so a label never asks a font server.
export const glyphsUrl = (): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}map-fonts/{fontstack}/{range}.pbf`;
const SANS = ['Geist'];
const MONO = ['GeistMono'];

export interface GroundSource {
  readonly tiles: string;
  readonly tileSize: number;
  readonly maxZoom: number;
  // An attribution is an obligation of a licence and not a caption.
  readonly attribution: string;
}

/** Imagery is the only raster ground. It is opt in, and it lies over the plan. */
export const groundSource = (imagery: Imagery): GroundSource => imageryGround(imagery);

// Imagery is shown at this opacity over the water, so the markers keep their contrast.
const IMAGERY_OPACITY = 0.6;

/** Imagery is greyscale at 60%. */
export const imageryPaint = (): {
  readonly 'raster-saturation': number;
  readonly 'raster-opacity': number;
} => ({ 'raster-saturation': -1, 'raster-opacity': IMAGERY_OPACITY });

/** The ground behind the layers: the land of the plan, and the water under the imagery. */
export const backgroundOf = (ground: Ground, tokens: MapTokens): string =>
  ground === 'plan' ? tokens.land : tokens.water;

/** The layers that draw the ground itself. Under imagery they hide, and the borders and the names
 * stay over the picture. */
export const PLAN_GROUND_LAYERS = ['plan-water', 'plan-coast'] as const;

const EVERY_PLACE = ['country', 'city', 'town'] as const;
type Place = (typeof EVERY_PLACE)[number];
const nameOfPlace = (one: Place): string => `plan-name-${one}`;

const LABEL_SIZE = 12;
const HALO_WIDTH = 1.5;

const placeLayer = (
  tokens: MapTokens,
  one: Place,
  minzoom: number,
  maxzoom: number,
): LayerSpec => ({
  id: nameOfPlace(one),
  type: 'symbol',
  source: PLAN_SOURCE,
  'source-layer': 'place',
  filter: ['==', ['get', 'class'], one],
  minzoom,
  maxzoom,
  layout: {
    'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']],
    'text-font': SANS,
    'text-size': LABEL_SIZE,
    'text-max-width': 8,
    'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
  },
  paint: {
    'text-color': tokens.label,
    'text-halo-color': tokens.land,
    'text-halo-width': HALO_WIDTH,
  },
});

type LineFilter = NonNullable<Extract<LayerSpec, { type: 'line' }>['filter']>;

const border = (
  id: string,
  filter: LineFilter,
  tokens: MapTokens,
  dashed: boolean,
  minzoom = 0,
): LayerSpec => ({
  id,
  type: 'line',
  source: PLAN_SOURCE,
  'source-layer': 'boundary',
  filter,
  minzoom,
  layout: { 'line-join': 'round' },
  paint: {
    'line-color': tokens.boundary,
    'line-width': 1,
    ...(dashed ? { 'line-dasharray': [3, 3] } : {}),
  },
});

/**
 * The plan, from the bottom: the land (the background), the water, the coast, the borders, then
 * the names. **No road, rail, building, land-use, relief or point-of-interest layer is here, and
 * none may be added**: the spec of `MapCanvas` has none. Every colour is a `map-*` token, and
 * `planColours` gives them again for a change of theme.
 */
export function planLayers(tokens: MapTokens, ground: Ground): LayerSpec[] {
  const visibility = ground === 'plan' ? 'visible' : 'none';
  return [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': backgroundOf(ground, tokens) },
    },
    {
      id: 'plan-water',
      type: 'fill',
      source: PLAN_SOURCE,
      'source-layer': 'water',
      layout: { visibility },
      paint: { 'fill-color': tokens.water },
    },
    {
      id: 'plan-coast',
      type: 'line',
      source: PLAN_SOURCE,
      'source-layer': 'water',
      layout: { visibility },
      paint: { 'line-color': tokens.boundary, 'line-width': 1 },
    },
    // Maritime borders are not drawn. A disputed or internal border is dashed 3 3.
    border(
      'plan-border-internal',
      ['all', ['in', ['get', 'admin_level'], ['literal', [3, 4]]], ['!=', ['get', 'maritime'], 1]],
      tokens,
      true,
      4,
    ),
    border(
      'plan-border-disputed',
      [
        'all',
        ['==', ['get', 'admin_level'], 2],
        ['==', ['get', 'disputed'], 1],
        ['!=', ['get', 'maritime'], 1],
      ],
      tokens,
      true,
    ),
    border(
      'plan-border-country',
      [
        'all',
        ['==', ['get', 'admin_level'], 2],
        ['!=', ['get', 'maritime'], 1],
        ['!=', ['get', 'disputed'], 1],
      ],
      tokens,
      false,
    ),
    {
      // Sea names are in the caption style: Geist Mono, uppercase, 2px of tracking.
      id: 'plan-sea-name',
      type: 'symbol',
      source: PLAN_SOURCE,
      'source-layer': 'water_name',
      filter: ['in', ['get', 'class'], ['literal', ['sea', 'ocean']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
        'text-font': MONO,
        'text-size': LABEL_SIZE,
        'text-transform': 'uppercase',
        'text-letter-spacing': 2 / LABEL_SIZE,
        'text-max-width': 6,
      },
      paint: {
        'text-color': tokens.label,
        'text-halo-color': tokens.water,
        'text-halo-width': HALO_WIDTH,
      },
    },
    placeLayer(tokens, 'country', 1, 7),
    placeLayer(tokens, 'city', 3, 24),
    placeLayer(tokens, 'town', 9, 24),
  ];
}

/** The colours of the plan, by kind of layer, for a change of theme or of ground. */
export function planColours(
  tokens: MapTokens,
  ground: Ground,
): {
  readonly background: string;
  readonly fills: readonly string[];
  readonly lines: readonly string[];
  readonly names: readonly { readonly id: string; readonly halo: string }[];
} {
  return {
    background: backgroundOf(ground, tokens),
    fills: ['plan-water'],
    lines: ['plan-coast', 'plan-border-internal', 'plan-border-disputed', 'plan-border-country'],
    names: [
      { id: 'plan-sea-name', halo: tokens.water },
      ...EVERY_PLACE.map((one) => ({ id: nameOfPlace(one), halo: tokens.land })),
    ],
  };
}
