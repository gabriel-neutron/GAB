import { z } from 'zod';

import { PROPOSED_LABEL } from '@gab/release/accepted';

import type { Queryable } from '../queryable.ts';
import { readNatoPairs, type NatoPair } from './nato-pair.ts';

// PU1: an origin that the label does not know reads as not checked, never as a person.

const label = z
  .string()
  .nullable()
  .transform((value) => value ?? PROPOSED_LABEL);

const entityRow = z.object({
  id: z.uuid(),
  type: z.string(),
  label: z.string(),
  origin_label: label,
  sources: z.array(z.string()),
  // GeoJSON, as the read API gives it.
  geom: z.record(z.string(), z.unknown()).nullable(),
  /** The documents of the act that set the geometry, empty when the entity has no geometry. The
   * database always gives it. A row without it is a test row, and its row-level sources count. */
  geom_sources: z.array(z.string()).optional(),
  /** How a source found the place: a word of the closed list of the methods, null when the entity
   * has no geometry. A row without it is a test row, and its place is `not_stated`. */
  geom_method: z.string().nullable().optional(),
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
  /** The provider that distributed the document, or null. */
  provider: z.string().nullable(),
  /** The type of the document. A test record may leave it out, and it reads as `other`. */
  doc_type: z.string().optional(),
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

const observationRow = z.object({
  id: z.uuid(),
  measure: z.string(),
  value: z.string(),
  unit: z.string(),
  period: z.string(),
  method: z.string(),
  publisher: z.string(),
  reporter: z.string().nullable(),
  partner: z.string().nullable(),
  product: z.string().nullable(),
  subject_id: z.uuid().nullable(),
  licence: z.string(),
  document_id: z.string(),
  page: z.number().int(),
  span_start: z.number().int(),
  span_end: z.number().int(),
});

const disclaimerRow = z.object({ disclaimer: z.string() });

const candidateCounts = z.object({
  proposed: z.number().int(),
  confirmed: z.number().int(),
  refused: z.number().int(),
});

export type ReleaseEntity = z.output<typeof entityRow>;
export type ReleaseRelation = z.output<typeof relationRow>;
export type ReleaseClaim = z.output<typeof claimRow>;
export type ReleaseDocument = z.output<typeof documentRow>;
export type ReleaseMerge = z.output<typeof mergeRow>;
export type ReleaseObservation = z.output<typeof observationRow>;
export type NameCandidateCounts = z.output<typeof candidateCounts>;

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
  /** Each figure of the newest edition for its key, with an open licence. A test record may leave
   * it out, and it holds no figure then. */
  readonly observations?: readonly ReleaseObservation[];
  /** The number of merge candidates across a Latin and a Cyrillic spelling in each state. */
  readonly nameCandidates: NameCandidateCounts;
  /** The disclaimer of the dataset, in Markdown, with its two contact links still to fill. */
  readonly disclaimer: string;
  /** The NATO pair of each claim that has one, by the identifier of the claim, when the release
   * shows the pair. Null when it does not, so no file can hold a letter or a digit. */
  readonly natoPairs: ReadonlyMap<string, NatoPair> | null;
}

const rowsOf = async <T extends z.ZodType>(db: Queryable, shape: T, text: string) =>
  z.array(shape).parse((await db.query(text)).rows);

/** Reads the public part of the record. The release functions apply the public rules, so this
 * read cannot show what the public read hides. The NATO pair of each claim is read only when
 * `natoPair` is true. `cited` names the documents that a file of the release cites outside the
 * record, such as the volume table. The caller gives one snapshot for the reads. */
export const readReleaseRecord = async (
  db: Queryable,
  {
    natoPair,
    cited: alsoCited = new Set(),
  }: { readonly natoPair: boolean; readonly cited?: ReadonlySet<string> },
): Promise<ReleaseRecord> => {
  const entities = await rowsOf(
    db,
    entityRow,
    'SELECT id, type, label, origin_label, sources, geom, geom_sources, geom_method FROM public.release_entities() ORDER BY id',
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
    `SELECT id, title, uri, retrieved_at::text AS retrieved_at, licence, provider, doc_type
       FROM public.release_documents() ORDER BY id`,
  );
  // A figure of the release names its document, so the document is public (PU1).
  const observed = await rowsOf(
    db,
    observationRow,
    `SELECT id, measure, value::text AS value, unit, period, method, publisher, reporter, partner,
            product, subject_id, licence, document_id, page, span_start, span_end
       FROM public.release_observations() ORDER BY measure, period, reporter, id`,
  );
  // A figure whose document is not a public document of the release is left out.
  const publicIds = new Set(documents.map((one) => one.id));
  const observations = observed.filter((one) => publicIds.has(one.document_id));
  const [said] = await rowsOf(
    db,
    disclaimerRow,
    'SELECT public.release_disclaimer() AS disclaimer',
  );
  if (said === undefined) throw new Error('the database gave no disclaimer');
  const [nameCandidates] = await rowsOf(
    db,
    candidateCounts,
    'SELECT proposed, confirmed, refused FROM public.name_candidate_counts()',
  );
  if (nameCandidates === undefined) throw new Error('the database gave no candidate counts');
  // PU1: a release names a document only when a row of the release cites it, so a document that
  // only a hidden row cites does not show what that row was about.
  const cited = new Set([
    ...[...entities, ...relations, ...claims].flatMap((one) => one.sources),
    ...entities.flatMap((one) => one.geom_sources ?? []),
    ...claims.flatMap((one) => one.passages.map((passage) => passage.document)),
    ...observations.map((one) => one.document_id),
    ...alsoCited,
  ]);
  return {
    entities,
    relations,
    claims,
    merges,
    observations,
    nameCandidates,
    documents: new Map(documents.filter((one) => cited.has(one.id)).map((one) => [one.id, one])),
    disclaimer: said.disclaimer,
    natoPairs: natoPair ? await readNatoPairs(db, claims) : null,
  };
};
