import { describe, expect, it } from 'vitest';

import { answersMatch, countMatches, PROMPT_SET } from './probe-family.ts';

describe('the family probe', () => {
  it('holds a versioned prompt set of free answers', () => {
    expect(PROMPT_SET.version).toBe('family-probe-1');
    expect(PROMPT_SET.prompts.length).toBeGreaterThanOrEqual(10);
  });

  it('matches two answers with the same words, with case and punctuation ignored', () => {
    expect(answersMatch('Sea Lion!', 'sea lion')).toBe(true);
    expect(answersMatch('sea lion', 'lion')).toBe(false);
  });

  it('never matches an absent or an empty answer', () => {
    expect(answersMatch(null, null)).toBe(false);
    expect(answersMatch('', '')).toBe(false);
    expect(answersMatch('...', '!!!')).toBe(false);
  });

  it('counts the prompts whose two answers match', () => {
    expect(countMatches(['a', 'b', null, 'd'], ['A', 'x', null, 'd.'])).toBe(2);
  });
});
