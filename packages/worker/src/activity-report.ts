import { readCsv } from '@gab/tools/csv';
import { z } from 'zod';

import { nameKey } from './name-key.ts';
import type { Queryable } from './queryable.ts';
import type { Strike } from './sentinel2-pairs.ts';

// The activity report gives each asset one mark for its kind, from the World Bank flare table, the
// stored FIRMS answers and the dated strikes. It is a report, not a fact of the record: it writes
// nothing. The thresholds are the ones that the calibration of #530 proposed.

// Origin of the numbers: the calibration of #530 (hot pixel, event, window after a strike) and
// assumptions of the first build (the radii). Each one is printed in the report.
export const THRESHOLDS = {
  hotMegawatts: 3,
  hotKelvin: 320,
  eventPixels: 3,
  eventMegawatts: 10,
  strikeWindowDays: 10,
  strikeRadiusMetres: 5000,
  refineryRadiusMetres: 3000,
  flareRadiusMetres: 1000,
  fieldFlareMetres: 5000,
  lngFlareMetres: 10000,
} as const;

const BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const DAY_MS = 86_400_000;

export interface Asset {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly latitude: number;
  readonly longitude: number;
  /** The entities that operate the asset. */
  readonly operators: ReadonlySet<string>;
}

export interface Flare {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly operator: string;
  readonly field: string;
  readonly type: string;
  /** Flared volume in billion cubic metres, by year. */
  readonly bcm: ReadonlyMap<number, number>;
}

export interface Detection {
  readonly latitude: number;
  readonly longitude: number;
  readonly day: string;
  readonly time: string;
  readonly satellite: string;
  readonly night: boolean;
  readonly megawatts: number;
  readonly kelvin: number;
  readonly type: string;
}

/** One stored FIRMS answer: its box, its days and its pixels. */
export interface Answer {
  readonly box: readonly [west: number, south: number, east: number, north: number];
  readonly from: string;
  readonly to: string;
  readonly detections: readonly Detection[];
}

export interface ActivityInput {
  readonly today: string;
  readonly assets: readonly Asset[];
  readonly flares: readonly Flare[];
  readonly answers: readonly Answer[];
  readonly strikes: readonly Strike[];
  /** The record entity of each flare operator name that the approved table matches for sure. */
  readonly operators: ReadonlyMap<string, string>;
}

// ---- readers ----

/** The stored flare table: one row for each site and year, read as one flare for each site. */
export const flaresOf = (text: string): Flare[] => {
  const flares = new Map<string, Flare>();
  let head: readonly string[] = [];
  for (const row of readCsv(text)) {
    if (row.fields[0] === 'id') {
      head = row.fields;
      continue;
    }
    const cell = (name: string): string => row.fields[head.indexOf(name)] ?? '';
    const latitude = Number(cell('lat'));
    const longitude = Number(cell('lon'));
    const year = Number(cell('Year'));
    const bcm = Number(cell('BCM'));
    if (
      head.length === 0 ||
      cell('id') === '' ||
      !Number.isFinite(latitude + longitude + year + bcm)
    )
      continue;
    const flare = flares.get(cell('id')) ?? {
      id: cell('id'),
      latitude,
      longitude,
      operator: cell('Operator'),
      field: cell('Field name'),
      type: cell('Field type'),
      bcm: new Map<number, number>(),
    };
    (flare.bcm as Map<number, number>).set(year, bcm);
    flares.set(flare.id, flare);
  }
  return [...flares.values()];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u;

/** The operator names that the name table matches for sure to an entity of the record. A name with
 * another status, or with no record entity, is left out: it is never matched by position. */
export const operatorsOf = (text: string): Map<string, string> => {
  const [head, ...rows] = readCsv(text);
  const at = (name: string): number => head?.fields.indexOf(name) ?? -1;
  const out = new Map<string, string>();
  for (const row of rows) {
    const id = UUID.exec(row.fields[at('record_candidate')] ?? '')?.[0];
    if (row.fields[at('status')] === 'sure' && id !== undefined)
      out.set(nameKey(row.fields[at('name')] ?? ''), id);
  }
  return out;
};

/** The pixels of a stored FIRMS page. A page may repeat its header line. */
export const detectionsOf = (text: string): Detection[] => {
  const out: Detection[] = [];
  let head: readonly string[] = [];
  for (const row of readCsv(text)) {
    if (row.fields[0] === 'latitude') {
      head = row.fields;
      continue;
    }
    const cell = (name: string): string => row.fields[head.indexOf(name)] ?? '';
    const latitude = Number(cell('latitude'));
    const longitude = Number(cell('longitude'));
    if (head.length === 0 || !Number.isFinite(latitude + longitude) || cell('acq_date') === '')
      continue;
    out.push({
      latitude,
      longitude,
      day: cell('acq_date'),
      time: cell('acq_time'),
      satellite: cell('satellite'),
      night: cell('daynight') === 'N',
      megawatts: Number(cell('frp')),
      kelvin: Number(cell('bright_ti4')),
      type: cell('type'),
    });
  }
  return out;
};

/** The box and the days that the synthetic address of a stored answer names. */
export const answerOf = (uri: string, text: string): Answer | undefined => {
  if (!uri.startsWith(`${BASE}/`)) return undefined;
  const [box = '', from = '', to = ''] = uri.slice(BASE.length + 1).split('/');
  const sides = box.split(',').map(Number);
  const [west, south, east, north] = sides;
  if (
    sides.length !== 4 ||
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    !sides.every(Number.isFinite)
  )
    return undefined;
  return { box: [west, south, east, north], from, to, detections: detectionsOf(text) };
};

// ---- geometry and time ----

const metres = (a: { latitude: number; longitude: number }, b: typeof a): number => {
  const rad = Math.PI / 180;
  const dy = (b.latitude - a.latitude) * rad;
  const dx = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  return 6_371_000 * Math.hypot(dx, dy);
};

const msOf = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The pixels, spread in cells of 0.2 degree, so a radius query reads nine cells. */
const gridOf = (pixels: readonly Detection[]) => {
  const key = (x: number, y: number): string =>
    `${String(Math.floor(x / 0.2))},${String(Math.floor(y / 0.2))}`;
  const cells = new Map<string, Detection[]>();
  for (const pixel of pixels) {
    const at = key(pixel.longitude, pixel.latitude);
    cells.set(at, [...(cells.get(at) ?? []), pixel]);
  }
  return (point: { latitude: number; longitude: number }, radius: number): Detection[] => {
    const found: Detection[] = [];
    for (let dx = -1; dx <= 1; dx += 1)
      for (let dy = -1; dy <= 1; dy += 1)
        for (const pixel of cells.get(key(point.longitude + dx * 0.2, point.latitude + dy * 0.2)) ??
          [])
          if (metres(point, pixel) <= radius) found.push(pixel);
    return found;
  };
};

// ---- strikes and events ----

const hot = (pixel: Detection): boolean =>
  pixel.night && pixel.megawatts >= THRESHOLDS.hotMegawatts && pixel.kelvin >= THRESHOLDS.hotKelvin;

/** The days on which the pixels make an event: hot pixels in one overpass, or a strong pixel on
 * two satellites. */
const eventDays = (pixels: readonly Detection[]): Set<string> => {
  const overpass = new Map<string, number>();
  const strong = new Map<string, Set<string>>();
  for (const pixel of pixels) {
    if (!hot(pixel)) continue;
    const at = `${pixel.day} ${pixel.satellite} ${pixel.time}`;
    overpass.set(at, (overpass.get(at) ?? 0) + 1);
    if (pixel.megawatts >= THRESHOLDS.eventMegawatts)
      strong.set(pixel.day, (strong.get(pixel.day) ?? new Set()).add(pixel.satellite));
  }
  return new Set([
    ...[...overpass].filter(([, n]) => n >= THRESHOLDS.eventPixels).map(([at]) => at.slice(0, 10)),
    ...[...strong].filter(([, sats]) => sats.size >= 2).map(([day]) => day),
  ]);
};

/** A pixel inside the window after a known strike, near it, is a strike pixel. */
const inStrike = (pixel: Detection, strikes: readonly Strike[]): boolean =>
  strikes.some(
    (strike) =>
      pixel.day >= strike.day &&
      msOf(pixel.day) <= msOf(strike.until) + THRESHOLDS.strikeWindowDays * DAY_MS &&
      metres(strike, pixel) <= THRESHOLDS.strikeRadiusMetres,
  );

// ---- marks ----

interface Month {
  readonly month: string;
  /** Nights with an activity pixel; undefined when no stored answer covers the month. */
  readonly nights: number | undefined;
  readonly strikeNights: number;
}

export interface Row {
  readonly asset: Asset;
  readonly method: string;
  readonly mark: string;
  readonly detail: string;
}

export interface ActivityReport {
  readonly lines: readonly string[];
  readonly review: readonly string[];
}

const covers = (
  answers: readonly Answer[],
  point: { latitude: number; longitude: number },
  month: string,
  today: string,
): boolean => {
  const first = `${month}-01`;
  const next = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1));
  const last = dayOf(Math.min(next.getTime() - DAY_MS, msOf(today) - DAY_MS));
  return answers.some(
    ({ box: [w, s, e, n], from, to }) =>
      point.longitude >= w &&
      point.longitude <= e &&
      point.latitude >= s &&
      point.latitude <= n &&
      from <= first &&
      to >= last,
  );
};

const monthsOf = (today: string): string[] => {
  const year = Number(today.slice(0, 4));
  const upto = Number(today.slice(5, 7));
  return Array.from(
    { length: upto },
    (_, at) => `${String(year)}-${String(at + 1).padStart(2, '0')}`,
  );
};

export const buildActivityReport = (input: ActivityInput): ActivityReport => {
  const { today, assets, flares, answers, strikes, operators } = input;
  const pixels = [
    ...new Map(
      answers
        .flatMap((one) => one.detections)
        .map((one) => [
          `${String(one.latitude)} ${String(one.longitude)} ${one.day} ${one.time} ${one.satellite}`,
          one,
        ]),
    ).values(),
  ];
  const near = gridOf(pixels);
  const months = monthsOf(today);
  const review: string[] = [];

  /** Nights with an activity pixel for each month of the year, and nights of strike pixels. */
  const monthsAt = (
    points: readonly { latitude: number; longitude: number }[],
    radius: number,
    keepStatic: boolean,
  ): Month[] => {
    const own = points.flatMap((point) => near(point, radius));
    const events = eventDays(own);
    return months.map((month) => {
      const nights = new Set<string>();
      const struck = new Set<string>();
      for (const pixel of own) {
        if (!pixel.day.startsWith(month) || !pixel.night) continue;
        if (!keepStatic && pixel.type === '2') continue;
        if (inStrike(pixel, strikes)) struck.add(pixel.day);
        else if (!events.has(pixel.day)) nights.add(pixel.day);
      }
      const covered = points.some((point) => covers(answers, point, month, today));
      return { month, nights: covered ? nights.size : undefined, strikeNights: struck.size };
    });
  };

  const cell = (one: Month): string =>
    `${one.month}: ${one.nights === undefined ? 'unread' : String(one.nights)}${one.strikeNights > 0 ? ` (+${String(one.strikeNights)} strike)` : ''}`;
  const summary = (list: readonly Month[]): string => list.map(cell).join(' ');
  const signal = (list: readonly Month[]): boolean => list.some((one) => (one.nights ?? 0) > 0);
  const readAny = (list: readonly Month[]): boolean => list.some((one) => one.nights !== undefined);

  // A flare goes to one field only. Two fields that can claim it send it to review.
  const fields = assets.filter((one) => one.kind === 'field');
  const claimed = new Map<string, Flare[]>();
  const narrow = (list: readonly Asset[], operator: string | undefined): readonly Asset[] => {
    const kept = operator === undefined ? [] : list.filter((one) => one.operators.has(operator));
    return kept.length > 0 ? kept : list;
  };
  let unmatched = 0;
  for (const flare of flares.filter((one) => one.type !== 'LNG')) {
    const operator = operators.get(nameKey(flare.operator));
    const fieldKey = nameKey(flare.field.replace(/\s*\(.*\)\s*/gu, ' '));
    const byName =
      fieldKey === '' ? [] : fields.filter((one) => nameKey(one.label).includes(fieldKey));
    const candidates = narrow(
      byName.length > 0
        ? byName
        : fields.filter((one) => metres(one, flare) <= THRESHOLDS.fieldFlareMetres),
      operator,
    );
    if (candidates.length === 1 && candidates[0] !== undefined)
      claimed.set(candidates[0].id, [...(claimed.get(candidates[0].id) ?? []), flare]);
    else if (candidates.length > 1)
      review.push(
        `flare ${flare.id} (${flare.field}, ${flare.operator}) can belong to: ${candidates.map((one) => one.label).join('; ')}`,
      );
    else unmatched += 1;
  }

  const volume = (list: readonly Flare[], year: number): string =>
    list.reduce((sum, one) => sum + (one.bcm.get(year) ?? 0), 0).toFixed(4);

  const rows: Row[] = assets.flatMap((asset): Row[] => {
    if (asset.kind === 'field') {
      const own = claimed.get(asset.id) ?? [];
      if (own.length === 0)
        return [
          {
            asset,
            method: 'flare volume 2024-2025 and FIRMS 2026 on its flares',
            mark: 'no flare matched',
            detail: '',
          },
        ];
      const list = monthsAt(own, THRESHOLDS.flareRadiusMetres, true);
      const volumes = `bcm 2024 ${volume(own, 2024)}, 2025 ${volume(own, 2025)}`;
      const flared = own.some((one) => (one.bcm.get(2025) ?? 0) > 0);
      return [
        {
          asset,
          method: 'flare volume 2024-2025 and FIRMS 2026 on its flares',
          mark:
            flared || signal(list)
              ? 'flaring'
              : readAny(list)
                ? 'no signal'
                : 'no signal (FIRMS unread)',
          detail: `${String(own.length)} flares; ${volumes}; nights ${summary(list)}`,
        },
      ];
    }
    if (asset.kind === 'lng_plant') {
      const own = flares.filter(
        (one) => one.type === 'LNG' && metres(one, asset) <= THRESHOLDS.lngFlareMetres,
      );
      return [
        {
          asset,
          method:
            'flare volume 2024-2025 of its LNG flares; FIRMS not used (the thresholds fail on a large flare, #530)',
          mark:
            own.length === 0
              ? 'no flare matched'
              : own.some((one) => (one.bcm.get(2025) ?? 0) > 0)
                ? 'flaring'
                : 'no signal',
          detail:
            own.length === 0
              ? ''
              : `${String(own.length)} flares; bcm 2024 ${volume(own, 2024)}, 2025 ${volume(own, 2025)}`,
        },
      ];
    }
    if (asset.kind === 'refinery') {
      const list = monthsAt([asset], THRESHOLDS.refineryRadiusMetres, false);
      return [
        {
          asset,
          method: 'FIRMS nights with a pixel near the site, for each month',
          mark: signal(list) ? 'active' : readAny(list) ? 'no signal' : 'FIRMS unread',
          detail: `nights ${summary(list)}`,
        },
      ];
    }
    return [{ asset, method: 'none (no mark in this spec)', mark: 'no mark', detail: '' }];
  });

  const t = THRESHOLDS;
  const lines = [
    `Activity report of ${today}. Internal. Not a fact of the record.`,
    `Method: field = World Bank flare volume 2024-2025 and FIRMS nights of ${today.slice(0, 4)} on its flares; ` +
      'LNG plant = flare volume of its LNG flares; refinery = FIRMS nights near the site for each month; ' +
      'other kinds have no mark. A flare joins a field by the field name, narrowed by the sure rows of the operator table, ' +
      'then by distance. A flare that two fields can claim goes to review.',
    `Thresholds (#530): hot pixel = night, ${String(t.hotMegawatts)} MW and ${String(t.hotKelvin)} K or more; ` +
      `event = ${String(t.eventPixels)} hot pixels in one overpass, or ${String(t.eventMegawatts)} MW on two satellites the same day (not counted as activity); ` +
      `strike window = ${String(t.strikeWindowDays)} days after a known strike within ${String(t.strikeRadiusMetres)} m (marked as strike, not counted as activity); ` +
      `radius: refinery ${String(t.refineryRadiusMetres)} m, flare ${String(t.flareRadiusMetres)} m; ` +
      `flare to field ${String(t.fieldFlareMetres)} m; LNG flare ${String(t.lngFlareMetres)} m. A pixel of type 2 is left out near a refinery.`,
    `Inputs: ${String(assets.length)} assets, ${String(flares.length)} flare sites, ${String(pixels.length)} pixels, ${String(strikes.length)} strikes, ${String(operators.size)} sure operator names; ${String(unmatched)} flares match no field.`,
    ['asset', 'kind', 'mark', 'method', 'detail'].join('\t'),
    ...rows.map((one) =>
      [one.asset.label, one.asset.kind, one.mark, one.method, one.detail].join('\t'),
    ),
  ];
  return { lines, review };
};

// ---- the record ----

const ASSETS = `SELECT e.id::text AS id, e.label, e.attrs->'asset_kind'->>'v' AS kind,
         ST_Y(e.geom) AS latitude, ST_X(e.geom) AS longitude,
         COALESCE((SELECT array_agg(r.src_id::text) FROM public.relations r
                    WHERE r.type = 'operates' AND r.dst_id = e.id AND r.valid_to IS NULL), '{}') AS operators
    FROM public.entities e
   WHERE e.type = 'facility' AND e.geom IS NOT NULL AND GeometryType(e.geom) = 'POINT'
     AND e.attrs->'asset_kind'->>'v' IS NOT NULL
   ORDER BY e.id`;

const TEXT = `SELECT string_agg(t.text, E'\\n' ORDER BY t.page) AS text FROM public.document_text t
   WHERE t.document_id = $1::text AND t.extractor = $2::text`;

const FIRMS = `SELECT d.uri, string_agg(t.text, E'\\n' ORDER BY t.page) AS text
    FROM public.documents d JOIN public.document_text t ON t.document_id = d.id
   WHERE d.uri LIKE $1 GROUP BY d.uri`;

const assetRows = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    kind: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    operators: z.array(z.string()),
  }),
);

export const readAssets = async (db: Queryable): Promise<Asset[]> =>
  assetRows
    .parse((await db.query(ASSETS, [])).rows)
    .map((row) => ({ ...row, operators: new Set(row.operators) }));

/** The text of a stored document (one text set), or a refusal that names it. */
export const readText = async (db: Queryable, document: string, set: string): Promise<string> => {
  const [row] = z
    .array(z.object({ text: z.string().nullable() }))
    .parse((await db.query(TEXT, [document, set])).rows);
  if (row?.text === undefined || row.text === null)
    throw new Error(`document ${document} holds no set ${set}`);
  return row.text;
};

export const readAnswers = async (db: Queryable): Promise<Answer[]> =>
  z
    .array(z.object({ uri: z.string(), text: z.string() }))
    .parse((await db.query(FIRMS, [`${BASE}/%`])).rows)
    .flatMap((row) => answerOf(row.uri, row.text) ?? []);
