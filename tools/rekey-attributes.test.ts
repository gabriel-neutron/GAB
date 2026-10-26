import { describe, expect, it } from 'vitest';

import { plan, report, valuesOf, type Item } from './rekey-attributes.ts';

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

// A page as the GUR vessel pages write it: a label, then the number on the next line.
const GUR = [
  'Vessel: NAYARA',
  'IMO: 9074729',
  'Net tonnage (t)',
  '4 000',
  'Gross tonnage (t)',
  '42 500',
  'DWT (t)',
  '115000',
].join('\n');

const paged = (attrs: Item['attrs'], text = GUR, ...excerpts: string[]): Item => ({
  id: 'a',
  attrs,
  excerpts,
  pages: [{ document: 'doc_a', page: 1, text }],
});

describe('plan with the stored page', () => {
  it('builds the passage from the page when the excerpt is poor and the number is the same', () => {
    const done = plan(
      paged({ dwt_t: { v: 115000 }, gross_tonnage_t: { v: 42500 } }, GUR, 'NAYARA'),
    );
    expect(done.kind).toBe('rekey');
    const extra = done.kind === 'rekey' ? (done.extra ?? []) : [];
    expect(extra.map((one) => one.excerpt)).toEqual([
      'DWT (t)\n115000',
      'Gross tonnage (t)\n42 500',
    ]);
    // A passage is a verbatim slice of the page.
    for (const one of extra) expect(GUR).toContain(one.excerpt);
  });

  it('holds when the page has another number next to the label', () => {
    expect(plan(paged({ gross_tonnage_t: { v: 4000 } }, GUR, 'NAYARA')).kind).toBe('hold');
    expect(plan(paged({ dwt_t: { v: 120000 } }, GUR, 'NAYARA')).kind).toBe('hold');
  });

  it('holds when a word stands between the label and the number', () => {
    const text = 'Gross tonnage (t)\nNet tonnage (t)\n4000';
    expect(plan(paged({ gross_tonnage_t: { v: 4000 } }, text, 'x')).kind).toBe('hold');
  });

  it('uses no page when the excerpt is good', () => {
    const done = plan(paged({ dwt_t: { v: 115000 } }, GUR, 'DWT 115000 t'));
    expect(done).toMatchObject({ kind: 'rekey' });
    expect(done).not.toHaveProperty('extra');
  });
});

describe('valuesOf', () => {
  it('reads the proposed values and the page values, and swaps nothing', () => {
    expect(valuesOf(paged({ dwt_t: { v: 40000 }, gross_tonnage_t: { v: 115000 } }))).toEqual({
      proposed: { capacity_dwt: 40000, gross_tonnage_gt: 115000 },
      page: { capacity_dwt: 115000, gross_tonnage_gt: 42500 },
    });
  });
});

describe('passage of a page, the whole number only', () => {
  const held = (value: number, text: string) =>
    plan(paged({ gross_tonnage_t: { v: value } }, text, 'x')).kind;

  it('holds a shorter value against a longer number', () => {
    expect(held(500, 'Gross tonnage (t)\n500 000')).toBe('hold');
    expect(held(42500, 'Gross tonnage (t)\n42 500 000')).toBe('hold');
    expect(held(42500, 'Gross tonnage (t)\n42 500,75')).toBe('hold');
    expect(held(42500, 'Gross tonnage (t)\n42 500')).toBe('rekey');
  });

  it('holds a line that gives two quantities, so no value is taken from the other label', () => {
    expect(held(115000, 'DWT/GT: 115 000 / 42 500')).toBe('hold');
  });

  it('reads a page value that stops at the end of the line', () => {
    const text = 'Gross tonnage (t)\n42 500\n2024';
    expect(valuesOf(paged({ gross_tonnage_t: { v: 1 } }, text)).page).toEqual({
      gross_tonnage_gt: 42500,
    });
  });
});
