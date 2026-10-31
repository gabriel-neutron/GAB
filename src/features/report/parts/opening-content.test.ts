import { describe, expect, it } from 'vitest';
import { openingUi, parts } from '../content';

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
