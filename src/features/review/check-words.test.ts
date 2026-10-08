import { describe, expect, it } from 'vitest';

import { checkLines } from './check-words';
import type { ActCheck, UnitAct } from './unit-page';

const entity = (check: ActCheck | null): UnitAct => ({
  id: 'e1',
  kind: 'entity',
  label: 'MV Example',
  type: 'vessel',
  attributes: [],
  disputed: false,
  endRejected: false,
  check,
});

const MODEL = 'other/checker';

describe('the check of each act', () => {
  it('says that a second model found the act in its passage', () => {
    expect(
      checkLines([entity({ model: MODEL, verdict: 'supported', passed: true, reason: null })]),
    ).toEqual([
      {
        act: 'e1',
        name: 'MV Example',
        state: 'passed',
        words: 'Checked by a second model, other/checker: the passage supports it',
      },
    ]);
  });

  it('says that a second model disputes the act, with its reason', () => {
    const [line] = checkLines([
      entity({ model: MODEL, verdict: 'not_supported', passed: false, reason: 'No date.' }),
    ]);
    expect(line?.state).toBe('disputed');
    expect(line?.words).toBe(
      'Checked by a second model, other/checker: the passage does not support it: No date.',
    );
  });

  it('says that a second model could not decide', () => {
    const [line] = checkLines([
      entity({ model: MODEL, verdict: 'unclear', passed: false, reason: null }),
    ]);
    expect(line?.state).toBe('unclear');
  });

  it('says that a check by the family of the reader does not count', () => {
    const [line] = checkLines([
      entity({ model: MODEL, verdict: 'supported', passed: false, reason: null }),
    ]);
    expect(line?.state).toBe('same_family');
    expect(line?.words).toContain('the check does not count');
  });

  it('says that only code checked an act with no check of a model', () => {
    expect(checkLines([entity(null)])[0]).toMatchObject({
      state: 'code_only',
      words: 'Checked by code only: no second model checked it',
    });
  });

  it('names a relation by its two ends', () => {
    const relation: UnitAct = {
      id: 'r1',
      kind: 'relation',
      type: 'owned_by',
      src: { id: 'a', name: 'MV Example', state: 'pending', group: null, rejectedOn: null },
      dst: { id: 'b', name: null, state: 'record', group: null, rejectedOn: null },
      attributes: [],
      disputed: false,
      endRejected: false,
      check: null,
    };
    expect(checkLines([relation])[0]?.name).toBe('MV Example owned_by an element');
  });
});
