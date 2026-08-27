/** One act on the screen, two things in the record: a proposal, and the entity it promoted. This
 * file holds the states that act passes through and the sentence each one reads. */

import { writeElement, type ElementAct } from '@/shared/write/elements';

import type { EntityDraft } from './entity-draft';

export type CreateState =
  | { readonly step: 'idle' }
  | { readonly step: 'working' }
  | { readonly step: 'signed'; readonly proposalId: string; readonly entityId: string }
  | { readonly step: 'refused'; readonly refusal: string }
  | { readonly step: 'undecided'; readonly refusal: string; readonly proposalId: string }
  | { readonly step: 'unknown'; readonly doubt: string };

const WORKING = 'The new entity is going to the record.';

// A type the record does not hold is taken and never refused: the entity stands as `unknown`
// and the word keeps its place beside it, so an extraction is never lost to a vocabulary.
const READY =
  'Ready to make one entity. A type the record does not hold stands as unknown, and the word you wrote is kept beside it.';

// The request left the browser and no answer came back. The act may have run whole, so the
// sentence states neither end.
const UNSURE = 'It is not known whether the entity was made. Read the record again before you act.';

const signedWords = (proposalId: string): string =>
  `The entity is signed manual. It is in the record as one proposal, ${proposalId}.`;

/** The one sentence the dialog reads. It is derived here, and never composed in the view. */
export function creationWords(state: CreateState, draft: EntityDraft): string {
  switch (state.step) {
    case 'working':
      return WORKING;
    case 'signed':
      return signedWords(state.proposalId);
    case 'refused':
      return `Nothing was written. ${state.refusal}.`;
    case 'undecided':
      return `The entity is not made, and an unsigned proposal to make it is in the record. The proposal is ${state.proposalId}. ${state.refusal}.`;
    case 'unknown':
      return `${UNSURE} ${state.doubt}`;
    case 'idle':
      return draft.ready ? READY : draft.reason;
  }
}

/** Send one act, and answer with the state the dialog stands in. It raises nothing. */
export async function createEntity(
  act: Extract<ElementAct, { op: 'create_entity' }>,
): Promise<CreateState> {
  const outcome = await writeElement(act);
  if (outcome.state === 'signed')
    return { step: 'signed', proposalId: outcome.proposalId, entityId: outcome.targetId };
  if (outcome.state === 'undecided')
    return { step: 'undecided', refusal: outcome.refusal, proposalId: outcome.proposalId };
  if (outcome.state === 'unknown') return { step: 'unknown', doubt: outcome.doubt };
  return { step: 'refused', refusal: outcome.refusal };
}
