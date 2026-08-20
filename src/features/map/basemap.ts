/**
 * The two grounds of the map: where each one comes from, what it credits, and how it is darkened.
 *
 * **It is a second `.ts` beside `projection.ts`, and it is named for its job.** `projection.ts`
 * reduces the corpus to what a map can draw. This holds a tile address, a licence and a paint
 * value, which is a different job and shares nothing with that one.
 *
 * **It touches no library.** `adapter.ts` is the one file that speaks to MapLibre. This file
 * exports plain values, and the adapter turns them into a source and a layer. So a change of the
 * tile path never reaches the library, and this file can be read by a person who knows nothing
 * about MapLibre.
 *
 * ## The tile path, and the ruling of the operator on 17 August 2026
 *
 * The decided source is a tiered PMTiles archive, self-hosted. **That archive does not exist**,
 * and the tracker now holds the gap.
 *
 * The operator ruled that **the archive is an optimisation and never a condition of running**:
 *
 * > The application must work with hosted tiles, but as a fallback it must handle everything
 * > through automatic access to OSM. So the tiles can be implemented later, for optimisation and
 * > for performance, and they must not be necessary for it to work.
 *
 * So the plan ground reads a hosted address first, and falls back to the servers of the
 * OpenStreetMap Foundation when none is configured. **The fallback is a real dependency of a
 * public repository, and the tracker carries what must be true before any deployment**: that
 * policy is for casual and low-volume use, and it is not a tile service for an application.
 */

import type { Ground } from './workspace';

/**
 * The hosted archive, when the operator has one. **No address is committed**, so a public
 * repository carries none, and a machine with an archive states it in `.env.local`.
 *
 * `import.meta.env` is replaced at build time, so an absent key is the empty string and never
 * `undefined` in a built bundle. The test below covers both, and it also covers a key that is set
 * to whitespace by a copied example file.
 */
const hosted = (): string | null => {
  const held: unknown = import.meta.env['VITE_MAP_PLAN_TILES'];
  if (typeof held !== 'string') return null;
  const trimmed = held.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * The servers of the OpenStreetMap Foundation, which is the fallback the operator asked for.
 *
 * **This address is a dependency and not a decision.** The tracker holds what must be true
 * before a deployment, and the decided archive replaces it. Do not raise the zoom above 19: that
 * is where those tiles stop, and MapLibre then asks for a tile that does not exist.
 */
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * EOX Sentinel-2 cloudless 2025. Keyless, global, and uniform over the region this corpus is
 * about, which is why it was chosen over a provider that wants a registration.
 *
 * It is a WMTS service, so the path is `{TileMatrix}/{TileRow}/{TileCol}`, which is `{z}/{y}/{x}`
 * and **not** `{z}/{x}/{y}`. A template with the last two exchanged draws a world that is
 * mirrored about its diagonal, and it reports no fault at all.
 */
const EOX_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg';

/** What one ground is, with no word of MapLibre in it. */
export interface GroundSource {
  /** The tile template, or `null` where nothing is configured and there is no fallback. */
  readonly tiles: string | null;
  readonly tileSize: number;
  /**
   * Where the tiles stop. **The two grounds stop at different zooms**, and it is open whether
   * MapLibre draws the blurry parent tile or nothing past that point. It is the one item to check
   * at build time and never to assume.
   */
  readonly maxZoom: number;
  /**
   * The credit, in its exact decided wording. **An attribution is an obligation of a licence and
   * not a caption**, so this string is not shortened and not reworded.
   */
  readonly attribution: string;
  /**
   * Whether the dark theme inverts this ground in the shader.
   *
   * The plan ground is a light drawing and it is inverted. **Imagery is not inverted** — it is
   * already dark, and it only wants taking down.
   */
  readonly invertsInDark: boolean;
  /** Words for a reader, where the ground has no address at all. */
  readonly missing: string;
}

/**
 * The two grounds. **Both live in the style at one time and one is hidden.** A switch is then a
 * layout property, and never a style that is built again: a style that is built again drops every
 * source with it, and the selection, the hidden types and the relations would all have to be
 * applied a second time.
 */
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

/** Whether the plan ground draws from an archive of the operator, or from the fallback. */
export const planIsHosted = (): boolean => hosted() !== null;

/**
 * The paint of one ground, in the theme in force.
 *
 * **The inversion is in the shader, and it adds no source.** `raster-brightness-min: 1` with
 * `raster-brightness-max: 0` inverts the luminance of one layer, and a half turn of the hue puts
 * the water back to blue. It reaches **the ground layer only**, so the entity hues and the
 * relation lines are untouched. A CSS filter cannot do this, because there is one canvas and the
 * points are on it.
 *
 * **`IMAGERY_DARK` is a tuning value and it guesses at no open question.** The rule is decided —
 * imagery "only wants taking down" — and it names no figure, exactly as the cap of a list does.
 */
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

/** Every ground, so that a caller adds both to the style and never names one of the two. */
export const EVERY_GROUND: readonly Ground[] = ['plan', 'imagery'];
