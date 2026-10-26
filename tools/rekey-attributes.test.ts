import { describe, expect, it } from 'vitest';

import { plan, report, type Item } from './rekey-attributes.ts';

const item = (attrs: Item['attrs'], ...excerpts: string[]): Item => ({ id: 'a', attrs, excerpts });

describe('plan', () => {
  it('keeps an item with no drifted key', () => {
    expect(plan(item({ capacity_dwt: { v: 1 } }, 'x')).kind).toBe('keep');
  });

  it('re-keys a deadweight when the excerpt has the label and the number', () => {
    expect(plan(item({ dwt_t: { v: 115000 } }, 'Deadweight: 115 000 t'))).toEqual({
      kind: 'rekey',
      attrs: { capacity_dwt: { v: 115000 } },
      renamed: ['dwt_t'],
    });
  });

  it('holds a tonnage with no label, an NT label or a number that the page lacks', () => {
    expect(plan(item({ gross_tonnage_t: { v: 9000 } }, 'Tonnage 9000')).kind).toBe('hold');
    expect(plan(item({ gross_tonnage_t: { v: 9000 } }, 'NT 9000')).kind).toBe('hold');
    expect(plan(item({ gross_tonnage_t: { v: 9000 } }, 'GT 9100')).kind).toBe('hold');
    expect(plan(item({ gross_tonnage_t: { v: 9000 } }, 'GT 9000')).kind).toBe('rekey');
  });

  it('holds a number that belongs to another label', () => {
    const attrs = { gross_tonnage_t: { v: 5000 } };
    expect(plan(item(attrs, 'DWT 5000 t, GT 9000')).kind).toBe('hold');
    expect(plan(item({ dwt_t: { v: 9000 } }, 'DWT 5000 t, GT 9000')).kind).toBe('hold');
    expect(plan(item({ dwt_t: { v: 5000 } }, '5 000 t DWT, GT 9000')).kind).toBe('rekey');
  });

  it('holds a list of former names with a placeholder, an IMO number or a part not on the page', () => {
    expect(plan(item({ former_name: { v: ['N/A', 'ALPHA'] } }, 'ALPHA N/A')).kind).toBe('hold');
    expect(plan(item({ former_name: { v: ['ALPHA'] } }, 'ALPHABET')).kind).toBe('hold');
    expect(
      plan(item({ former_name: { v: 'IMO 9074729 / ALPHA' } }, 'IMO 9074729 ALPHA')).kind,
    ).toBe('hold');
    expect(plan(item({ former_name: { v: ['ALPHA'] } }, 'ex ALPHA')).kind).toBe('rekey');
  });

  it('holds two different values for one canonical key', () => {
    const attrs = { dwt_t: { v: 5000 }, deadweight_t: { v: 6000 } };
    expect(plan(item(attrs, 'DWT 5000 and 6000')).kind).toBe('hold');
    expect(plan(item({ dwt_t: { v: 5000 }, deadweight_t: { v: 5000 } }, 'DWT 5000')).kind).toBe(
      'rekey',
    );
  });

  it('holds a deadweight that is smaller than the gross tonnage', () => {
    const attrs = { dwt_t: { v: 5000 }, gross_tonnage_t: { v: 9000 } };
    expect(plan(item(attrs, 'DWT 5000, GT 9000')).kind).toBe('hold');
  });

  it('splits former names on a slash with spaces, and holds a part the page lacks', () => {
    const attrs = { former_name: { v: 'ALPHA / BETA' } };
    expect(plan(item(attrs, 'ex ALPHA, ex BETA'))).toMatchObject({
      attrs: { former_names: { v: ['ALPHA', 'BETA'] } },
    });
    expect(plan(item(attrs, 'ex ALPHA')).kind).toBe('hold');
    expect(plan(item({ former_name: { v: 'ALPHA / N/A' } }, 'ALPHA N/A')).kind).toBe('hold');
  });

  it('holds an item with no excerpt', () => {
    expect(plan(item({ dwt_t: { v: 1 } })).kind).toBe('hold');
  });
});

describe('report', () => {
  it('counts the re-keys and the held items by reason', () => {
    const done = report([
      item({ dwt_t: { v: 7 } }, 'DWT 7'),
      item({ dwt_t: { v: 7 } }, 'x'),
      item({ dwt_t: { v: 7 } }, 'y'),
      item({ imo: { v: 1 } }, 'z'),
    ]);
    expect(done.rekey).toBe(1);
    expect(done.keep).toBe(1);
    expect(done.held.get('the excerpt does not give the number of dwt_t next to its label')).toBe(
      2,
    );
  });
});
