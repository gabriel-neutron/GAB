/** One verdict on the screen, and what the record does with it. The send and the sentence are
 * one job, because one state answers both. A hold has no home in the record, so it stays on
 * this pass alone, and it goes through no door. */

import type { DecisionOp } from '@gab/proposal/request';

import { interrupt, type Said } from '@/shared/said';
import { sendDecision } from '@/shared/write/door';
import { writeSaid, type WriteState, type WriteWords } from '@/shared/write/write-state';

import type { Verdict } from './queue';

/** The two verdicts a door takes. A hold reaches no door, so no answer of a door names one. */
export type DoorVerdict = Exclude<Verdict, 'deferred'>;

/** Every state that is not idle names the act it is about. A sentence that names no act reads
 * as the sentence of whatever act stands under the controls, and the two are not the same. */
interface DecisionAbout {
  readonly changeId: string;
  readonly verdict: Verdict;
}

export type DecisionState = WriteState<object, DecisionAbout>;

/** What the surface reads: the sentence and its urgency, and whether a second verdict must
 * wait. One state answers the three, so they travel as one. */
export interface DecisionSaid extends Said {
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

// Departure: a hold reaches no door, so it is never unknown. The one state of a write holds
// every verdict, so the hold has words here too.
const UNSURE: Readonly<Record<Verdict, string>> = {
  promoted: 'It is not known whether the act was promoted.',
  rejected: 'It is not known whether the act was rejected.',
  deferred: 'It is not known whether the act was held.',
};

const WORDS: WriteWords<object, DecisionAbout> = {
  idle: '',
  working: ({ verdict }) => GOING[verdict],
  done: ({ verdict }) => DONE[verdict],
  unknown: ({ verdict }) => UNSURE[verdict],
};

/** The door of each verdict. The lookup is total, so a verdict that the record can take reaches
 * its own door, and a verdict that reaches no door refuses to compile here and not at the door. */
const DOOR: Readonly<Record<DoorVerdict, DecisionOp>> = {
  promoted: 'promote_proposal',
  rejected: 'reject_proposal',
};

// The hand moved to another act, and the sentence stays: a refusal and a doubt must not go
// away in silence. So the sentence says first that it is not about the act below it.
const ELSEWHERE = 'This is about another act.';

const about = (elsewhere: boolean, sentence: string): string =>
  elsewhere ? `${ELSEWHERE} ${sentence}` : sentence;

/** The one sentence the surface reads. It is derived here, and never composed in the view. The
 * act under the controls is read, because a verdict of one act never reads as the next one. */
export function decisionSaid(state: DecisionState, currentId: string | null): DecisionSaid {
  const said = writeSaid<object, DecisionAbout>(state, WORDS);
  if (state.step === 'idle') return { ...said, busy: false };

  const elsewhere = currentId !== null && state.changeId !== currentId;
  const sentence = about(elsewhere, said.sentence);
  // The record moved under the analyst, or the answer never came. Both interrupt, and both end
  // at one read of the record.
  if (state.step === 'refused' || state.step === 'unknown')
    return { ...interrupt(`${sentence} ${READ_AGAIN}`), busy: false };
  return { ...said, sentence, busy: state.step === 'working' };
}

/** Take one verdict, and answer with the state the surface stands in. It raises nothing. A hold
 * reaches no door: nothing in the record holds a reason, and this file writes none. */
export async function sendVerdict(changeId: string, verdict: Verdict): Promise<DecisionState> {
  if (verdict === 'deferred') return { step: 'done', changeId, verdict };

  return { ...(await sendDecision(DOOR[verdict], changeId)), changeId, verdict };
}
