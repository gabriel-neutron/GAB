/**
 * PROTOTYPE — throwaway. The detail panel, as plain data.
 *
 * The three variants paint this differently, so the reading of it lives here and the painting
 * does not. It is the only route to a relation whose endpoint is a relation (M4, ADR 0004 §4).
 */

import type { AttributeValue, Proposal, Relation } from '@/shared/fixtures/types';
import type { PrototypeModel } from './prototype-model';

export type Selection =
  | { readonly kind: 'entity'; readonly id: string }
  | {
      readonly kind: 'relation';
      readonly id: string;
    };

export interface DetailField {
  readonly label: string;
  readonly value: string;
  readonly sources: readonly string[];
}

export interface DetailLink {
  readonly label: string;
  readonly detail: string;
  readonly target: Selection | null;
}

export interface PendingLine {
  readonly id: string;
  readonly op: string;
  readonly confidence: number;
  readonly dissent: boolean;
  readonly summary: string;
}

export interface Detail {
  readonly selection: Selection;
  readonly title: string;
  readonly subtitle: string;
  readonly synthetic: boolean;
  readonly fields: readonly DetailField[];
  readonly sources: readonly string[];
  readonly drawn: readonly DetailLink[];
  readonly drawnOverflow: number;
  /** M4. Not on the graph, and reachable only from here. */
  readonly hidden: readonly DetailLink[];
  readonly pending: readonly PendingLine[];
  readonly notes: readonly string[];
}

const DRAWN_LIMIT = 30;

function renderValue(value: AttributeValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value);
}

function pendingLine(proposal: Proposal): PendingLine {
  const payload = proposal.payload;
  const summary =
    payload.kind === 'attrs'
      ? `sets ${Object.keys(payload.attrs).join(', ')}`
      : payload.kind === 'entity'
        ? `creates ${payload.type} "${payload.label}"`
        : payload.kind === 'relation'
          ? `creates a ${payload.type} relation`
          : payload.kind === 'merge'
            ? `merges ${payload.mergeIds.length} entity into ${payload.keepId.slice(0, 8)}`
            : `deletes — ${payload.reason}`;
  return {
    id: proposal.id,
    op: proposal.op,
    confidence: proposal.confidence,
    dissent: proposal.dissent,
    summary,
  };
}

function endpointLink(
  model: PrototypeModel,
  kind: 'entity' | 'relation',
  id: string,
  role: string,
): DetailLink {
  if (kind === 'entity') {
    const entity = model.entityById.get(id);
    return {
      label: role,
      detail: entity === undefined ? `unknown entity ${id}` : `${entity.type} · ${entity.label}`,
      target: { kind: 'entity', id },
    };
  }
  const relation = model.relationById.get(id);
  return {
    label: role,
    detail: relation === undefined ? `unknown relation ${id}` : `relation · ${relation.type}`,
    target: { kind: 'relation', id },
  };
}

function relationLink(model: PrototypeModel, relation: Relation, from: string): DetailLink {
  const otherIsSource = relation.dstId === from;
  const otherKind = otherIsSource ? relation.srcKind : relation.dstKind;
  const otherId = otherIsSource ? relation.srcId : relation.dstId;
  const arrow = otherIsSource ? '←' : '→';

  if (otherKind === 'relation') {
    const other = model.relationById.get(otherId);
    return {
      label: `${arrow} ${relation.type}`,
      detail: other === undefined ? `relation ${otherId}` : `a ${other.type} relation`,
      target: { kind: 'relation', id: otherId },
    };
  }
  const other = model.entityById.get(otherId);
  return {
    label: `${arrow} ${relation.type}`,
    detail: other === undefined ? `entity ${otherId}` : other.label,
    target: { kind: 'entity', id: otherId },
  };
}

export function buildDetail(model: PrototypeModel, selection: Selection): Detail | null {
  const pending = (model.pendingByTarget.get(selection.id) ?? []).map(pendingLine);
  const hidden = (model.hiddenByEndpoint.get(selection.id) ?? []).map((relation) =>
    relationLink(model, relation, selection.id),
  );
  const notes: string[] = [];
  if (hidden.length > 0) {
    notes.push(
      `Relations that point at a relation (M4): ${hidden.length}. The graph draws none of them. ` +
        `ADR 0004 §4 reaches them from here.`,
    );
  }

  if (selection.kind === 'relation') {
    const relation = model.relationById.get(selection.id);
    if (relation === undefined) return null;
    const fields = Object.entries(relation.attrs).map(([key, attribute]) => ({
      label: key,
      value: renderValue(attribute.v),
      sources: attribute.src,
    }));
    if (relation.validFrom !== null || relation.validTo !== null) {
      fields.push({
        label: 'valid',
        value: `${relation.validFrom ?? '—'} → ${relation.validTo ?? 'open'}`,
        sources: [],
      });
    }
    const onGraph = relation.srcKind === 'entity' && relation.dstKind === 'entity';
    if (!onGraph) notes.push('This relation is not on the graph. One of its ends is a relation.');

    return {
      selection,
      title: relation.type,
      subtitle: onGraph ? `relation · drawn` : `relation · not drawn (M4)`,
      synthetic: !model.corpus.realRelationIds.has(relation.id),
      fields,
      sources: relation.sources,
      drawn: [
        endpointLink(model, relation.srcKind, relation.srcId, 'from'),
        endpointLink(model, relation.dstKind, relation.dstId, 'to'),
      ],
      drawnOverflow: 0,
      hidden,
      pending,
      notes,
    };
  }

  const entity = model.entityById.get(selection.id);
  if (entity === undefined) return null;

  const all = model.drawnByEntity.get(entity.id) ?? [];
  const drawn = all
    .slice(0, DRAWN_LIMIT)
    .map((relation) => relationLink(model, relation, entity.id));

  return {
    selection,
    title: entity.label,
    subtitle: `${entity.type} · degree ${all.length}`,
    synthetic: !model.corpus.realEntityIds.has(entity.id),
    fields: Object.entries(entity.attrs).map(([key, attribute]) => ({
      label: key,
      value: renderValue(attribute.v),
      sources: attribute.src,
    })),
    sources: entity.sources,
    drawn,
    drawnOverflow: Math.max(0, all.length - drawn.length),
    hidden,
    pending,
    notes,
  };
}
