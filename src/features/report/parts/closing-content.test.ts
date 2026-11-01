import { describe, expect, it } from 'vitest';
import { closingUi, parts } from '../content';
import { sources } from '../source';

describe('closing copy', () => {
  it('dates the counts as the final text does', () => {
    const date = /\d+ [A-Z][a-z]+ \d{4}/.exec(closingUi.annex.dataDate)?.[0] ?? '';
    expect(date).not.toBe('');
    expect(sources.en.text).toContain(`On ${date}, the database holds`);
  });

  it('splits the third paragraph of the conclusion into a statement and three sentences', () => {
    const answer = parts.find((part) => part.slug === 'conclusion')?.blocks[2]?.text ?? '';
    const [, ...steps] = answer.split(/(?<=[.?])\s+/);
    expect(steps).toHaveLength(3);
    // The code gives sentences 1 and 2 to the steps of the EU and sentence 3 to their delay.
    expect(steps[0]).toMatch(/chain/);
    expect(steps[1]).toMatch(/oil/);
    expect(steps[2]).toMatch(/late/);
  });
});
