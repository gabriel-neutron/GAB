import type { DecisionState } from './decision-bar';

const IDLE: DecisionState = { step: 'idle' };

/** The state the decision bar of `unitId` shows. A decision on the way locks every bar, because
 * a second decision sent in that time can act on a unit the operator did not choose. */
export const barStateOf = (decision: DecisionState, unitId: string): DecisionState =>
  decision.step === 'working' || (decision.step !== 'idle' && decision.unitId === unitId)
    ? decision
    : IDLE;
