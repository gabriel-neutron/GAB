import { describe, expect, it } from 'vitest';

import { undatedDesignations } from './undated-designations.ts';

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const entity = (n: number, label: string) => ({
  id: id(n),
  type: 'legal_act',
  label,
  origin_label: 'x',
  sources: [],
  geom: null,
});
const relation = (n: number, dst: number, from: string | null, sources: string[] = []) => ({
  id: id(100 + n),
  type: 'designated_by',
  src_id: id(99),
  dst_id: id(dst),
  valid_from: from,
  valid_to: null,
  origin_label: 'x',
  sources,
});
const doc = (provider: string) => ({
  id: provider,
  title: provider,
  uri: null,
  retrieved_at: null,
  licence: null,
  provider,
});

describe('undatedDesignations', () => {
  it('counts only the undated designated_by relations, by act', () => {
    const record = {
      entities: [
        entity(1, 'Executive Order 14024'),
        entity(2, 'OFAC action of 10 January 2025'),
        entity(3, 'Regulation (EU) No 269/2014'),
        entity(4, 'UK regulations'),
        entity(5, 'Other act'),
      ],
      relations: [
        relation(1, 1, null),
        relation(2, 1, null),
        relation(3, 1, '2022-01-01'),
        relation(4, 2, null),
        relation(5, 3, null, ['eu_eurlex']),
        relation(6, 4, null, ['uk_sanctions_list']),
        relation(7, 5, null),
        { ...relation(8, 1, null), type: 'restricted_by' },
      ],
      documents: new Map([doc('eu_eurlex'), doc('uk_sanctions_list')].map((d) => [d.id, d])),
    };
    const counted = undatedDesignations(record);
    expect(counted.total).toBe(6);
    expect(counted.byAct).toEqual({ us_eo_14024: 2, us_ofac_action: 1, eu: 1, uk: 1, other: 1 });
  });

  it('keeps the act by label, and gives other to a mixed or unknown source', () => {
    const record = {
      entities: [entity(1, 'Executive Order 14024')],
      relations: [
        relation(1, 1, null, ['eu_eurlex']),
        relation(2, 7, null, ['eu_eurlex', 'uk_sanctions_list']),
        relation(3, 7, null),
      ],
      documents: new Map([doc('eu_eurlex'), doc('uk_sanctions_list')].map((d) => [d.id, d])),
    };
    const counted = undatedDesignations(record);
    expect(counted.byAct).toEqual({ us_eo_14024: 1, us_ofac_action: 0, eu: 0, uk: 0, other: 2 });
    expect(Object.values(counted.byAct).reduce((a, b) => a + b, 0)).toBe(counted.total);
  });
});
