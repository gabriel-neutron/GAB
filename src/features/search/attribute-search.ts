import type { AttributeValue, Entity } from '@/shared/read/model';

import { folded } from './text-fold';

export interface AttributeHit {
  readonly entityId: string;
  readonly label: string;
  readonly type: string;
  readonly key: string;
  readonly value: string;
}

export type AttributeSearchAnswer =
  | { readonly kind: 'no-query' }
  | { readonly kind: 'no-match'; readonly query: string }
  | { readonly kind: 'matches'; readonly query: string; readonly hits: readonly AttributeHit[] };

// M7 leaves a flat scalar or a flat list of scalars. A list reads as its members joined, the
// same text the record cell of that claim draws.
const textOf = (value: AttributeValue): string => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return value.join(', ');
};

const byHit = (a: AttributeHit, b: AttributeHit): number =>
  a.label.localeCompare(b.label) ||
  a.key.localeCompare(b.key) ||
  a.entityId.localeCompare(b.entityId);

export function searchByAttributeValue(
  entities: readonly Entity[],
  query: string,
): AttributeSearchAnswer {
  const asked = folded(query);
  if (asked === '') return { kind: 'no-query' };

  const starts: AttributeHit[] = [];
  const holds: AttributeHit[] = [];
  for (const entity of entities) {
    for (const [key, attribute] of Object.entries(entity.attrs)) {
      const value = textOf(attribute.v);
      const at = folded(value).indexOf(asked);
      if (at === -1) continue;
      const hit = { entityId: entity.id, label: entity.label, type: entity.type, key, value };
      (at === 0 ? starts : holds).push(hit);
    }
  }

  const hits = [...starts.sort(byHit), ...holds.sort(byHit)];
  const said = query.trim();
  return hits.length === 0
    ? { kind: 'no-match', query: said }
    : { kind: 'matches', query: said, hits };
}
