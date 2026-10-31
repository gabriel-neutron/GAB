import { describe, expect, it } from 'vitest';
import { openingUi, parts } from '../content';
import figures from '../data/publication-figures.json';

const textOf = (slug: string): string =>
  parts
    .find((part) => part.slug === slug)
    ?.blocks.map((block) => block.text)
    .join(' ') ?? '';

describe('opening copy', () => {
  it('writes each summary value as its list item does', () => {
    const items = parts
      .find((part) => part.slug === 'summary')
      ?.blocks.filter((b) => b.kind === 'li');
    expect(items).toHaveLength(openingUi.summary.values.length);
    openingUi.summary.values.forEach(({ value, note }, index) => {
      expect(items?.[index]?.text).toContain(value);
      expect(items?.[index]?.text).toContain(`[^${note}]`);
    });
    expect(items?.[4]?.text).toContain('14%');
    expect(textOf('summary')).toContain(openingUi.coverNumber.value);
    expect(textOf('summary')).toContain(`nearly ${openingUi.summary.entities.value} entities`);
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

  it('quotes the introduction verbatim', () => {
    const text = textOf('introduction');
    const { quote, numbers, timeline } = openingUi.introduction;
    for (const fragment of [
      quote,
      ...numbers.map((one) => one.value),
      ...timeline.flatMap((mark) => [mark.date, mark.text]),
    ])
      expect(text).toContain(fragment);
  });
});
