import { readCsv } from '@gab/tools/csv';
import { firmsDetections, NoSourceRefusal, RateLimitRefusal } from '@gab/tools/firms-detections';
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
const within = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));

/** The box of each asset of the record that has a point. A line or an area has no point. */
export const assetSites = async (session: Session): Promise<Site[]> =>
  assetRows.parse((await session.query(ASSETS, [])).rows).map((row) => ({
    name: row.label,
    west: within(round(row.x - ASSET_HALF), 180),
    south: within(round(row.y - ASSET_HALF), 90),
    east: within(round(row.x + ASSET_HALF), 180),
    north: within(round(row.y + ASSET_HALF), 90),
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
    if (west >= 180 || south >= 90) continue;
    tiles.set(`${String(west)},${String(south)}`, {
      name: `flare tile ${String(west)},${String(south)}`,
      west,
      south,
      east: within(west + TILE, 180),
      north: within(south + TILE, 90),
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

/** The runs of days of a period that no stored answer covers. A read of these runs never
 * overlaps a stored document. */
export const gapsOf = (stored: readonly Period[], [from, to]: Period): Period[] => {
  const gaps: Period[] = [];
  let open: string | undefined;
  for (let at = msOf(from); at <= msOf(to); at += DAY_MS) {
    const day = dayOf(at);
    if (stored.some(([a, b]) => a <= day && day <= b)) {
      if (open !== undefined) gaps.push([open, dayOf(at - DAY_MS)]);
      open = undefined;
    } else open ??= day;
  }
  if (open !== undefined) gaps.push([open, to]);
  return gaps;
};

export interface SweepReport {
  /** Answers stored by this run. */
  stored: number;
  /** Complete quarters that stored answers cover already. */
  skipped: number;
  /** Periods that FIRMS or the tool refused, with the sentence of the refusal. */
  failed: string[];
  /** Periods that no FIRMS source holds yet. A later run reads them. */
  pending: number;
  /** True when the run stopped at the rate limit: run it again to go on. */
  stopped: boolean;
  /** The sentence that repeated until the run stopped, as a bad key makes it do. */
  aborted?: string;
}

// A sentence that repeats this many times in a row is a fault of the setup, not of one period.
const REPEATS = 5;

// Known limit: the near real time days that the tail reads are provisional. FIRMS replaces them
// with archive days some months later, and the sweep does not read them again, because a stored
// answer covers the days. Delete the answers of the tail to read them again.
/** Reads every period of every site that no stored answer covers. */
export const sweepFirms = async (
  session: Session,
  reach: Reach,
  sites: readonly Site[],
  since: string,
): Promise<SweepReport> => {
  const report: SweepReport = { stored: 0, skipped: 0, failed: [], pending: 0, stopped: false };
  const today = reach.now().toISOString().slice(0, 10);
  const yesterday = dayOf(msOf(today) - DAY_MS);
  const quarters = quartersOf(since, today);
  const lastEnd = quarters.at(-1)?.[1];
  const sleep = reach.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  let repeated = { sentence: '', count: 0 };

  for (const site of sites) {
    const stored = await storedPeriods(session, site);
    const tailFrom = lastEnd === undefined ? since : dayOf(msOf(lastEnd) + DAY_MS);
    const periods = [...quarters, [tailFrom, yesterday] as Period].flatMap((period, at) => {
      const gaps = gapsOf(stored, period);
      if (gaps.length === 0 && at < quarters.length) report.skipped += 1;
      return gaps;
    });

    for (const [from, to] of periods) {
      for (let attempt = 1; ; attempt += 1) {
        try {
          const made = await firmsDetections.run(session, { ...site, from, to }, reach);
          report.stored += made.status === 'stored' ? 1 : 0;
          repeated = { sentence: '', count: 0 };
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
          if (fault instanceof NoSourceRefusal) {
            report.pending += 1;
            break;
          }
          report.failed.push(`${site.name} ${from} to ${to}: ${fault.message}`);
          repeated =
            repeated.sentence === fault.message
              ? { sentence: fault.message, count: repeated.count + 1 }
              : { sentence: fault.message, count: 1 };
          if (repeated.count >= REPEATS) {
            report.aborted = fault.message;
            return report;
          }
          break;
        }
      }
    }
  }
  return report;
};
