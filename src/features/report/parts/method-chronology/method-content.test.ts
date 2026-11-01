import { describe, expect, it } from 'vitest';
import { methodUi, parts } from '../../content';

describe('method copy', () => {
  it('quotes the text of the part verbatim', () => {
    const text = parts
      .find((part) => part.slug === 'method-chronology')
      ?.blocks.map((block) => block.text)
      .join(' ');
    expect(text).toContain(methodUi.timeline.period);
  });
});
