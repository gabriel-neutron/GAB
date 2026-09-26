import { describe, expect, it } from 'vitest';

import type { Entity } from '@/shared/read/model';

import { searchByName } from './name-search';

const entity = (id: string, label: string): Entity => ({
  id,
  type: 'vessel',
  proposedType: null,
  label,
  attrs: {},
  sources: ['doc_1'],
  geom: null,
  promotedFrom: `proposal_${id}`,
});

const CORPUS: readonly Entity[] = [
  entity('e1', 'Northern Ledger'),
  entity('e2', 'MV Northern Star'),
  entity('e3', 'Société Nordique'),
  entity('e4', 'Harbour Authority'),
];

describe('a search by name', () => {
  it('asks for a query when the field holds only blanks, and states the corpus size', () => {
    expect(searchByName(CORPUS, '   ')).toEqual({ kind: 'no-query', entityCount: 4 });
  });

  it('finds a name with no regard to case or accents', () => {
    const answer = searchByName(CORPUS, 'SOCIETE');
    expect(answer.kind === 'matches' ? answer.hits.map((hit) => hit.entityId) : []).toEqual(['e3']);
  });

  it('puts a name that starts with the query before a name that only holds it', () => {
    const answer = searchByName(CORPUS, 'northern');
    expect(answer.kind === 'matches' ? answer.hits.map((hit) => hit.entityId) : []).toEqual([
      'e1',
      'e2',
    ]);
  });

  it('states the query it did not find', () => {
    expect(searchByName(CORPUS, ' Kestrel ')).toEqual({ kind: 'no-match', query: 'Kestrel' });
  });
});
