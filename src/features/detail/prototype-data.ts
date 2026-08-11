/**
 * **PROTOTYPE — throwaway.** The reads the detail surface needs, over the hand-written sample of
 * `@/shared/fixtures` (#46). Every one of these is a SQL view or a SQL function later, in the
 * `api` schema (ADR 0003, `spec.md` §4). Nothing here is a contract.
 */

import { corpus } from '@/shared/fixtures/corpus';
import type {
  Attribute,
  DocId,
  DocumentRow,
  Entity,
  Proposal,
  Relation,
} from '@/shared/fixtures/types';
import { denseDocuments, denseEntities, denseProposals, denseRelations } from './prototype-dense';

/**
 * The sample of #46, and the density probe of this prototype behind it. The probe is a separate
 * list and not an edit of the fixture, because three other prototypes read that fixture.
 */
const entities: readonly Entity[] = [...corpus.entities, ...denseEntities];
const relations: readonly Relation[] = [...corpus.relations, ...denseRelations];
const proposals: readonly Proposal[] = [...corpus.proposals, ...denseProposals];
const documents: readonly DocumentRow[] = [...corpus.documents, ...denseDocuments];

export const allEntities: readonly Entity[] = entities;

export function findEntity(id: string): Entity | undefined {
  return entities.find((entity) => entity.id === id);
}

export function findRelation(id: string): Relation | undefined {
  return relations.find((relation) => relation.id === id);
}

/**
 * Invariant 2 says every cited source exists in `documents`, and `spec.md` §6 records that the
 * tier which **proves** that is undecided for `entities.sources`. So this returns `undefined`
 * and the screen draws the hole, instead of hiding it behind a placeholder title.
 */
export function findDocument(id: DocId): DocumentRow | undefined {
  return documents.find((document) => document.id === id);
}

export type AttributeEntry = readonly [key: string, attribute: Attribute];

export function attributeEntries(attrs: Readonly<Record<string, Attribute>>): AttributeEntry[] {
  return Object.entries(attrs).sort(([left], [right]) => left.localeCompare(right));
}

/**
 * Every document the entity cites, at the entity level and at the claim level, in first-seen
 * order. S1 scores the document, so this list is the list of scores that reach the entity.
 */
export function citedDocumentIds(entity: Entity): DocId[] {
  const seen: DocId[] = [];
  const add = (id: DocId): void => {
    if (!seen.includes(id)) seen.push(id);
  };
  entity.sources.forEach(add);
  attributeEntries(entity.attrs).forEach(([, attribute]) => {
    attribute.src.forEach(add);
  });
  return seen;
}

/**
 * Every document the screen shows, numbered in the order it is met: the entity, then the claims,
 * then the relations and their claims, then the pending proposals. The number in a badge is an
 * index into this list, so a document cited only by a relation still gets one.
 */
export function pageSourceOrder(entity: Entity): DocId[] {
  const seen: DocId[] = [];
  const add = (id: DocId): void => {
    if (!seen.includes(id)) seen.push(id);
  };

  citedDocumentIds(entity).forEach(add);

  const direct = directRelations(entity.id);
  [...direct, ...relationsAboutRelations(direct)].forEach((relation) => {
    relation.sources.forEach(add);
    Object.values(relation.attrs).forEach((attribute) => {
      attribute.src.forEach(add);
    });
  });

  pendingProposals(entity.id).forEach((proposal) => {
    proposal.src.forEach(add);
  });

  return seen;
}

/** The claims one document holds up. The inverse read, kept for a later source-first mode. */
export function claimsCiting(entity: Entity, docId: DocId): AttributeEntry[] {
  return attributeEntries(entity.attrs).filter(([, attribute]) => attribute.src.includes(docId));
}

/** A relation with one endpoint on this entity. These are the ones the graph draws. */
export function directRelations(entityId: string): Relation[] {
  return relations.filter(
    (relation) =>
      (relation.srcKind === 'entity' && relation.srcId === entityId) ||
      (relation.dstKind === 'entity' && relation.dstId === entityId),
  );
}

/**
 * M4: a relation may point at a relation. ADR 0004 §4 says such a relation is invisible in the
 * graph and is reached here. This read is the only way to it, so it is not an extra.
 */
export function relationsAboutRelations(direct: readonly Relation[]): Relation[] {
  const targets = direct.map((relation) => relation.id);
  return relations.filter(
    (relation) =>
      // A relation that already stands in the direct list is not repeated here. It happens when
      // one relation has an entity at one end and a direct relation of that entity at the other.
      !targets.includes(relation.id) &&
      ((relation.srcKind === 'relation' && targets.includes(relation.srcId)) ||
        (relation.dstKind === 'relation' && targets.includes(relation.dstId))),
  );
}

export function pendingProposals(entityId: string): Proposal[] {
  return proposals.filter(
    (proposal) => proposal.status === 'pending' && proposal.targetId === entityId,
  );
}

/** The proposal that made this row. #15: one door in, and the row names it. */
export function promotingProposal(promotedFrom: string): Proposal | undefined {
  return proposals.find((proposal) => proposal.id === promotedFrom);
}

export function endpointLabel(kind: 'entity' | 'relation', id: string): string {
  if (kind === 'entity') return findEntity(id)?.label ?? `unknown entity ${id}`;
  const relation = findRelation(id);
  if (relation === undefined) return `unknown relation ${id}`;
  // One level deep only. A relation on a relation on a relation is not in the sample, and a
  // recursive walk would invent a rule that no document carries.
  const from =
    relation.srcKind === 'entity' ? endpointLabel('entity', relation.srcId) : 'a relation';
  const to = relation.dstKind === 'entity' ? endpointLabel('entity', relation.dstId) : 'a relation';
  return `${from} — ${relation.type} → ${to}`;
}

export function relationSentence(relation: Relation): string {
  return `${endpointLabel(relation.srcKind, relation.srcId)} — ${relation.type} → ${endpointLabel(
    relation.dstKind,
    relation.dstId,
  )}`;
}

export function relationInterval(relation: Relation): string | null {
  if (relation.validFrom === null && relation.validTo === null) return null;
  return `${relation.validFrom ?? 'unknown start'} to ${relation.validTo ?? 'now'}`;
}
