import { expect, it } from 'vitest';

import { deciderWords } from './decider-words';

it('names the rule and its version when a rule decided, and says accepted or rejected', () => {
  const origin = 'rule strong_sources v2 (fact digits: 1)';
  expect(deciderWords('rule', origin, 'accepted')).toBe(
    'accepted by the rule strong sources, version 2',
  );
  expect(deciderWords('rule', 'rule impossible v1 (fact digits: no fact)', 'rejected')).toBe(
    'rejected by the rule impossible, version 1',
  );
});

it('says validated manually for the operator, also for an older decision with no origin', () => {
  const manual = 'validated manually by the operator';
  expect(deciderWords('unit', manual, 'accepted')).toBe(manual);
  expect(deciderWords(null, null, 'accepted')).toBe(manual);
  expect(deciderWords('group', manual, 'accepted')).toBe(`${manual}, group action`);
});

it('names an AI reviewer by its own words, and says that a human did not decide', () => {
  for (const mode of ['unit', 'relation'] as const)
    for (const verdict of ['accepted', 'rejected'] as const)
      expect(deciderWords(mode, 'decided by an AI reviewer', verdict)).toBe(
        'decided by an AI reviewer and not by a human',
      );
});

it('never calls a decision of a rule a decision of the operator', () => {
  expect(deciderWords('rule', 'rule strong_sources v1', 'accepted')).not.toMatch(/operator/u);
  expect(deciderWords('rule', null, 'accepted')).not.toMatch(/operator/u);
});
