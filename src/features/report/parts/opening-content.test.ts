import { describe, expect, it } from 'vitest';
import { openingUi, parts } from '../content';
import figures from '../data/publication-figures.json';
import { summaryValues } from './summary-values';

describe('opening copy', () => {
  it('reads each summary value from its list item', () => {
    const items = (
      parts.find((part) => part.slug === 'summary')?.blocks.filter((b) => b.kind === 'li') ?? []
    ).map((block) => block.text);
    expect(items).toHaveLength(openingUi.summary.values.length);
    openingUi.summary.values.forEach(({ words, note }, index) => {
      expect(items[index]).toContain(words);
      // The item on the price has no note.
      if (note !== '') expect(items[index]).toContain(`[^${note}]`);
    });
    const values = summaryValues(items, openingUi.summary.values).map((value) =>
      value.kind === 'number' ? `${value.label} ${value.format(value.value)}` : value.text,
    );
    expect(values).toEqual([
      'Customers 84%',
      'Ships 79%',
      'almost doubled',
      'less than one fifth',
      'Currency 53%',
      'Components 77%',
    ]);
  });

  it('cites for the summary chart the note of a figure that covers its whole period', () => {
    const { chart } = openingUi.summary;
    const caption = parts
      .find((part) => part.slug === chart.note.part)
      ?.blocks.find(
        (block) => block.kind === 'figure' && block.text.includes(`[^${chart.note.id}]`),
      );
    expect(caption?.figure?.period).toBe(chart.period);
    const years = figures.f9.exports.Rouble.map(([year = 0]) => year);
    expect(`${String(Math.min(...years))}-${String(Math.max(...years))}`).toBe(chart.period);
  });
});
