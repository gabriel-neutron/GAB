import { describe, expect, it } from 'vitest';
import { closingUi, parts } from '../content';

const textOf = (slug: string): string =>
  parts
    .find((part) => part.slug === slug)
    ?.blocks.map((block) => block.text)
    .join(' ') ?? '';

describe('closing copy', () => {
  it('quotes each closing part verbatim', () => {
    const { limits, conclusion, annex } = closingUi;
    expect(textOf('limits')).toContain(limits.quote);
    expect(textOf('conclusion')).toContain(conclusion.quote);
    expect(textOf('conclusion')).toContain(conclusion.last.value);
    expect(textOf('annex-method')).toContain(annex.quote);
    for (const one of annex.figures)
      expect(textOf('annex-method')).toContain(
        one.qualifier === undefined ? one.value : `${one.qualifier} ${one.value}`,
      );
  });

  it('splits the answer of the conclusion into a question and three sentences', () => {
    const answer = parts.find((part) => part.slug === 'conclusion')?.blocks[2]?.text ?? '';
    const [, ...routes] = answer.split(/(?<=[.?])\s+/);
    expect(routes).toHaveLength(3);
    // The code gives sentences 1 and 2 to the money and sentence 3 to the goods.
    expect(routes[0]).toMatch(/money/);
    expect(routes[1]).toMatch(/payment/);
    expect(routes[2]).toMatch(/goods/);
  });
});
