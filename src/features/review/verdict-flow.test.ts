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
  it('holds no verdict after a refused promotion, and reads the queue again', () => {
    const refused: DecisionState = {
      step: 'refused',
      changeId: ACT,
      verdict: 'promoted',
      refusal: 'The act is no longer pending',
    };
    expect(settleVerdict(refused, { verdict: 'promoted', reason: '' })).toEqual({
      held: null,
      readAgain: true,
    });
  });

  it('holds no verdict after an unknown answer, and reads the queue again', () => {
    const unknown: DecisionState = {
      step: 'unknown',
      changeId: ACT,
      verdict: 'rejected',
      doubt: 'No answer came.',
    };
    expect(settleVerdict(unknown, { verdict: 'rejected', reason: '' })).toEqual({
      held: null,
      readAgain: true,
    });
  });

  it('holds a deferred verdict and its reason, and reads nothing again', () => {
    const decided: DecisionState = { step: 'done', changeId: ACT, verdict: 'deferred' };
    expect(
      settleVerdict(decided, { verdict: 'deferred', reason: 'Wait for the registry.' }),
    ).toEqual({
      held: { verdict: 'deferred', reason: 'Wait for the registry.' },
      readAgain: false,
    });
  });

  it('holds a landed promotion without the rest of the act, and reads the queue again', () => {
    const decided: DecisionState = { step: 'done', changeId: ACT, verdict: 'promoted' };
    const act: Decision & { readonly kind: 'decide'; readonly changeId: string } = {
      kind: 'decide',
      changeId: ACT,
      verdict: 'promoted',
      reason: '',
    };
    expect(settleVerdict(decided, act)).toStrictEqual({
      held: { verdict: 'promoted', reason: '' },
      readAgain: true,
    });
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
