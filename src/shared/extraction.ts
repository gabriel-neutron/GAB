/** The extraction of one document on the screen. This file holds the sentence each state reads,
 * the one button that each state offers, and when the screen reads the status again. */

import type { Said } from './said';
import { queueExtraction, readExtraction, type Extraction } from './write/extraction';
import { writeSaid, type WriteState, type WriteWords } from './write/write-state';

/** The write the control stands in. Idle is a status that is not read yet. */
export type ExtractionState = WriteState<{ readonly latest: Extraction | null }>;

const proposalsWords = (count: number): string =>
  count === 1 ? 'It made 1 proposal.' : `It made ${String(count)} proposals.`;

// The refusal of the propose door can end with its own full stop.
const refusedWords = (refused: string | null): string =>
  refused === null ? '' : ` ${refused.replace(/\.$/u, '')}.`;

const latestWords = (latest: Extraction | null): string => {
  if (latest === null) return 'No extraction ran for this document.';
  switch (latest.status) {
    case 'queued':
      return 'The extraction waits in the queue.';
    case 'running':
      return 'The extraction runs.';
    case 'done':
      return `The extraction is done. ${proposalsWords(latest.proposals)}${refusedWords(latest.refused)}`;
    case 'failed':
      return `The extraction failed: ${latest.reason ?? 'no reason was recorded'}.`;
  }
};

const WORDS: WriteWords<{ readonly latest: Extraction | null }, object> = {
  idle: 'The status is not read yet.',
  working: () => 'The write service is asked.',
  done: ({ latest }) => latestWords(latest),
  unknown: () => 'The state of the extraction is not known.',
};

const EXTRACT = 'Extract claims';
const AGAIN = 'Queue again';

/** The sentence and the button of one state. The record refuses a second open job, so the
 * button asks only that no request is on the way. */
export function extractionScreen(state: ExtractionState): {
  readonly said: Said;
  /** `Queue again` after a failure, and `Extract claims` in every other state. */
  readonly action: string;
  readonly canExtract: boolean;
} {
  const failed = state.step === 'done' && state.latest?.status === 'failed';
  return {
    said: writeSaid(state, WORDS),
    action: failed ? AGAIN : EXTRACT,
    canExtract: state.step !== 'working',
  };
}

/** Whether the job can still change, so the screen reads its status again by itself. */
export const stillOpen = (state: ExtractionState): boolean =>
  state.step === 'done' &&
  (state.latest?.status === 'queued' || state.latest?.status === 'running');

/** Read the newest extraction of one document. It raises nothing. */
export const readStatus = (documentId: string): Promise<ExtractionState> =>
  readExtraction(documentId);

/** Queue one extraction, then read where it stands. It raises nothing. */
export async function extract(documentId: string): Promise<ExtractionState> {
  const queued = await queueExtraction(documentId);
  if (queued.step !== 'done') return queued;
  return readStatus(documentId);
}
