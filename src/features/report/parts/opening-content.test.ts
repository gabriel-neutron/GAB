import { describe, expect, it } from 'vitest';
import { openingUi, parts } from '../content';
import figures from '../data/publication-figures.json';

describe('opening copy', () => {
  it('writes each summary value as its list item does', () => {
    const items = parts
      .find((part) => part.slug === 'summary')
      ?.blocks.filter((b) => b.kind === 'li');
    expect(items).toHaveLength(openingUi.summary.values.length);
    openingUi.summary.values.forEach(({ value, note }, index) => {
      expect(items?.[index]?.text).toContain(value);
      // The item on the price has no note.
      if (note !== '') expect(items?.[index]?.text).toContain(`[^${note}]`);
    });
    expect(items?.[4]?.text).toContain('14%');
  });

  it('cites for the summary chart a note that covers its whole period', () => {
    const { chart } = openingUi.summary;
    const note = parts
      .find((part) => part.slug === chart.note.part)
      ?.notes.find((one) => one.id === chart.note.id);
    expect(note?.text).toContain(chart.period);
    const years = figures.f9.exports.Rouble.map(([year = 0]) => year);
    expect(`${String(Math.min(...years))}-${String(Math.max(...years))}`).toBe(chart.period);
  });
});
