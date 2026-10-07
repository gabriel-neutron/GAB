/** The course of one verdict on the review route, as values. A second verdict waits for the
 * first, and a verdict is held only once the record has taken it. A refused promotion that drew
 * as held would tell the analyst the record took it. */

import { decisionSaid, type DecisionAbout, type DecisionState } from './decision';
import type { Decision } from './queue';

/** What the pass holds after the answer. The queue is read again after each answer. */
interface VerdictSettled {
  readonly held: Decision | null;
}

/** The state while the verdict goes to the record, or null when a verdict is already on the
 * way. The second one is dropped, and never queued behind the first. */
export function beginVerdict(decision: DecisionState, about: DecisionAbout): DecisionState | null {
  if (decision.step === 'working') return null;
  return { step: 'working', ...about };
}

/** Read the answer of the record for one verdict. The record can hold a later state than this
 * queue: the act landed, another window decided it, or the record refused it and it waits. */
export function settleVerdict(answer: DecisionState, act: Decision): VerdictSettled {
  switch (answer.step) {
    case 'done':
      return { held: { verdict: act.verdict } };
    case 'refused':
    case 'unknown':
    case 'idle':
    case 'working':
      return { held: null };
    default:
      return unreached(answer);
  }
}

/** A refusal and a doubt outlive a move of the hand: the analyst must act on each one, and a
 * doubt names the one act that may stand in the record. A verdict on the way is never lost. */
export function decisionAfterMove(decision: DecisionState): DecisionState {
  const said = decisionSaid(decision, null);
  return said.urgent || said.busy ? decision : { step: 'idle' };
}

// Departure: a new step of the answer fails to compile here, and never reads as a refusal.
function unreached(answer: never): never {
  throw new Error(`No course for the answer ${JSON.stringify(answer)}.`);
}
