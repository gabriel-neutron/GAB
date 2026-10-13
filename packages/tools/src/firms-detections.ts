import { z } from 'zod';

import { storeRegister } from './register-answer.ts';
import { defineTool, ToolRefusal, type Reach } from './tool.ts';
import { day } from './vessel-events.ts';
import { anyAnswerOf, UpstreamFault, webFromReach } from './web-access.ts';

const BASE = 'https://firms.modaps.eosdis.nasa.gov';
const REGISTER = 'NASA FIRMS';

// External constraint of the FIRMS API: one area call covers 1 to 5 days.
const WINDOW_DAYS = 5;
// Assumptions of the first build, each one a constant. A site is a refinery or a terminal, so a
// box above one square degree is a region. A period above one year is a plan of hundreds of calls.
const MAX_AREA_DEGREES = 1;
const MAX_PERIOD_DAYS = 366;
// The transactions of the map key that stay unspent in the interval of ten minutes.
const RESERVE = 100;
const DAY_MS = 86_400_000;

/** A refusal that a wait of ten minutes cures: the map key is near its rate limit. */
export class RateLimitRefusal extends ToolRefusal {}

/** A refusal because no FIRMS source holds a day of the period yet. A later run may succeed. */
export class NoSourceRefusal extends ToolRefusal {}

const SOURCE_ID = /^(VIIRS_[A-Z0-9]+)_(SP|NRT)$/u;

// Assumption: the status answer of a map key is JSON with these two numbers. Not checked against
// a live call.
const statusAnswer = z.object({
  transaction_limit: z.number(),
  current_transactions: z.number(),
});

interface Source {
  readonly id: string;
  readonly satellite: string;
  /** True for the archive (standard processing) source. */
  readonly archive: boolean;
  readonly min: string;
  readonly max: string;
}

interface Window {
  readonly source: string;
  readonly start: string;
  readonly days: number;
}

const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const msOf = (value: string): number => Date.parse(`${value}T00:00:00Z`);

// A path holds the key. The sentence of a fault never holds the path.
const get = async (reach: Reach | undefined, path: string, key: string): Promise<string> => {
  let answer;
  try {
    answer = await anyAnswerOf(
      webFromReach(reach),
      `${BASE}${path.replace('{key}', () => encodeURIComponent(key))}`,
      {
        headers: { accept: 'text/csv, application/json' },
      },
    );
  } catch (fault) {
    if (fault instanceof UpstreamFault) throw new ToolRefusal(`${REGISTER}: ${fault.message}`);
    throw fault;
  }
  if (answer.status === 429) throw new RateLimitRefusal(`${REGISTER} answered 429`);
  if (answer.status < 200 || answer.status > 299)
    throw new ToolRefusal(`${REGISTER} answered ${String(answer.status)}`);
  return answer.body;
};

/** The dates of each VIIRS source, as FIRMS gives them. A line of another shape is skipped.
 * Assumption: the availability answer is a CSV with the columns data_id, min_date, max_date. Not
 * checked against a live call. */
export const sourcesOf = (body: string): Source[] =>
  body
    .split(/\r?\n/u)
    .map((line) => line.split(','))
    .flatMap(([id = '', min = '', max = '']) => {
      const found = SOURCE_ID.exec(id.trim());
      if (found === null || Number.isNaN(msOf(min)) || Number.isNaN(msOf(max))) return [];
      return [{ id: id.trim(), satellite: found[1] ?? '', archive: found[2] === 'SP', min, max }];
    });

/** For each satellite and each day, the archive source when it holds the day, else the near real
 * time source. A run of days of one source is cut into windows that FIRMS permits. */
export const windowsOf = (
  sources: readonly Source[],
  from: string,
  to: string,
): { windows: Window[]; uncovered: number } => {
  const windows: Window[] = [];
  const covered = new Set<number>();
  for (const satellite of new Set(sources.map((source) => source.satellite))) {
    const ranked = sources
      .filter((source) => source.satellite === satellite)
      .sort((a, b) => Number(b.archive) - Number(a.archive));
    let run: { source: string; start: number; days: number } | undefined;
    const close = () => {
      if (run !== undefined)
        windows.push({ source: run.source, start: dayOf(run.start), days: run.days });
      run = undefined;
    };
    for (let at = msOf(from); at <= msOf(to); at += DAY_MS) {
      const today = dayOf(at);
      const source = ranked.find((entry) => entry.min <= today && today <= entry.max);
      if (source === undefined) {
        close();
        continue;
      }
      covered.add(at);
      if (run?.source === source.id && run.days < WINDOW_DAYS) run.days += 1;
      else {
        close();
        run = { source: source.id, start: at, days: 1 };
      }
    }
    close();
  }
  return { windows, uncovered: (msOf(to) - msOf(from)) / DAY_MS + 1 - covered.size };
};

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  sources: z.array(z.string()),
  calls: z.number().int(),
  detections: z.number().int(),
  /** The days of the period that no VIIRS source holds, counted for each satellite as a day
   * that at least one satellite holds is covered. */
  uncoveredDays: z.number().int(),
  transactions: z.strictObject({ limit: z.number(), before: z.number(), after: z.number() }),
});

const rowsOf = (csv: string): number =>
  csv.split(/\r?\n/u).filter((line) => line !== '').length - 1;

export const firmsDetections = defineTool({
  name: 'firms_detections',
  description:
    'Reads the NASA FIRMS heat detections of the VIIRS satellites in the box of one site, ' +
    'between two dates. The tool reads the dates of each FIRMS source, uses the archive source ' +
    'where it holds a day and the near real time source after it, cuts the period into windows ' +
    'of five days, and stores one answer for the site and the period as a document. The box is ' +
    'west, south, east and north in degrees, and is at most one square degree. The tool needs a ' +
    'free map key: with no key set, it refuses and names the setting. The stored address holds ' +
    'no key.',
  input: z
    .strictObject({
      west: z.number().min(-180).max(180),
      south: z.number().min(-90).max(90),
      east: z.number().min(-180).max(180),
      north: z.number().min(-90).max(90),
      from: day,
      to: day,
    })
    .refine((input) => input.west < input.east && input.south < input.north, {
      error: 'a box has west below east and south below north',
    })
    .refine((input) => input.from <= input.to, { error: 'from comes before to' }),
  output: outputShape,
  async run(session, input, reach) {
    const key = webFromReach(reach).firmsKey ?? '';
    if (key === '')
      throw new ToolRefusal(
        'firms_detections needs a map key: set FIRMS_MAP_KEY in the research workspace',
      );
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');
    const area = (input.east - input.west) * (input.north - input.south);
    if (area > MAX_AREA_DEGREES)
      throw new ToolRefusal(
        `this box is ${area.toFixed(2)} square degrees, and a site is at most ` +
          `${String(MAX_AREA_DEGREES)}: a larger box returns the heat of a region and not of ` +
          'one site. Give the box of the site.',
      );
    if ((msOf(input.to) - msOf(input.from)) / DAY_MS + 1 > MAX_PERIOD_DAYS)
      throw new ToolRefusal(
        `the period is above ${String(MAX_PERIOD_DAYS)} days: read it in parts`,
      );

    const availability = await get(reach, '/api/data_availability/csv/{key}/ALL', key);
    const sources = sourcesOf(availability);
    if (sources.length === 0 && availability.trim() !== '')
      throw new ToolRefusal(`${REGISTER}: availability not understood`);
    // The period ends at the last day that a source holds, so the stored address never claims a
    // day that FIRMS has not published. A later call reads the rest.
    const last = sources
      .map((source) => source.max)
      .sort()
      .at(-1);
    const until = last !== undefined && last < input.to ? last : input.to;
    const { windows, uncovered } = windowsOf(sources, input.from, until);
    if (windows.length === 0)
      throw new NoSourceRefusal(
        'no VIIRS source of FIRMS holds a day of this period; the sources hold ' +
          sources.map((source) => `${source.id} ${source.min} to ${source.max}`).join(', '),
      );

    // Assumptions: one area call costs one transaction, and a status call costs none. The
    // availability call is not counted in the plan because it is one call and the reserve covers
    // it. The status is read after each window, so that a window that costs more than one
    // transaction stops the run in time.
    const status = async () => {
      let json: unknown;
      try {
        json = JSON.parse(await get(reach, '/mapserver/mapkey_status/?MAP_KEY={key}', key));
      } catch (fault) {
        if (fault instanceof ToolRefusal) throw fault;
        json = null;
      }
      const found = statusAnswer.safeParse(json);
      if (!found.success)
        throw new ToolRefusal(`${REGISTER} gave a status that this tool does not read`);
      return { limit: found.data.transaction_limit, used: found.data.current_transactions };
    };
    const before = await status();
    const left = before.limit - before.used;
    if (left < windows.length + RESERVE)
      throw new RateLimitRefusal(
        `${String(windows.length)} calls are needed and the map key has ${String(left)} ` +
          'transactions left in this interval: try again in ten minutes, or read a shorter period',
      );

    const box = `${String(input.west)},${String(input.south)},${String(input.east)},${String(input.north)}`;
    const answers: (Window & { csv: string })[] = [];
    let after = before;
    // A stop in the middle of the run stores nothing: a partial answer would look whole.
    for (const window of windows) {
      if (after.limit - after.used < RESERVE)
        throw new RateLimitRefusal(
          'stopped before the rate limit of the map key, and nothing is stored: try again in ten minutes',
        );
      const csv = await get(
        reach,
        `/api/area/csv/{key}/${window.source}/${box}/${String(window.days)}/${window.start}`,
        key,
      );
      if (!csv.startsWith('latitude,'))
        throw new ToolRefusal(`${REGISTER} gave an answer that is not a table of detections`);
      answers.push({ ...window, csv });
      after = await status();
    }

    // The stored address is synthetic: it names the box and the period, not a call of FIRMS, and
    // it has no key segment.
    const body = JSON.stringify({ box, from: input.from, to: until, windows: answers });
    const stored = await storeRegister(
      session,
      reach,
      {
        url: `${BASE}/api/area/csv/${box}/${input.from}/${until}`,
        register: REGISTER,
        title: `NASA FIRMS VIIRS detections in the box ${box} from ${input.from} to ${until}`,
      },
      { body, json: null },
    );
    return {
      ...stored,
      sources: [...new Set(windows.map((window) => window.source))],
      calls: windows.length,
      detections: answers.reduce((sum, answer) => sum + rowsOf(answer.csv), 0),
      uncoveredDays: uncovered,
      transactions: { limit: before.limit, before: before.used, after: after.used },
    };
  },
});
