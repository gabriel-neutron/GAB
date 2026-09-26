import { describe, expect, it } from 'vitest';

import type { Entity } from '@/shared/read/model';

import { searchByAttributeValue } from './attribute-search';

const entity = (id: string, label: string, attrs: Entity['attrs']): Entity => ({
  id,
  type: 'vessel',
  proposedType: null,
  label,
  attrs,
  sources: ['doc_1'],
  geom: null,
  promotedFrom: `proposal_${id}`,
});

const CORPUS: readonly Entity[] = [
  entity('e1', 'Meridian Bulk Carriers Ltd', {
    registration_number: { v: 'HE 418822', src: ['doc_1'] },
  }),
  entity('e2', 'A. Vasilakis', { role_title: { v: 'Director', src: ['doc_1'] } }),
  entity('e3', 'MV Northern Ledger', {
    known_flags: { v: ['PA', 'MN'], src: ['doc_1'] },
    operator_confirmed: { v: true, src: ['doc_1'] },
  }),
];

describe('a search by attribute value', () => {
  it('asks for a query when the field holds only blanks', () => {
    expect(searchByAttributeValue(CORPUS, '   ')).toEqual({ kind: 'no-query' });
  });

  it('finds a value with no regard to case or accents, and names the key it matched', () => {
    const answer = searchByAttributeValue(CORPUS, 'director');
    expect(answer).toEqual({
      kind: 'matches',
      query: 'director',
      hits: [
        {
          entityId: 'e2',
          label: 'A. Vasilakis',
          type: 'vessel',
          key: 'role_title',
          value: 'Director',
        },
      ],
    });
  });

  it('reads a list value as its members joined, and a boolean as yes or no', () => {
    const flags = searchByAttributeValue(CORPUS, 'MN');
    expect(flags.kind === 'matches' ? flags.hits.map((hit) => hit.value) : []).toEqual(['PA, MN']);

    const flag = searchByAttributeValue(CORPUS, 'yes');
    expect(flag.kind === 'matches' ? flag.hits.map((hit) => hit.key) : []).toEqual([
      'operator_confirmed',
    ]);
  });

  it('puts a value that starts with the query before a value that only holds it', () => {
    const answer = searchByAttributeValue(CORPUS, '418822');
    expect(answer.kind === 'matches' ? answer.hits.map((hit) => hit.entityId) : []).toEqual(['e1']);
  });

  it('states the query it did not find', () => {
    expect(searchByAttributeValue(CORPUS, 'zzqx')).toEqual({ kind: 'no-match', query: 'zzqx' });
  });
});
