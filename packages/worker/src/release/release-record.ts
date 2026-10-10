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

const disclaimerRow = z.object({ disclaimer: z.string() });

export type ReleaseEntity = z.output<typeof entityRow>;
export type ReleaseRelation = z.output<typeof relationRow>;
export type ReleaseClaim = z.output<typeof claimRow>;
export type ReleaseDocument = z.output<typeof documentRow>;

/** What a release publishes: the public part of the record, as the release functions of the
 * database give it, each list in the order of its identifiers. */
export interface ReleaseRecord {
  readonly entities: readonly ReleaseEntity[];
  readonly relations: readonly ReleaseRelation[];
  readonly claims: readonly ReleaseClaim[];
  /** Each public document, by its identifier. */
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
  return {
    entities,
    relations,
    claims,
    documents: new Map(documents.map((one) => [one.id, one])),
    disclaimer: said.disclaimer,
  };
};
