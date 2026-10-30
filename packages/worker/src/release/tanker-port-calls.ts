import { z } from 'zod';

import { attributeOfEntities } from './asset-claims.ts';
import type { ReleaseRecord } from './release-record.ts';

/** A fault in the data that the rebuild reads. The command gives a non-zero exit code for it. */
export class DataFault extends Error {}

// The vessel types of the merged oil tanker rule (panel decision of #1013). A chemical tanker and
// an LNG tanker are not in it.
export const TANKER_TYPES: ReadonlySet<string> = new Set([
  'Crude Oil Tanker',
  'Oil Products Tanker',
  'Chemical/Oil Products Tanker',
  'Bunker Tanker',
  'Bunkering Tanker',
  'Oil Tanker',
  'Products Tanker',
  'Chemical/Oil Tanker',
  'Chemical/Products Tanker',
  'Floating Storage Tanker',
  'Shuttle Tanker',
]);

// The last day of the data. A period counts for a vessel only when it ends on or before this day.
export const DATA_END = '2026-10-26';
export const FIRST_PERIOD = -6;
export const LAST_PERIOD = 16;
const PERIOD_DAYS = 30;

const EU = new Set(
  (
    'AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU ' +
    'SVK SVN ESP SWE'
  ).split(' '),
);
export const REGIONS = ['EU', 'Russia', 'China', 'Turkey', 'India', 'other'] as const;
export type Region = (typeof REGIONS)[number];

/** The region of the ISO 3166 alpha-3 country of an anchorage. */
export const regionOf = (country: string): Region => {
  if (EU.has(country)) return 'EU';
  if (country === 'RUS') return 'Russia';
  if (country === 'CHN') return 'China';
  if (country === 'TUR') return 'Turkey';
  if (country === 'IND') return 'India';
  return 'other';
};

export interface Tanker {
  readonly imo: string;
  /** The first dated designation, as a day. */
  readonly j0: string;
}

export interface PortCall {
  readonly eventId: string;
  readonly vesselId: string;
  readonly day: string;
  readonly country: string;
}

export interface Period {
  readonly m: number;
  readonly counted: number;
  readonly seen: number;
  readonly pairs: Readonly<Record<Region, number>>;
  readonly pairTotal: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/u;

const dayNumber = (day: string): number => {
  if (!DAY.test(day)) throw new DataFault(`"${day}" is not a day.`);
  return Date.parse(`${day}T00:00:00Z`) / 86_400_000;
};

/** The tanker set of the record: each vessel with a type of the rule and a dated `designated_by`
 * relation, once for each IMO number. The first dated relation gives J0. A vessel with no IMO
 * number is not in the set. When two vessels hold one IMO number, the earlier J0 stays. */
export const tankerSet = (record: ReleaseRecord): readonly Tanker[] => {
  const types = attributeOfEntities(record, 'vessel_type');
  const imos = attributeOfEntities(record, 'imo');
  const firstDay = new Map<string, string>();
  for (const one of record.relations) {
    if (one.type !== 'designated_by' || one.valid_from === null) continue;
    const known = firstDay.get(one.src_id);
    if (known === undefined || one.valid_from < known) firstDay.set(one.src_id, one.valid_from);
  }
  const byImo = new Map<string, string>();
  for (const [id, type] of types) {
    const imo = imos.get(id);
    const j0 = firstDay.get(id);
    if (typeof type !== 'string' || !TANKER_TYPES.has(type)) continue;
    if (typeof imo !== 'string' || j0 === undefined) continue;
    const known = byImo.get(imo);
    if (known === undefined || j0 < known) byImo.set(imo, j0);
  }
  return [...byImo].map(([imo, j0]) => ({ imo, j0 })).sort((a, b) => a.imo.localeCompare(b.imo));
};

/** The file of the GFW vessel ids of each IMO number: a header `imo,vessel_id` and one line for
 * each pair. An IMO number can have more than one vessel id (one for each AIS identity). */
export const idsOfImo = (text: string): ReadonlyMap<string, readonly string[]> => {
  const [header, ...lines] = (text.codePointAt(0) === 0xfeff ? text.slice(1) : text)
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== '');
  if (header?.trim() !== 'imo,vessel_id')
    throw new DataFault('The mapping file must start with the header "imo,vessel_id".');
  const ids = new Map<string, string[]>();
  const owner = new Map<string, string>();
  for (const line of lines) {
    const [imo, vesselId, ...rest] = line.split(',').map((cell) => cell.trim());
    if (imo === undefined || vesselId === undefined || rest.length > 0 || !/^\d{7}$/u.test(imo))
      throw new DataFault(`The mapping line "${line}" is not an IMO number and a vessel id.`);
    if (vesselId === '') throw new DataFault(`The mapping line "${line}" has no vessel id.`);
    const known = owner.get(vesselId);
    if (known !== undefined && known !== imo)
      throw new DataFault(
        `The vessel id ${vesselId} is mapped to the IMO numbers ${known} and ${imo}.`,
      );
    owner.set(vesselId, imo);
    ids.set(imo, [...new Set([...(ids.get(imo) ?? []), vesselId])]);
  }
  return ids;
};

const eventsShape = z.object({
  metadata: z.object({ vessels: z.array(z.string()).default([]) }).default({ vessels: [] }),
  entries: z.array(z.unknown()).default([]),
});
const entryShape = z.object({
  id: z.string().min(1),
  type: z.string(),
  start: z.string().nullish(),
  vessel: z.object({ id: z.string().min(1) }).nullish(),
  port_visit: z
    .object({
      startAnchorage: z.object({ id: z.string().nullish(), flag: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

/** The vessel ids that one stored GFW answer asked for, and its port visits (the JSON text of the
 * document). Another type of event is skipped. A port visit with no vessel id, no start day or no anchorage country is a fault. */
export const portCallsOf = (
  text: string,
  document: string,
): { readonly vessels: readonly string[]; readonly calls: readonly PortCall[] } => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DataFault(`The text of document ${document} is not JSON.`);
  }
  const answer = eventsShape.safeParse(json);
  if (!answer.success) throw new DataFault(`Document ${document} is not a GFW events answer.`);
  const calls = answer.data.entries.flatMap((raw): PortCall[] => {
    const entry = entryShape.safeParse(raw);
    if (!entry.success)
      throw new DataFault(`Document ${document} holds an event of a wrong shape.`);
    const { id, type, start, vessel, port_visit: visit } = entry.data;
    if (type !== 'port_visit') return [];
    const country = visit?.startAnchorage?.flag;
    if (
      vessel === null ||
      vessel === undefined ||
      start === null ||
      start === undefined ||
      !country
    )
      throw new DataFault(
        `Port visit ${id} of document ${document} has no vessel, day or country.`,
      );
    return [{ eventId: id, vesselId: vessel.id, day: start.slice(0, 10), country }];
  });
  return { vessels: answer.data.metadata.vessels, calls };
};

/** The values of the two panels for the periods -6 to +16. A vessel counts at a period only when
 * the whole period ends on or before `end`. Panel A is the vessels with a port call in the period
 * over the vessels counted. Panel B is the distinct (vessel, region) pairs of each region over all
 * the pairs of the period. A call counts once for its event identifier. A vessel with no vessel id
 * is counted and has no call. */
export const tankerPeriods = (
  tankers: readonly Tanker[],
  ids: ReadonlyMap<string, readonly string[]>,
  calls: readonly PortCall[],
  end: string = DATA_END,
): readonly Period[] => {
  const imoOfId = new Map<string, string>();
  for (const tanker of tankers)
    for (const id of ids.get(tanker.imo) ?? []) imoOfId.set(id, tanker.imo);
  const j0Of = new Map(tankers.map((one) => [one.imo, dayNumber(one.j0)]));
  const seenEvents = new Set<string>();
  // The distinct (vessel, region) pairs of each period, as "m|imo|region".
  const pairs = new Set<string>();
  const callers = new Set<string>();
  for (const call of calls) {
    const imo = imoOfId.get(call.vesselId);
    if (imo === undefined || seenEvents.has(call.eventId)) continue;
    seenEvents.add(call.eventId);
    const m = Math.floor((dayNumber(call.day) - (j0Of.get(imo) ?? 0)) / PERIOD_DAYS);
    if (m < FIRST_PERIOD || m > LAST_PERIOD) continue;
    callers.add(`${String(m)}|${imo}`);
    pairs.add(`${String(m)}|${imo}|${regionOf(call.country)}`);
  }
  const last = dayNumber(end);
  return Array.from({ length: LAST_PERIOD - FIRST_PERIOD + 1 }, (_, at): Period => {
    const m = FIRST_PERIOD + at;
    const counted = tankers.filter(
      (one) => (j0Of.get(one.imo) ?? 0) + PERIOD_DAYS * m + PERIOD_DAYS - 1 <= last,
    );
    const inPeriod = new Set(counted.map((one) => one.imo));
    const count = (region: Region): number =>
      [...pairs].filter((key) => {
        const [pm, imo, one] = key.split('|');
        return pm === String(m) && one === region && inPeriod.has(imo ?? '');
      }).length;
    const byRegion = Object.fromEntries(REGIONS.map((one) => [one, count(one)])) as Record<
      Region,
      number
    >;
    return {
      m,
      counted: counted.length,
      seen: counted.filter((one) => callers.has(`${String(m)}|${one.imo}`)).length,
      pairs: byRegion,
      pairTotal: REGIONS.reduce((sum, one) => sum + byRegion[one], 0),
    };
  });
};

/** A share of a total in percent with one decimal, or an empty text when the total is 0. */
export const percent = (part: number, total: number): string =>
  total === 0 ? '' : ((100 * part) / total).toFixed(1);

// The values of the calculation of the author on the five exact types (502 vessels), for the
// comparison. They are the figures of the comment of 30 October 2026 on #1013.
const PREVIOUS: readonly (readonly [string, number, string])[] = [
  ['A', -6, '36.1'],
  ['A', 0, '27.7'],
  ['A', 6, '14.0'],
  ['A', 16, '9.5'],
  ['B Russia', -6, '35.8'],
  ['B Russia', 6, '53.2'],
  ['B EU', -6, '4.5'],
];

const valueOf = (period: Period, series: string): string =>
  series === 'A'
    ? percent(period.seen, period.counted)
    : percent(period.pairs[series === 'B Russia' ? 'Russia' : 'EU'], period.pairTotal);

/** The lines that put the previous values next to the new ones. */
export const comparisonLines = (periods: readonly Period[]): readonly string[] => [
  'series\tperiod\tprevious (502 vessels)\tnew',
  ...PREVIOUS.map(([series, m, before]) => {
    const period = periods.find((one) => one.m === m);
    return `${series}\t${m > 0 ? '+' : ''}${String(m)}\t${before}\t${period === undefined ? '' : valueOf(period, series)}`;
  }),
];

/** The CSV rows of the values, one for each period, with the header. */
export const csvHeader = [
  'period',
  'vessels_counted',
  'a_vessels_seen',
  'a_percent',
  'b_pairs',
  ...REGIONS.map((one) => `b_percent_${one}`),
] as const;

export const csvRow = (period: Period): readonly string[] => [
  `${period.m > 0 ? '+' : ''}${String(period.m)}`,
  String(period.counted),
  String(period.seen),
  percent(period.seen, period.counted),
  String(period.pairTotal),
  ...REGIONS.map((one) => percent(period.pairs[one], period.pairTotal)),
];

/** The limits of the figure, as the comment of 30 October 2026 on #1013 states them. */
export const LIMITS: readonly string[] = [
  'AIS only: a tanker that changes its AIS identity leaves the follow-up by IMO number. The fall in panel A is a floor of what is seen. It does not measure what the tankers do.',
  'A tanker with no port call on either side of J0 has no call in panel B.',
  'After +10 months a period holds few calls (the figure of 30 October counted fewer than 70 a month): read the shares with care.',
  'Russian loadings are not observable: AIS gives port calls and no cargo.',
  'A tanker with no GFW vessel id is counted in panel A with no call.',
];
