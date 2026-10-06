import type { GroundSource } from './basemap';

// Every export here is one job: the closed set of imagery sources, and every reading of a date
// inside it. A second file would carry the same bounds twice.
type ImageryKind = 'eox' | 'gibs-s30' | 'gibs-l30';

/** The two sources that take one day. The composite takes one year. */
type DailyKind = Exclude<ImageryKind, 'eox'>;

export type Imagery =
  | { readonly kind: 'eox'; readonly year: number }
  | { readonly kind: DailyKind; readonly day: string };

export const DEFAULT_IMAGERY: Imagery = { kind: 'eox', year: 2025 };

// The EOX service publishes one cloudless composite per year, and 2016 is the first.
const FIRST_YEAR = 2016;
const LAST_YEAR = 2025;

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

// The first day of each GIBS layer, from the service capabilities. The last day is today, UTC.
const FIRST_DAY: Readonly<Record<DailyKind, string>> = {
  'gibs-s30': '2015-11-28',
  'gibs-l30': '2013-03-22',
};

// A GIBS day is a UTC day, so the bound is the UTC date and not the local one.
const dayOf = (moment: number): string => new Date(moment).toISOString().slice(0, 10);
const today = (): string => dayOf(Date.now());

const isCalendarDay = (day: string): boolean => {
  if (!DAY_SHAPE.test(day)) return false;
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const built = new Date(Date.UTC(year, month - 1, date));
  return (
    built.getUTCFullYear() === year &&
    built.getUTCMonth() === month - 1 &&
    built.getUTCDate() === date
  );
};

// Two days in this shape compare as strings, so the bounds need no parse.
const clampDay = (day: string, kind: DailyKind): string => {
  const min = FIRST_DAY[kind];
  const max = today();
  if (day < min) return min;
  if (day > max) return max;
  return day;
};

const clampYear = (year: number): number => Math.min(LAST_YEAR, Math.max(FIRST_YEAR, year));

export const isImageryKind = (value: unknown): value is ImageryKind =>
  value === 'eox' || value === 'gibs-s30' || value === 'gibs-l30';

export const isImagery = (value: unknown): value is Imagery => {
  if (typeof value !== 'object' || value === null) return false;
  const held = value as Record<string, unknown>;
  const kind = held['kind'];
  if (kind === 'eox') {
    const year = held['year'];
    return (
      typeof year === 'number' && Number.isInteger(year) && year >= FIRST_YEAR && year <= LAST_YEAR
    );
  }
  if (kind === 'gibs-s30' || kind === 'gibs-l30') {
    const day = held['day'];
    return (
      typeof day === 'string' && isCalendarDay(day) && day >= FIRST_DAY[kind] && day <= today()
    );
  }
  return false;
};

const GIBS_LAYER: Readonly<Record<DailyKind, string>> = {
  'gibs-s30': 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance',
  'gibs-l30': 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance',
};

export const SOURCE_NAME: Readonly<Record<ImageryKind, string>> = {
  eox: 'EOX Sentinel-2 cloudless',
  'gibs-s30': 'NASA GIBS HLS Sentinel-2',
  'gibs-l30': 'NASA GIBS HLS Landsat 8/9',
};

// Both credits are an obligation of a licence and not a caption. Do not shorten or reword them.
// The 2018 composite carries two years in its own credit, because EOX built it from both.
const eoxCredit = (year: number): string =>
  `EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data ${year === 2018 ? '2017 & 2018' : String(year)})`;
const GIBS_CREDIT =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).";

// EOX changed the licence with the 2018 composite: the two earlier years stay plain attribution.
const eoxLicence = (year: number): string => (year <= 2017 ? 'CC BY 4.0' : 'CC BY-NC-SA 4.0');
const GIBS_LICENCE = 'NASA, public domain';

// The EOX path is WMTS: `{z}/{y}/{x}` and not `{z}/{x}/{y}`. The last two exchanged draw a world
// mirrored about its diagonal, and report no fault. The GIBS matrix set is the same shape.
// Each ceiling is measured: EOX always upsamples past 10 m, and GIBS answers 400 past level 12.
export function imageryGround(imagery: Imagery): GroundSource {
  if (imagery.kind === 'eox') {
    return {
      tiles: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${imagery.year}_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg`,
      tileSize: 256,
      maxZoom: 14,
      attribution: eoxCredit(imagery.year),
    };
  }
  return {
    tiles: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER[imagery.kind]}/default/${imagery.day}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png`,
    tileSize: 256,
    maxZoom: 12,
    attribution: GIBS_CREDIT,
  };
}

/** What the panel offers: one year out of a closed list, or one day inside two bounds. */
type ImageryPick =
  | { readonly unit: 'year'; readonly year: number; readonly years: readonly number[] }
  | { readonly unit: 'day'; readonly day: string; readonly min: string; readonly max: string };

interface ImageryWords {
  readonly source: string;
  readonly date: string;
  readonly resolution: '10 m' | '30 m';
  readonly licence: string;
  /** The credit the licence asks for, whole. An analyst who cites by hand copies it. */
  readonly credit: string;
  readonly caution: string | null;
  readonly pick: ImageryPick;
}

const YEARS: readonly number[] = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => FIRST_YEAR + i,
);

export function describeImagery(imagery: Imagery): ImageryWords {
  if (imagery.kind === 'eox') {
    return {
      source: SOURCE_NAME.eox,
      date: String(imagery.year),
      resolution: '10 m',
      licence: eoxLicence(imagery.year),
      credit: eoxCredit(imagery.year),
      caution: null,
      pick: { unit: 'year', year: imagery.year, years: YEARS },
    };
  }
  return {
    source: SOURCE_NAME[imagery.kind],
    date: imagery.day,
    resolution: '30 m',
    licence: GIBS_LICENCE,
    credit: GIBS_CREDIT,
    caution: 'A day with no pass over this place draws nothing. A cloudy day draws clouds.',
    pick: { unit: 'day', day: imagery.day, min: FIRST_DAY[imagery.kind], max: today() },
  };
}

/** One year or one day. A step past a bound gives the same value back. */
export function stepImagery(imagery: Imagery, delta: -1 | 1): Imagery {
  if (imagery.kind === 'eox') {
    const year = imagery.year + delta;
    return year < FIRST_YEAR || year > LAST_YEAR ? imagery : { kind: 'eox', year };
  }
  const moved = dayOf(Date.parse(`${imagery.day}T00:00:00Z`) + delta * DAY_MS);
  if (moved < FIRST_DAY[imagery.kind] || moved > today()) return imagery;
  return { kind: imagery.kind, day: moved };
}

/** Changes the source and carries the date over, clamped into the bounds of the new source. */
export function withKind(imagery: Imagery, kind: ImageryKind): Imagery {
  if (kind === 'eox') {
    if (imagery.kind === 'eox') return imagery;
    return { kind, year: clampYear(Number(imagery.day.slice(0, 4))) };
  }
  // The middle of the year: a composite of a whole year has no better single day.
  const day = imagery.kind === 'eox' ? `${imagery.year}-07-01` : imagery.day;
  return { kind, day: clampDay(day, kind) };
}
