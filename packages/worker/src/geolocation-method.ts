import { NOT_STATED, type GeolocationMethod } from '@gab/proposal/geolocation-method';
import { geolocationMethodOf, type PlaceSource } from '@gab/tools/geolocation-method';
import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// Departure: one command, one job. A place stored before the methods of geolocation holds
// `not_stated`. This module reads the documents that gave each such place and names a method only
// when each document states it clearly (the rules of the tool). It writes through one door that
// changes a place only while it holds `not_stated`, so a method that an act set stays. A place
// whose documents are unclear stays `not_stated`, and that is a true value.

// The documents of the accepted act that gave the place that the entity holds now: an update of
// the entity or the act that made it, with an equal geometry. An entity that no act gave keeps the
// documents of its row.
const PLACES = `SELECT e.id::text AS id, e.label,
  coalesce(
    (SELECT array_agg(DISTINCT a.doc)
       FROM public.proposals u
      CROSS JOIN LATERAL unnest(
        CASE WHEN u.op = 'create_entity' AND u.payload ? 'sources'
             THEN ARRAY(SELECT jsonb_array_elements_text(u.payload->'sources'))
             ELSE u.src::text[] END) AS a(doc)
      WHERE u.status = 'accepted' AND u.payload ? 'geom'
        AND ((u.op = 'update_entity' AND u.target_kind = 'entity' AND u.target_id = e.id)
             OR (u.op = 'create_entity' AND u.id = e.promoted_from))
        AND public.ST_Equals(e.geom, public.ST_SetSRID(
              public.ST_GeomFromGeoJSON(u.payload->'geom'), 4326))),
    e.sources::text[]) AS docs
  FROM public.entities e
 WHERE e.geom IS NOT NULL AND e.geom_method = 'not_stated'
 ORDER BY e.id`;

const DOCUMENTS = `SELECT d.id::text AS id, d.title, d.uri, d.provider_id
  FROM public.documents d ORDER BY d.id`;

const SET_METHOD = 'SELECT public.fill_geolocation_method($1::uuid, $2) AS done';

const placeRow = z.object({ id: z.uuid(), label: z.string(), docs: z.array(z.string()) });
const documentRow = z.object({
  id: z.string(),
  title: z.string(),
  uri: z.string().nullable(),
  provider_id: z.string().nullable(),
});

export interface MethodChange {
  readonly entity: string;
  readonly label: string;
  readonly method: GeolocationMethod;
}

export interface MethodReport {
  readonly dryRun: boolean;
  /** The places that held `not_stated`. */
  readonly read: number;
  readonly changes: readonly MethodChange[];
}

/** Names the method of each stored place that holds `not_stated` and whose documents state it
 * clearly. A dry run writes nothing. */
export const fillGeolocationMethods = async (
  db: Queryable,
  dryRun: boolean,
): Promise<MethodReport> => {
  const places = z.array(placeRow).parse((await db.query(PLACES)).rows);
  const documents = new Map(
    z
      .array(documentRow)
      .parse((await db.query(DOCUMENTS)).rows)
      .map((one) => [one.id, one] as const),
  );
  const changes: MethodChange[] = [];
  for (const place of places) {
    const sources: PlaceSource[] = place.docs.flatMap((id) => {
      const held = documents.get(id);
      return held === undefined
        ? []
        : [{ uri: held.uri, title: held.title, provider: held.provider_id }];
    });
    // A document that the record lost counts as a document that no rule knows.
    const method = sources.length === place.docs.length ? geolocationMethodOf(sources) : NOT_STATED;
    if (method !== NOT_STATED) changes.push({ entity: place.id, label: place.label, method });
  }
  if (!dryRun) for (const one of changes) await db.query(SET_METHOD, [one.entity, one.method]);
  return { dryRun, read: places.length, changes };
};

/** The lines that the command prints. */
export const methodReportLines = (report: MethodReport): string[] => {
  const will = report.dryRun ? 'would set' : 'set';
  const lines = report.changes.map(
    (one) => `${will} the method of ${one.entity} (${one.label}) to ${one.method}`,
  );
  lines.push(
    `${report.dryRun ? 'Dry run: ' : ''}${String(report.read)} places with no stated method read, ` +
      `${String(report.changes.length)} ${report.dryRun ? 'to set' : 'set'}, ` +
      `${String(report.read - report.changes.length)} stay not_stated.`,
  );
  return lines;
};
