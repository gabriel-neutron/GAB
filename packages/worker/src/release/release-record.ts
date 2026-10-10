import { z } from 'zod';

import type { Queryable } from '../queryable.ts';

// PU1: an origin that the label does not know reads as not checked, never as a person.
const CAUTIOUS = 'Proposed — not checked';

const label = z
  .string()
  .nullable()
  .transform((value) => value ?? CAUTIOUS);

const entityRow = z.object({
  id: z.uuid(),
  type: z.string(),
  label: z.string(),
  origin_label: label,
  sources: z.array(z.string()),
  // GeoJSON, as the read API gives it.
  geom: z.record(z.string(), z.unknown()).nullable(),
});

const relationRow = z.object({
  id: z.uuid(),
  type: z.string(),
  src_id: z.uuid(),
  dst_id: z.uuid(),
  valid_from: z.string().nullable(),
  valid_to: z.string().nullable(),
  origin_label: label,
  sources: z.array(z.string()),
});

const passage = z.object({
  document: z.string(),
  page: z.number().int(),
  excerpt: z.string(),
  modality: z.string(),
  transcribed: z.boolean(),
});

const claimRow = z.object({
  claim_id: z.string(),
  subject_kind: z.enum(['entity', 'relation']),
  subject_id: z.uuid(),
  attribute: z.string().nullable(),
  value: z.unknown(),
  origin_label: label,
  sources: z.array(z.string()),
  /** The act that the label and the passages come from. */
  act_id: z.uuid(),
  passages: z.array(passage),
});

const documentRow = z.object({
  id: z.string(),
  title: z.string(),
  uri: z.string().nullable(),
  retrieved_at: z.string().nullable(),
  licence: z.string().nullable(),
});

const mergeRow = z.object({
  act_id: z.uuid(),
  action: z.enum(['merge', 'undo']),
  /** The day of the decision, in UTC. */
  day: z.string(),
  absorbed_id: z.uuid(),
  survivor_id: z.uuid(),
  /** The entity that the absorbed identifier resolves to today, while the merge stands. */
  resolves_to: z.uuid().nullable(),
  origin_label: label,
});

const disclaimerRow = z.object({ disclaimer: z.string() });

export type ReleaseEntity = z.output<typeof entityRow>;
export type ReleaseRelation = z.output<typeof relationRow>;
export type ReleaseClaim = z.output<typeof claimRow>;
export type ReleaseDocument = z.output<typeof documentRow>;
export type ReleaseMerge = z.output<typeof mergeRow>;

/** What a release publishes: the public part of the record, as the release functions of the
 * database give it, each list in the order of its identifiers. */
export interface ReleaseRecord {
  readonly entities: readonly ReleaseEntity[];
  readonly relations: readonly ReleaseRelation[];
  readonly claims: readonly ReleaseClaim[];
  /** Each merge and each undo, in the order of the decisions. */
  readonly merges: readonly ReleaseMerge[];
  /** Each public document that a row of the release cites, by its identifier. */
  readonly documents: ReadonlyMap<string, ReleaseDocument>;
  /** The disclaimer of the dataset, in Markdown, with its two contact links still to fill. */
  readonly disclaimer: string;
}

const rowsOf = async <T extends z.ZodType>(db: Queryable, shape: T, text: string) =>
  z.array(shape).parse((await db.query(text)).rows);

/** Reads the public part of the record. The release functions apply the public rules, so this
 * read cannot show what the public read hides. The caller gives one snapshot for the reads. */
export const readReleaseRecord = async (db: Queryable): Promise<ReleaseRecord> => {
  const entities = await rowsOf(
    db,
    entityRow,
    'SELECT id, type, label, origin_label, sources, geom FROM public.release_entities() ORDER BY id',
  );
  const relations = await rowsOf(
    db,
    relationRow,
    `SELECT id, type, src_id, dst_id, valid_from::text AS valid_from, valid_to::text AS valid_to,
            origin_label, sources
       FROM public.release_relations() ORDER BY id`,
  );
  const claims = await rowsOf(
    db,
    claimRow,
    `SELECT claim_id, subject_kind, subject_id, attribute, value, origin_label, sources, act_id,
            passages
       FROM public.release_claims() ORDER BY claim_id`,
  );
  const merges = await rowsOf(
    db,
    mergeRow,
    `SELECT act_id, action, to_char(decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            absorbed_id, survivor_id, resolves_to, origin_label
       FROM public.release_merges() ORDER BY decided_at, act_id`,
  );
  const documents = await rowsOf(
    db,
    documentRow,
    `SELECT id, title, uri, retrieved_at::text AS retrieved_at, licence
       FROM public.release_documents() ORDER BY id`,
  );
  const [said] = await rowsOf(
    db,
    disclaimerRow,
    'SELECT public.release_disclaimer() AS disclaimer',
  );
  if (said === undefined) throw new Error('the database gave no disclaimer');
  // PU1: a release names a document only when a row of the release cites it, so a document that
  // only a hidden row cites does not show what that row was about.
  const cited = new Set([
    ...[...entities, ...relations, ...claims].flatMap((one) => one.sources),
    ...claims.flatMap((one) => one.passages.map((passage) => passage.document)),
  ]);
  return {
    entities,
    relations,
    claims,
    merges,
    documents: new Map(documents.filter((one) => cited.has(one.id)).map((one) => [one.id, one])),
    disclaimer: said.disclaimer,
  };
};
