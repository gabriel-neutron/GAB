import { describe, expect, it } from 'vitest';

import type { DecisionState } from './decision';
import type { Decision } from './queue';
import { beginVerdict, decisionAfterMove, settleVerdict } from './verdict-flow';

const ACT = 'aa000009-0000-4000-8000-000000000001';

const OTHER = 'aa000009-0000-4000-8000-000000000002';

const IDLE: DecisionState = { step: 'idle' };

describe('beginVerdict', () => {
  it('sends a verdict when no verdict is on the way', () => {
    expect(beginVerdict(IDLE, { changeId: ACT, verdict: 'promoted' })).toEqual({
      step: 'working',
      changeId: ACT,
      verdict: 'promoted',
    });
  });

  it('ignores a second verdict while the first is deciding', () => {
    const deciding: DecisionState = { step: 'working', changeId: ACT, verdict: 'promoted' };
    expect(beginVerdict(deciding, { changeId: OTHER, verdict: 'rejected' })).toBeNull();
  });
});

describe('settleVerdict', () => {
  it('holds no verdict after a refused promotion', () => {
    const refused: DecisionState = {
      step: 'refused',
      changeId: ACT,
      verdict: 'promoted',
      refusal: 'The act is no longer pending',
    };
    expect(settleVerdict(refused, { verdict: 'promoted' })).toEqual({ held: null });
  });

  it('holds no verdict after an unknown answer', () => {
    const unknown: DecisionState = {
      step: 'unknown',
      changeId: ACT,
      verdict: 'rejected',
      doubt: 'No answer came.',
    };
    expect(settleVerdict(unknown, { verdict: 'rejected' })).toEqual({ held: null });
  });

  it('holds a landed promotion without the rest of the act', () => {
    const decided: DecisionState = { step: 'done', changeId: ACT, verdict: 'promoted' };
    const act: Decision & { readonly kind: 'decide'; readonly changeId: string } = {
      kind: 'decide',
      changeId: ACT,
      verdict: 'promoted',
    };
    expect(settleVerdict(decided, act)).toStrictEqual({ held: { verdict: 'promoted' } });
  });
});

describe('decisionAfterMove', () => {
  it('forgets a calm sentence when the hand moves', () => {
    const decided: DecisionState = { step: 'done', changeId: ACT, verdict: 'rejected' };
    expect(decisionAfterMove(decided)).toEqual(IDLE);
  });

  it('keeps a refusal, because the analyst must act on it', () => {
    const refused: DecisionState = {
      step: 'refused',
      changeId: ACT,
      verdict: 'promoted',
      refusal: 'The act is no longer pending',
    };
    expect(decisionAfterMove(refused)).toBe(refused);
  });

  it('keeps a verdict that is on the way', () => {
    const deciding: DecisionState = { step: 'working', changeId: ACT, verdict: 'promoted' };
    expect(decisionAfterMove(deciding)).toBe(deciding);
  });
});
