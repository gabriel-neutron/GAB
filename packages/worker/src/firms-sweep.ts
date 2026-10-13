import { readCsv } from '@gab/tools/csv';
import { firmsDetections, RateLimitRefusal } from '@gab/tools/firms-detections';
import { ToolRefusal, type Reach, type Session } from '@gab/tools/tool';
import { z } from 'zod';

// The sweep reads the NASA FIRMS heat of every site since a start day, one stored answer for each
// site and quarter, and then the days since the last answer (the daily run is the same command).
// A period is done when stored answers cover all its days, so a run that stops starts again where
// it stopped. The rate limit is the limit of the tool: this code only waits and tries again.

const BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const DAY_MS = 86_400_000;
// External constraint: the map key gets its transactions back after ten minutes.
const WAIT_MS = 600_000;
const TRIES = 6;
// Assumptions of the first build. A point asset gets a box of 0.1 degree. A flare tile is 0.5
// degree wide, so it stays below the one square degree of the tool.
const ASSET_HALF = 0.05;
const TILE = 0.5;

export interface Site {
  readonly name: string;
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

const ASSETS = `SELECT e.label, ST_X(e.geom) AS x, ST_Y(e.geom) AS y FROM public.entities e
  WHERE e.type = 'facility' AND e.geom IS NOT NULL AND GeometryType(e.geom) = 'POINT'
  ORDER BY e.id`;

const FLARES = `SELECT t.text FROM public.document_text t
  WHERE t.document_id = $1::text AND t.extractor = $2::text AND t.page = 1`;

const URIS = `SELECT d.uri FROM public.documents d WHERE d.uri LIKE $1`;

const assetRows = z.array(z.object({ label: z.string(), x: z.number(), y: z.number() }));
const textRows = z.array(z.object({ text: z.string() }));
const uriRows = z.array(z.object({ uri: z.string() }));

const round = (value: number): number => Number(value.toFixed(4));

/** The box of each asset of the record that has a point. A line or an area has no point. */
export const assetSites = async (session: Session): Promise<Site[]> =>
  assetRows.parse((await session.query(ASSETS, [])).rows).map((row) => ({
    name: row.label,
    west: round(row.x - ASSET_HALF),
    south: round(row.y - ASSET_HALF),
    east: round(row.x + ASSET_HALF),
    north: round(row.y + ASSET_HALF),
  }));

/** The tiles that hold at least one flare of a stored flare table (a text set of a document). */
export const flareSites = async (
  session: Session,
  table: { document: string; set: string; latitude: string; longitude: string },
): Promise<Site[]> => {
  const [held] = textRows.parse((await session.query(FLARES, [table.document, table.set])).rows);
  if (held === undefined) throw new Error(`document ${table.document} holds no set ${table.set}`);
  const [head, ...rows] = readCsv(held.text);
  const lat = head?.fields.indexOf(table.latitude) ?? -1;
  const lon = head?.fields.indexOf(table.longitude) ?? -1;
  if (lat < 0 || lon < 0) throw new Error('the flare table has no latitude or longitude column');
  const tiles = new Map<string, Site>();
  for (const row of rows) {
    const y = Number(row.fields[lat]);
    const x = Number(row.fields[lon]);
    if (row.fields[lat] === '' || row.fields[lon] === '' || !Number.isFinite(x + y)) continue;
    const west = Math.floor(x / TILE) * TILE;
    const south = Math.floor(y / TILE) * TILE;
    tiles.set(`${String(west)},${String(south)}`, {
      name: `flare tile ${String(west)},${String(south)}`,
      west,
      south,
      east: west + TILE,
      north: south + TILE,
    });
  }
  return [...tiles.values()];
};

const boxOf = (site: Site): string =>
  `${String(site.west)},${String(site.south)},${String(site.east)},${String(site.north)}`;
const msOf = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The complete quarters from the start day to the day before `today`. */
export const quartersOf = (since: string, today: string): [string, string][] => {
  const out: [string, string][] = [];
  const first = new Date(msOf(since));
  let year = first.getUTCFullYear();
  let quarter = Math.floor(first.getUTCMonth() / 3);
  for (;;) {
    const start = Date.UTC(year, quarter * 3, 1);
    const end = Date.UTC(year, quarter * 3 + 3, 0);
    if (dayOf(end) >= today) return out;
    // The first quarter starts on the start day when that day is inside it.
    out.push([dayOf(Math.max(start, msOf(since))), dayOf(end)]);
    quarter += 1;
    if (quarter === 4) [year, quarter] = [year + 1, 0];
  }
};

type Period = [from: string, to: string];

/** The stored answers of a box, as periods. The synthetic address names the box and the days. */
const storedPeriods = async (session: Session, site: Site): Promise<Period[]> => {
  const prefix = `${BASE}/${boxOf(site)}/`;
  const rows = uriRows.parse((await session.query(URIS, [`${prefix}%`])).rows);
  return rows.flatMap((row) => {
    const [from = '', to = ''] = row.uri.slice(prefix.length).split('/');
    return Number.isNaN(msOf(from)) || Number.isNaN(msOf(to)) ? [] : [[from, to] as Period];
  });
};

const covered = (stored: readonly Period[], [from, to]: Period): boolean => {
  for (let at = msOf(from); at <= msOf(to); at += DAY_MS) {
    const day = dayOf(at);
    if (!stored.some(([a, b]) => a <= day && day <= b)) return false;
  }
  return true;
};

export interface SweepReport {
  /** Answers stored by this run. */
  stored: number;
  /** Periods that stored answers cover already. */
  skipped: number;
  /** Periods that FIRMS or the tool refused, with the sentence of the refusal. */
  failed: string[];
  /** True when the run stopped at the rate limit: run it again to go on. */
  stopped: boolean;
}

/** Reads every period of every site that no stored answer covers. */
export const sweepFirms = async (
  session: Session,
  reach: Reach,
  sites: readonly Site[],
  since: string,
): Promise<SweepReport> => {
  const report: SweepReport = { stored: 0, skipped: 0, failed: [], stopped: false };
  const today = reach.now().toISOString().slice(0, 10);
  const yesterday = dayOf(msOf(today) - DAY_MS);
  const quarters = quartersOf(since, today);
  const lastEnd = quarters.at(-1)?.[1];
  const sleep = reach.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));

  for (const site of sites) {
    const stored = await storedPeriods(session, site);
    const latest = stored
      .map(([, to]) => to)
      .sort()
      .at(-1);
    // The tail starts after the last answer and after the last complete quarter, so it never reads
    // a day of a quarter twice.
    const next = (day: string | undefined): string =>
      day === undefined ? since : dayOf(msOf(day) + DAY_MS);
    const tailFrom = [next(latest), next(lastEnd)].sort().at(-1) ?? since;
    const periods: Period[] = quarters.filter((period) => !covered(stored, period));
    report.skipped += quarters.length - periods.length;
    if (tailFrom <= yesterday) periods.push([tailFrom, yesterday]);

    for (const [from, to] of periods) {
      for (let attempt = 1; ; attempt += 1) {
        try {
          const made = await firmsDetections.run(
            session,
            { west: site.west, south: site.south, east: site.east, north: site.north, from, to },
            reach,
          );
          report.stored += made.status === 'stored' ? 1 : 0;
          break;
        } catch (fault) {
          if (fault instanceof RateLimitRefusal && attempt < TRIES) {
            await sleep(WAIT_MS);
            continue;
          }
          if (fault instanceof RateLimitRefusal) {
            report.stopped = true;
            return report;
          }
          if (!(fault instanceof ToolRefusal)) throw fault;
          report.failed.push(`${site.name} ${from} to ${to}: ${fault.message}`);
          break;
        }
      }
    }
  }
  return report;
};
