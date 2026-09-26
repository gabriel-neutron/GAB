import type { Entity } from '@/shared/read/model';

import { folded } from './text-fold';

export interface NameHit {
  readonly entityId: string;
  readonly label: string;
  readonly type: string;
}

export type NameSearchAnswer =
  | { readonly kind: 'no-query'; readonly entityCount: number }
  | { readonly kind: 'no-match'; readonly query: string }
  | { readonly kind: 'matches'; readonly query: string; readonly hits: readonly NameHit[] };

const byLabel = (a: NameHit, b: NameHit): number =>
  a.label.localeCompare(b.label) || a.entityId.localeCompare(b.entityId);

export function searchByName(entities: readonly Entity[], query: string): NameSearchAnswer {
  const asked = folded(query);
  if (asked === '') return { kind: 'no-query', entityCount: entities.length };

  const starts: NameHit[] = [];
  const holds: NameHit[] = [];
  for (const entity of entities) {
    const name = folded(entity.label);
    const at = name.indexOf(asked);
    if (at === -1) continue;
    const hit = { entityId: entity.id, label: entity.label, type: entity.type };
    (at === 0 ? starts : holds).push(hit);
  }

  const hits = [...starts.sort(byLabel), ...holds.sort(byLabel)];
  const said = query.trim();
  return hits.length === 0
    ? { kind: 'no-match', query: said }
    : { kind: 'matches', query: said, hits };
}
