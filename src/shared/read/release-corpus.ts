// The record of a release as the corpus. The files become the rows that the read service gives,
// and the rows pass through the same `toDomain` as the rows of the service. So a surface reads
// one shape, and it cannot tell the two sources apart (ADR 0028).

import type { SiteClaim, SiteRelease } from '@gab/release/site-release';
import { z } from 'zod';

import { toDomain } from './map';
import type { Corpus, RelationTypeVocabulary } from './model';

type Cited = Extract<SiteClaim, { kind: 'attribute' }>;

interface Held {
  v: unknown;
  src: string[];
}

// A release writes a value as it is when it is text, and as JSON otherwise. A number is taken
// back only when it prints as it was written, so "1.50" and "007" stay text.
const listOfScalars = z.union([z.array(z.string()), z.array(z.number())]);

function valueOf(text: string): unknown {
  if (text === 'true') return true;
  if (text === 'false') return false;
  const number = Number(text);
  if (text !== '' && Number.isFinite(number) && String(number) === text) return number;
  if (!text.startsWith('[')) return text;
  try {
    const list = listOfScalars.safeParse(JSON.parse(text));
    return list.success ? list.data : text;
  } catch {
    return text;
  }
}

const attributesOf = (claims: readonly Cited[]): Record<string, Held> => {
  const attrs: Record<string, Held> = {};
  for (const claim of claims) {
    const src = claim.sources.map((one) => one.documentId).filter((id) => id !== '');
    // The record refuses an attribute with no source, so a claim with none is not a row of it.
    if (src.length > 0) attrs[claim.attribute] = { v: valueOf(claim.value), src };
  }
  return attrs;
};

const geojson = z.object({
  features: z.array(
    z.object({
      geometry: z.record(z.string(), z.unknown()).nullable(),
      properties: z.looseObject({ id: z.string() }),
    }),
  ),
});

const DAY_ATTRIBUTES: ReadonlySet<string> = new Set(['valid_from', 'valid_to']);

const unique = (list: readonly string[]): string[] => [...new Set(list)];

/** Departure: the release gives a position to the entities that have one, and it gives no
 * precision word and no borrowed position. A position here is a drawn point and nothing more. */
export function corpusFromRelease(
  release: SiteRelease,
  relationTypes: RelationTypeVocabulary,
): Corpus {
  const features = geojson.parse(JSON.parse(release.geojson)).features;
  const geometryOf = new Map(features.map((one) => [one.properties.id, one]));

  const attributeClaims = release.claims.filter((one): one is Cited => one.kind === 'attribute');
  const entityClaims = new Map<string, Cited[]>();
  const relationClaims = new Map<string, Cited[]>();
  for (const claim of attributeClaims) {
    const into = claim.subjectKind === 'entity' ? entityClaims : relationClaims;
    if (claim.subjectKind === 'relation' && DAY_ATTRIBUTES.has(claim.attribute)) continue;
    const held = into.get(claim.subjectId);
    if (held === undefined) into.set(claim.subjectId, [claim]);
    else held.push(claim);
  }

  const documents = new Map<string, unknown>();
  for (const claim of release.claims)
    for (const source of claim.sources)
      if (source.documentId !== '' && !documents.has(source.documentId))
        documents.set(source.documentId, {
          id: source.documentId,
          kind: source.address === null ? 'manual' : 'url',
          title: source.title,
          uri: source.address,
          archive_uri: null,
          sha256: null,
          retrieved_at: source.readOn,
        });

  const cited = (claims: readonly Cited[]): string[] =>
    unique(claims.flatMap((one) => one.sources.map((source) => source.documentId))).filter(
      (id) => id !== '',
    );

  const entityRows = release.entities.map((one) => {
    const claims = entityClaims.get(one.id) ?? [];
    const placed = geometryOf.get(one.id);
    return {
      id: one.id,
      type: one.type,
      proposed_type: null,
      label: one.label,
      geom: placed?.geometry ?? null,
      attrs: attributesOf(claims),
      sources: cited(claims),
      promoted_from: '',
    };
  });

  const relationRows = release.relations.map((one) => {
    const claim = release.claimById.get(one.id);
    return {
      id: one.id,
      type: one.type,
      proposed_type: null,
      src_kind: 'entity',
      src_id: one.fromId,
      dst_kind: 'entity',
      dst_id: one.toId,
      valid_from: one.validFrom,
      valid_to: one.validTo,
      attrs: attributesOf(relationClaims.get(one.id) ?? []),
      sources: unique((claim?.sources ?? []).map((source) => source.documentId)).filter(
        (id) => id !== '',
      ),
      promoted_from: '',
    };
  });

  return {
    documents: [...documents.values()].map((row) => toDomain.document(row)),
    entities: entityRows.map((row) => toDomain.entity(row)),
    relations: relationRows.map((row) => toDomain.relation(row)),
    proposals: [],
    positions: release.entities.map((one) =>
      toDomain.mapPosition({
        id: one.id,
        type: one.type,
        geom: geometryOf.get(one.id)?.geometry ?? null,
        position_precision: null,
        parent_id: null,
      }),
    ),
    relationTypes,
  };
}
