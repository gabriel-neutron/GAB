/** The acts that change the shape of the record around one entity: a relation is made, and an
 * element is destroyed. This file holds the states such an act passes through and its sentence. */

import { writeElement, type ElementAct } from '@/shared/write/elements';

/** The three acts this page offers. Making an entity has no entity to hang on, so it is absent. */
export type StructureAct = Exclude<ElementAct, { op: 'create_entity' }>;

export type StructureDeed = StructureAct['op'];

export type StructureState =
  | { readonly step: 'idle' }
  | { readonly step: 'working'; readonly deed: StructureDeed }
  | { readonly step: 'signed'; readonly deed: StructureDeed; readonly proposalId: string }
  | { readonly step: 'refused'; readonly deed: StructureDeed; readonly refusal: string }
  | {
      readonly step: 'undecided';
      readonly deed: StructureDeed;
      readonly refusal: string;
      readonly proposalId: string;
    }
  | { readonly step: 'unknown'; readonly deed: StructureDeed; readonly doubt: string };

/** The one sentence the page reads, and whether the analyst must act on it now. The two are one
 * job: the state that reads gravest is the state that must interrupt and take the hue. */
export interface StructureSaid {
  readonly sentence: string;
  readonly urgent: boolean;
}

const WORKING: Readonly<Record<StructureDeed, string>> = {
  create_relation: 'The new relation is going to the record.',
  delete_entity: 'The deletion of the entity is going to the record.',
  delete_relation: 'The deletion of the relation is going to the record.',
};

const DONE: Readonly<Record<StructureDeed, string>> = {
  create_relation: 'The relation is made, and it is signed manual.',
  delete_entity: 'The entity is deleted.',
  delete_relation: 'The relation is deleted.',
};

// The proposal committed and the promotion rolled back, so the element stands as it stood. The
// state of the element is what the analyst reads, and the record states only the refusal.
const UNSIGNED: Readonly<Record<StructureDeed, string>> = {
  create_relation:
    'The relation is not made, and an unsigned proposal to make it is in the record.',
  delete_entity:
    'The entity is not deleted, and an unsigned proposal to delete it is in the record.',
  delete_relation:
    'The relation is not deleted, and an unsigned proposal to delete it is in the record.',
};

// The request left the browser and no answer came back. The act may have run whole, so the
// sentence states neither end: a delete that reads as refused destroys evidence in silence.
const UNSURE: Readonly<Record<StructureDeed, string>> = {
  create_relation: 'It is not known whether the relation was made.',
  delete_entity: 'It is not known whether the entity was deleted.',
  delete_relation: 'It is not known whether the relation was deleted.',
};

const READ_AGAIN = 'Read the record again before you act.';

// The next step of the analyst, which the sentence of the record does not carry. The record
// refuses the deletion of an element that another relation stands on, and it counts them.
const NEXT: Readonly<Record<StructureDeed, string>> = {
  create_relation: '',
  delete_entity: ' Delete each of those relations first, and then delete the entity again.',
  delete_relation: ' Delete each of those relations first, and then delete this relation again.',
};

// The writer owns this word, and it is the one mark of the refusal that a count belongs to.
const ENDPOINT = 'endpoint';

// Every refusal here came from the writer, which refuses before it opens a transaction.
const refusedWords = (deed: StructureDeed, refusal: string): string => {
  const next = refusal.includes(ENDPOINT) ? NEXT[deed] : '';
  return `Nothing was written. ${refusal}.${next}`;
};

const calm = (sentence: string): StructureSaid => ({ sentence, urgent: false });

/** The one sentence the page reads. It is derived here, and never composed in the view. */
export function structureSaid(state: StructureState): StructureSaid {
  switch (state.step) {
    case 'idle':
      return calm('');
    case 'working':
      return calm(WORKING[state.deed]);
    case 'signed':
      return calm(
        `${DONE[state.deed]} The act is in the record as one proposal, ${state.proposalId}.`,
      );
    case 'refused':
      return calm(refusedWords(state.deed, state.refusal));
    case 'undecided':
      return {
        sentence: `${UNSIGNED[state.deed]} The proposal is ${state.proposalId}. ${state.refusal}.`,
        urgent: true,
      };
    case 'unknown':
      return { sentence: `${UNSURE[state.deed]} ${READ_AGAIN} ${state.doubt}`, urgent: true };
  }
}

/** Send one act, and answer with the state the page stands in. It raises nothing. */
export async function changeStructure(act: StructureAct): Promise<StructureState> {
  const outcome = await writeElement(act);
  if (outcome.state === 'signed')
    return { step: 'signed', deed: act.op, proposalId: outcome.proposalId };
  if (outcome.state === 'undecided')
    return {
      step: 'undecided',
      deed: act.op,
      refusal: outcome.refusal,
      proposalId: outcome.proposalId,
    };
  if (outcome.state === 'unknown') return { step: 'unknown', deed: act.op, doubt: outcome.doubt };
  return { step: 'refused', deed: act.op, refusal: outcome.refusal };
}
