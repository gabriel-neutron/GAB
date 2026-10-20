import { isDay } from '@gab/proposal/day';
import { sentinel2Pairs } from '@gab/tools/sentinel2-pairs';
import type { Reach, Session } from '@gab/tools/tool';
import { z } from 'zod';

// The accepted strikes of the record that have a day and a site point, and the run of the tool
// sentinel2_pairs over them. The tool stores the images. This code reads the strikes and counts.

// Origin of the number: decided, not calibrated. One call to the tool makes at most 100 strikes,
// and a batch of 20 keeps a stop (a limit of the service) from losing the counts of many strikes.
const BATCH = 20;

export interface Strike {
  readonly ref: string;
  readonly day: string;
  readonly until: string;
  readonly latitude: number;
  readonly longitude: number;
}

// An accepted strike is an entity of type event with the kind "claimed attack", linked by
// occurred_at to a facility that has a point.
const STRIKES = `SELECT e.id::text AS id, e.attrs->'occurred_on'->'v' AS days,
         ST_Y(s.geom) AS latitude, ST_X(s.geom) AS longitude
    FROM public.entities e
    JOIN public.relations r ON r.type = 'occurred_at' AND r.src_id = e.id
    JOIN public.entities s ON s.id = r.dst_id AND s.type = 'facility'
   WHERE e.type = 'event' AND e.attrs->'event_kind'->>'v' = 'claimed attack'
     AND s.geom IS NOT NULL AND GeometryType(s.geom) = 'POINT'
   ORDER BY e.id`;

const rows = z.array(
  z.object({
    id: z.string(),
    days: z.union([z.string(), z.array(z.string())]).nullable(),
    latitude: z.number(),
    longitude: z.number(),
  }),
);

export interface Strikes {
  readonly strikes: Strike[];
  /** The strikes that the record holds with no full day (a month, or no day) or no usable point. */
  readonly skipped: number;
}

/** The accepted strikes with a full day and a site point. A night gives two days. */
export const strikesOf = async (session: Session): Promise<Strikes> => {
  const strikes: Strike[] = [];
  let skipped = 0;
  for (const row of rows.parse((await session.query(STRIKES, [])).rows)) {
    const days = row.days === null ? [] : typeof row.days === 'string' ? [row.days] : row.days;
    const first = days.at(0);
    const last = days.at(-1);
    if (
      first === undefined ||
      last === undefined ||
      !isDay(first) ||
      !isDay(last) ||
      first > last ||
      Math.abs(row.latitude) > 85
    ) {
      skipped += 1;
      continue;
    }
    strikes.push({
      ref: row.id,
      day: first,
      until: last,
      latitude: row.latitude,
      longitude: row.longitude,
    });
  }
  return { strikes, skipped };
};

export interface PairsReport {
  pair: number;
  one: number;
  none: number;
  error: number;
  /** One line for each strike that has no pair: the notes of the tool, or the fault. */
  lines: string[];
  /** The sentence of a stop: the access to the service refused the run. */
  stopped?: string;
}

/** Runs the tool over the strikes in batches. A refusal of the access stops the run and keeps the
 * counts of the batches that finished. */
export const pairStrikes = async (
  session: Session,
  reach: Reach,
  strikes: readonly Strike[],
  settings: { halfWidthMetres?: number; maxCloud?: number } = {},
): Promise<PairsReport> => {
  const report: PairsReport = { pair: 0, one: 0, none: 0, error: 0, lines: [] };
  for (let at = 0; at < strikes.length; at += BATCH) {
    try {
      const made = await sentinel2Pairs.run(
        session,
        {
          strikes: strikes.slice(at, at + BATCH).map((one) => ({
            ref: one.ref,
            day: one.day,
            until: one.until,
            latitude: one.latitude,
            longitude: one.longitude,
          })),
          halfWidthMetres: settings.halfWidthMetres ?? 2500,
          maxCloud: settings.maxCloud ?? 0.2,
        },
        reach,
      );
      report.pair += made.pair;
      report.one += made.one;
      report.none += made.none;
      report.error += made.error;
      for (const result of made.results)
        if (result.outcome !== 'pair')
          report.lines.push(`${result.ref}: ${result.error ?? result.notes.join('; ')}`);
    } catch (fault) {
      report.stopped = fault instanceof Error ? fault.message : 'the run stopped';
      return report;
    }
  }
  return report;
};
