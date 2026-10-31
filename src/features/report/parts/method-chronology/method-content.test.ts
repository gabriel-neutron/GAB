import { describe, expect, it } from 'vitest';
import { methodUi, parts } from '../../content';

describe('method copy', () => {
  it('quotes the text of the part verbatim', () => {
    const text = parts
      .find((part) => part.slug === 'method-chronology')
      ?.blocks.map((block) => block.text)
      .join(' ');
    const { quote, timeline, numbers, margin } = methodUi;
    for (const fragment of [
      quote,
      timeline.period,
      margin.a,
      margin.f,
      numbers.total.value,
      ...numbers.layers.map((one) => one.value),
    ])
      expect(text).toContain(fragment);
  });
});
