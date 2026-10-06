/** The extraction of one document on the screen. This file holds the states the control passes
 * through, the sentence each one reads, and the one button that each state offers. */

import { calm, type Said } from './said';
import { queueExtraction, readExtraction, type Extraction } from './write/extraction';

export type ExtractionView =
  | { readonly step: 'unread' }
  | { readonly step: 'working' }
  | { readonly step: 'read'; readonly latest: Extraction | null }
  | { readonly step: 'refused'; readonly refusal: string };

export interface ExtractionScreen {
  readonly said: Said;
  /** `Queue again` after a failure, and `Extract claims` in every other state. */
  readonly action: string;
  /** An open or a done extraction takes no second one. */
  readonly canExtract: boolean;
}

const proposalsWords = (count: number): string =>
  count === 1 ? 'It made 1 proposal.' : `It made ${String(count)} proposals.`;

const latestWords = (latest: Extraction | null): string => {
  if (latest === null) return 'No extraction ran for this document.';
  switch (latest.status) {
    case 'queued':
      return 'The extraction waits in the queue.';
    case 'running':
      return 'The extraction runs.';
    case 'done':
      return `The extraction is done. ${proposalsWords(latest.proposals)}`;
    case 'failed':
      return `The extraction failed: ${latest.reason ?? 'no reason was recorded'}.`;
  }
};

const EXTRACT = 'Extract claims';
const AGAIN = 'Queue again';

/** The sentence and the button of one state. */
export function extractionScreen(view: ExtractionView): ExtractionScreen {
  switch (view.step) {
    case 'unread':
      return { said: calm('The status is not read yet.'), action: EXTRACT, canExtract: true };
    case 'working':
      return { said: calm('The write service is asked.'), action: EXTRACT, canExtract: false };
    case 'refused':
      return {
        said: calm(`The writer refused: ${view.refusal}.`),
        action: EXTRACT,
        canExtract: true,
      };
    case 'read': {
      const failed = view.latest?.status === 'failed';
      return {
        said: calm(latestWords(view.latest)),
        action: failed ? AGAIN : EXTRACT,
        canExtract: view.latest === null || failed,
      };
    }
  }
}

/** Read the newest extraction of one document. It raises nothing. */
export async function readStatus(documentId: string): Promise<ExtractionView> {
  const outcome = await readExtraction(documentId);
  return outcome.state === 'read'
    ? { step: 'read', latest: outcome.latest }
    : { step: 'refused', refusal: outcome.refusal };
}

/** Queue one extraction, then read where it stands. It raises nothing. */
export async function extract(documentId: string): Promise<ExtractionView> {
  const outcome = await queueExtraction(documentId);
  if (outcome.state === 'refused') return { step: 'refused', refusal: outcome.refusal };
  return readStatus(documentId);
}
