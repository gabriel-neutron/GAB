import { describe, expect, it } from 'vitest';
import { methodUi, parts } from '../../content';

describe('method copy', () => {
  it('quotes the text of the part verbatim', () => {
    const text = parts
      .find((part) => part.slug === 'method-chronology')
      ?.blocks.map((block) => block.text)
      .join(' ');
    expect(text).toContain(methodUi.timeline.period);
    // The final text gives the total of critical nodes, not the count of each layer.
    const total = methodUi.numbers.layers.reduce((sum, one) => sum + Number(one.value), 0);
    expect(text).toContain(`In total, ${String(total)} nodes are critical`);
  });
});
