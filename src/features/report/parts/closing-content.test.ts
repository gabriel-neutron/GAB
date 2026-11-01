import { describe, expect, it } from 'vitest';
import { closingUi, parts } from '../content';
import { sources } from '../source';

describe('closing copy', () => {
  it('dates the counts as the final text does', () => {
    const date = /\d+ [A-Z][a-z]+ \d{4}/.exec(closingUi.annex.dataDate)?.[0] ?? '';
    expect(date).not.toBe('');
    expect(sources.en.text).toContain(`On ${date}, the database holds`);
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
