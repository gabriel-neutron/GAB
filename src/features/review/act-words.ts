import type { EndpointKind, ProposalPayload } from '@/shared/read/model';

type LabelOf = (id: string) => string | undefined;

/** The words of a relation type, read from its source end. */
export type TypeWordsOf = (type: string) => string;

type PhrasedPayload = Extract<ProposalPayload, { readonly kind: 'relation' | 'merge' }>;

interface End {
  readonly kind: EndpointKind;
  readonly id: string | null;
}

// Origin: an identifier is never read in full, and eight characters tell two rows apart.
export const shortId = (id: string): string => id.slice(0, 8);

// Departure: an end may be a relation. A lookup among the entities misses it, and that miss
// must never read as a row absent from the record.
const endWords = (labelOf: LabelOf, end: End): string => {
  if (end.id === null) return 'an element the act does not name';
  if (end.kind === 'relation') return `a relation, ${shortId(end.id)}`;
  return labelOf(end.id) ?? `an entity absent from the record, ${shortId(end.id)}`;
};

export const relationPhrase = (
  labelOf: LabelOf,
  typeWordsOf: TypeWordsOf,
  src: End,
  type: string | null,
  dst: End,
): string =>
  `${endWords(labelOf, src)} ${type === null ? 'is linked to' : typeWordsOf(type)} ${endWords(labelOf, dst)}`;

const entityEnd = (id: string | null): End => ({ kind: 'entity', id });

export function payloadHeadline(
  labelOf: LabelOf,
  typeWordsOf: TypeWordsOf,
  payload: PhrasedPayload,
): string {
  switch (payload.kind) {
    case 'relation':
      return relationPhrase(
        labelOf,
        typeWordsOf,
        { kind: payload.src_kind, id: payload.src_id },
        payload.type,
        { kind: payload.dst_kind, id: payload.dst_id },
      );
    case 'merge':
      return `${payload.merge_ids.map((id) => endWords(labelOf, entityEnd(id))).join(', ')} into ${endWords(labelOf, entityEnd(payload.keep_id))}`;
  }
}
