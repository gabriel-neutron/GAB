import { describe, expect, it } from 'vitest';
import { closingUi, parts } from '../content';

describe('closing copy', () => {
  it('cites a note of the summary for the date of the counts', () => {
    const summary = parts.find((part) => part.slug === 'summary');
    expect(summary?.notes.some((note) => note.id === closingUi.annex.dataNote)).toBe(true);
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
