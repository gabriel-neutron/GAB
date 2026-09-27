import { relationTypeWords } from '@/shared/canvas-label';
import type { ProposalPayload } from '@/shared/read/model';

type LabelOf = (id: string) => string | undefined;

type PhrasedPayload = Extract<ProposalPayload, { readonly kind: 'relation' | 'merge' }>;

// Origin: an identifier is never read in full, and eight characters tell two rows apart.
export const shortId = (id: string): string => id.slice(0, 8);

const entityWords = (labelOf: LabelOf, id: string | null): string =>
  id === null
    ? 'an element the act does not name'
    : (labelOf(id) ?? `an entity absent from the record, ${shortId(id)}`);

export const relationPhrase = (
  labelOf: LabelOf,
  srcId: string | null,
  type: string | null,
  dstId: string | null,
): string =>
  `${entityWords(labelOf, srcId)} ${type === null ? 'is linked to' : relationTypeWords(type)} ${entityWords(labelOf, dstId)}`;

export function payloadHeadline(labelOf: LabelOf, payload: PhrasedPayload): string {
  switch (payload.kind) {
    case 'relation':
      return relationPhrase(labelOf, payload.src_id, payload.type, payload.dst_id);
    case 'merge':
      return `${payload.merge_ids.map((id) => entityWords(labelOf, id)).join(', ')} into ${entityWords(labelOf, payload.keep_id)}`;
  }
}
