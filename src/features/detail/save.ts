/** One act on the screen, two things in the record: a proposal, and the value it promoted. This
 * file holds the states that act passes through and the sentence each one reads. */

import type { AttributeEdit } from '@gab/proposal/attribute-value';

import { writeAttributes } from '@/shared/write/attributes';

import type { PendingEdit } from './draft';

export type SaveState =
  | { readonly step: 'idle' }
  | { readonly step: 'saving' }
  | { readonly step: 'signed'; readonly proposalId: string }
  | { readonly step: 'refused'; readonly refusal: string }
  | { readonly step: 'undecided'; readonly refusal: string; readonly proposalId: string }
  | { readonly step: 'unknown'; readonly doubt: string };

const SAVING = 'The change is going to the record.';

// The request left the browser and no answer came back. The act may have run whole, so the
// sentence states neither end.
const UNSURE =
  'It is not known whether the change was written. Read the record again before you act.';

const ready = (count: number): string =>
  count === 1 ? 'One value stands ready to save.' : `${count} values stand ready to save.`;

const signedWords = (proposalId: string): string =>
  `The value is signed manual. The change is in the record as one proposal, ${proposalId}.`;

const undecidedWords = (proposalId: string, refusal: string): string =>
  `The change was written as the proposal ${proposalId}, and it was not signed. ${refusal}`;

/** The one sentence the panel reads. It is derived here, and never composed in the view. */
export function saveWords(state: SaveState, edit: PendingEdit): string {
  switch (state.step) {
    case 'saving':
      return SAVING;
    case 'signed':
      return signedWords(state.proposalId);
    case 'refused':
      return `Nothing was written. ${state.refusal}`;
    case 'undecided':
      return undecidedWords(state.proposalId, state.refusal);
    case 'unknown':
      return `${UNSURE} ${state.doubt}`;
    case 'idle':
      return edit.ready ? ready(edit.count) : edit.reason;
  }
}

/** Send one act, and answer with the state the panel stands in. It raises nothing. */
export async function saveClaims(entityId: string, attrs: AttributeEdit): Promise<SaveState> {
  const outcome = await writeAttributes({ targetKind: 'entity', targetId: entityId, attrs });
  if (outcome.state === 'signed') return { step: 'signed', proposalId: outcome.proposalId };
  if (outcome.state === 'undecided')
    return { step: 'undecided', refusal: outcome.refusal, proposalId: outcome.proposalId };
  if (outcome.state === 'unknown') return { step: 'unknown', doubt: outcome.doubt };
  return { step: 'refused', refusal: outcome.refusal };
}
