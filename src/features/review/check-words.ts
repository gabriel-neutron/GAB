import type { ActCheck, UnitAct } from './unit-page';

/** Which check ran on an act, and what it found. */
export type CheckState = 'passed' | 'disputed' | 'unclear' | 'same_family' | 'code_only';

/** The check of one act, in the words of the card. `name` names the act. */
export interface CheckLine {
  readonly act: string;
  readonly name: string;
  readonly state: CheckState;
  readonly words: string;
}

// The state of the end says where it stands, so the name stays short.
const NO_NAME = 'an element';

const nameOf = (act: UnitAct): string => {
  if (act.kind === 'entity') return act.label;
  if (act.kind === 'relation')
    return `${act.src.name ?? NO_NAME} ${act.type} ${act.dst.name ?? NO_NAME}`;
  return act.target === null ? act.op : `${act.op} ${act.target.name ?? NO_NAME}`;
};

const stateOf = (check: ActCheck | null): CheckState => {
  if (check === null) return 'code_only';
  if (check.verdict === 'not_supported') return 'disputed';
  if (check.verdict === 'unclear') return 'unclear';
  return check.passed ? 'passed' : 'same_family';
};

const wordsOf = (state: CheckState, check: ActCheck | null): string => {
  const model = check?.model ?? '';
  const why = check?.reason === null || check?.reason === undefined ? '' : `: ${check.reason}`;
  switch (state) {
    case 'passed':
      return `Checked by a second model, ${model}: the passage supports it`;
    case 'disputed':
      return `Checked by a second model, ${model}: the passage does not support it${why}`;
    case 'unclear':
      return `Checked by a second model, ${model}: it cannot decide${why}`;
    case 'same_family':
      return `Checked by ${model}, a model of the family of the reader: the check does not count`;
    case 'code_only':
      return 'Checked by code only: no second model checked it';
  }
};

/** Which check ran on each act of a unit, in the order of the acts. */
export const checkLines = (acts: readonly UnitAct[]): readonly CheckLine[] =>
  acts.map((act) => {
    const state = stateOf(act.check);
    return { act: act.id, name: nameOf(act), state, words: wordsOf(state, act.check) };
  });
