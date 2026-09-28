export interface RailStep {
  readonly openTypes: readonly string[];
  readonly wholeList: readonly string[];
}

// Departure: a type that closes forgets its whole list, so the next open shows the capped head.
export function stepAfterTypeOpen(step: RailStep, type: string, open: boolean): RailStep {
  if (open) return { ...step, openTypes: [...step.openTypes, type] };
  return {
    openTypes: step.openTypes.filter((held) => held !== type),
    wholeList: step.wholeList.filter((held) => held !== type),
  };
}

export const stepShowingWholeList = (step: RailStep, type: string): RailStep =>
  step.wholeList.includes(type) ? step : { ...step, wholeList: [...step.wholeList, type] };
