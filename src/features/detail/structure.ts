import { calm, interrupt, type Said } from '@/shared/said';
import { writeElement, type ElementAct } from '@/shared/write/elements';

/** Departure: making an entity has no entity to hang on, and the claim panel saves each
 * attribute, so neither act is on this page. */
export type StructureAct = Exclude<ElementAct, { op: 'create_entity' | 'update_attrs' }>;

export type StructureDeed = StructureAct['op'];

type DeletionDeed = Extract<StructureDeed, 'delete_entity' | 'delete_relation'>;

export type StructureState =
  | { readonly step: 'idle' }
  | { readonly step: 'working'; readonly deed: StructureDeed }
  | { readonly step: 'signed'; readonly deed: StructureDeed; readonly proposalId: string }
  | { readonly step: 'refused'; readonly deed: StructureDeed; readonly refusal: string }
  | { readonly step: 'blocked'; readonly deed: DeletionDeed; readonly refusal: string }
  | {
      readonly step: 'undecided';
      readonly deed: StructureDeed;
      readonly refusal: string;
      readonly proposalId: string;
    }
  | { readonly step: 'unknown'; readonly deed: StructureDeed; readonly doubt: string };

const WORKING: Readonly<Record<StructureDeed, string>> = {
  create_relation: 'The new relation is going to the record.',
  update_entity: 'The new name or type is going to the record.',
  delete_entity: 'The deletion of the entity is going to the record.',
  delete_relation: 'The deletion of the relation is going to the record.',
};

const DONE: Readonly<Record<StructureDeed, string>> = {
  create_relation: 'The relation is made, and it is signed manual.',
  update_entity: 'The name and the type are saved, and they are signed manual.',
  delete_entity: 'The entity is deleted.',
  delete_relation: 'The relation is deleted.',
};

// The proposal committed and the promotion rolled back, so the element stands as it stood. The
// state of the element is what the analyst reads, and the record states only the refusal.
const UNSIGNED: Readonly<Record<StructureDeed, string>> = {
  create_relation:
    'The relation is not made, and an unsigned proposal to make it is in the record.',
  update_entity:
    'The name and the type are not changed, and an unsigned proposal to change them is in the record.',
  delete_entity:
    'The entity is not deleted, and an unsigned proposal to delete it is in the record.',
  delete_relation:
    'The relation is not deleted, and an unsigned proposal to delete it is in the record.',
};

// The request left the browser and no answer came back. The act may have run whole, so the
// sentence states neither end: a delete that reads as refused destroys evidence in silence.
const UNSURE: Readonly<Record<StructureDeed, string>> = {
  create_relation: 'It is not known whether the relation was made.',
  update_entity: 'It is not known whether the name or the type was changed.',
  delete_entity: 'It is not known whether the entity was deleted.',
  delete_relation: 'It is not known whether the relation was deleted.',
};

const READ_AGAIN = 'Read the record again before you act.';

// The next step of the analyst, which the sentence of the record does not carry. The record
// refuses the deletion of an element that another relation stands on, and it counts them.
const NEXT: Readonly<Record<DeletionDeed, string>> = {
  delete_entity: 'Delete each of those relations first, and then delete the entity again.',
  delete_relation: 'Delete each of those relations first, and then delete this relation again.',
};

// Every refusal here came from the writer, which refuses before it opens a transaction.
const refusedWords = (refusal: string): string => `Nothing was written. ${refusal}.`;

/** The one sentence the page reads. It is derived here, and never composed in the view. */
export function structureSaid(state: StructureState): Said {
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
      return calm(refusedWords(state.refusal));
    case 'blocked':
      return calm(`${refusedWords(state.refusal)} ${NEXT[state.deed]}`);
    case 'undecided':
      return interrupt(
        `${UNSIGNED[state.deed]} The proposal is ${state.proposalId}. ${state.refusal}.`,
      );
    case 'unknown':
      return interrupt(`${UNSURE[state.deed]} ${READ_AGAIN} ${state.doubt}`);
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
  if (outcome.state === 'blocked' && (act.op === 'delete_entity' || act.op === 'delete_relation'))
    return { step: 'blocked', deed: act.op, refusal: outcome.refusal };
  return { step: 'refused', deed: act.op, refusal: outcome.refusal };
}
