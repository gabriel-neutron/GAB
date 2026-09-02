// The soft stop of one job. The caller sets the cap, and the hard stop stays outside the code,
// on the credit limit of the model account. A cap that is not counted is not a cap.
export interface Budget {
  readonly cap: number;
  readonly spent: () => number;
  readonly left: () => number;
  readonly add: (tokens: number) => void;
}

/** The token cap of one job. The caller passes the value, and no code constant gives one. */
export const openBudget = (cap: number): Budget => {
  if (!Number.isInteger(cap) || cap <= 0)
    throw new Error('the token cap of a job is a whole number above zero');

  let used = 0;

  return {
    cap,
    spent: () => used,
    left: () => Math.max(cap - used, 0),
    add: (tokens: number) => {
      used += Math.max(tokens, 0);
    },
  };
};
