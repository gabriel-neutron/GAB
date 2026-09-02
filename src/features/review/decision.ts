/** One verdict on the screen, and what the record does with it. The send and the sentence are
 * one job, because one state answers both. A hold has no home in the record, so it stays on
 * this pass alone, and it goes through no door. */

import { sendDecision } from '@/shared/write/door';

import type { Verdict } from './queue';

/** The two verdicts a door takes. A hold reaches no door, so no answer of a door names one. */
export type DoorVerdict = Exclude<Verdict, 'deferred'>;

/** Every state that is not idle names the act it is about. A sentence that names no act reads
 * as the sentence of whatever act stands under the controls, and the two are not the same. */
export type DecisionState =
  | { readonly step: 'idle' }
  | { readonly step: 'deciding'; readonly changeId: string; readonly verdict: Verdict }
  | { readonly step: 'decided'; readonly changeId: string; readonly verdict: Verdict }
  | {
      readonly step: 'refused';
      readonly changeId: string;
      readonly verdict: DoorVerdict;
      readonly refusal: string;
    }
  | {
      readonly step: 'unknown';
      readonly changeId: string;
      readonly verdict: DoorVerdict;
      readonly doubt: string;
    };

/** What the surface reads: the one sentence, whether the analyst must act on it now, and
 * whether a second verdict must wait. One state answers the three, so they travel as one. */
export interface DecisionSaid {
  readonly sentence: string;
  readonly urgent: boolean;
  readonly busy: boolean;
}

const GOING: Readonly<Record<Verdict, string>> = {
  promoted: 'The promotion is going to the record.',
  rejected: 'The rejection is going to the record.',
  deferred: 'The hold is taken on this pass.',
};

const DONE: Readonly<Record<Verdict, string>> = {
  promoted: 'The act is promoted. The record took it, and no door takes it back.',
  rejected: 'The act is rejected. It stays in the record as what was set aside.',
  // The hold is the one verdict the record cannot take. A reader must not learn that from a
  // reload that has already lost the reason.
  deferred: 'The act is held on this pass. The record holds no hold, so a reload loses it.',
};

// The record moved under the analyst, or the answer never came. Both end at one read of the
// record. The sentence is in the present tense, because the surface paints it before the read
// finishes: an urgent sentence never waits behind a network read.
const READ_AGAIN = 'The queue is read again.';

const UNSURE: Readonly<Record<DoorVerdict, string>> = {
  promoted: 'It is not known whether the act was promoted.',
  rejected: 'It is not known whether the act was rejected.',
};

// The hand moved to another act, and the sentence stays: a refusal and a doubt must not go
// away in silence. So the sentence says first that it is not about the act below it.
const ELSEWHERE = 'This is about another act.';

const about = (elsewhere: boolean, sentence: string): string =>
  elsewhere ? `${ELSEWHERE} ${sentence}` : sentence;

/** The one sentence the surface reads. It is derived here, and never composed in the view. The
 * act under the controls is read, because a verdict of one act never reads as the next one. */
export function decisionSaid(state: DecisionState, currentId: string | null): DecisionSaid {
  if (state.step === 'idle') return { sentence: '', urgent: false, busy: false };

  const elsewhere = currentId !== null && state.changeId !== currentId;
  switch (state.step) {
    case 'deciding':
      return { sentence: about(elsewhere, GOING[state.verdict]), urgent: false, busy: true };
    case 'decided':
      return { sentence: about(elsewhere, DONE[state.verdict]), urgent: false, busy: false };
    case 'refused':
      return {
        sentence: about(elsewhere, `Nothing was written. ${state.refusal}. ${READ_AGAIN}`),
        urgent: true,
        busy: false,
      };
    case 'unknown':
      return {
        sentence: about(elsewhere, `${UNSURE[state.verdict]} ${state.doubt} ${READ_AGAIN}`),
        urgent: true,
        busy: false,
      };
  }
}

/** Take one verdict, and answer with the state the surface stands in. It raises nothing. A hold
 * reaches no door: nothing in the record holds a reason, and this file writes none. */
export async function sendVerdict(changeId: string, verdict: Verdict): Promise<DecisionState> {
  if (verdict === 'deferred') return { step: 'decided', changeId, verdict };

  const outcome = await sendDecision(
    verdict === 'promoted' ? 'promote_proposal' : 'reject_proposal',
    changeId,
  );
  if (outcome.state === 'decided') return { step: 'decided', changeId, verdict };
  // The act may have run whole, so this state is never drawn as a refusal and never as a hold.
  if (outcome.state === 'unknown')
    return { step: 'unknown', changeId, verdict, doubt: outcome.doubt };
  return { step: 'refused', changeId, verdict, refusal: outcome.refusal };
}
