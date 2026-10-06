import type { Said } from '@/shared/said';
import type { Signed } from '@/shared/write/door';
import { writeElement, type ElementAct } from '@/shared/write/elements';
import { writeSaid, type WriteState } from '@/shared/write/write-state';

/** Departure: making an entity has no entity to hang on, and the claim panel saves each
 * attribute, so neither act is on this page. */
export type StructureAct = Exclude<ElementAct, { op: 'create_entity' | 'update_attrs' }>;

export type StructureDeed = StructureAct['op'];

/** Each step that is not idle names the act it is about. */
export type StructureState = WriteState<Signed, { readonly deed: StructureDeed }>;

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

// The request left the browser and no answer came back. The act may have run whole, so the
// sentence states neither end: a delete that reads as refused destroys evidence in silence.
const UNSURE: Readonly<Record<StructureDeed, string>> = {
  create_relation: 'It is not known whether the relation was made.',
  update_entity: 'It is not known whether the name or the type was changed.',
  delete_entity: 'It is not known whether the entity was deleted.',
  delete_relation: 'It is not known whether the relation was deleted.',
};

/** The one sentence the page reads. It is derived here, and never composed in the view. */
export function structureSaid(state: StructureState): Said {
  return writeSaid<Signed, { readonly deed: StructureDeed }>(state, {
    idle: '',
    working: ({ deed }) => WORKING[deed],
    done: ({ deed, proposalId }) =>
      `${DONE[deed]} The act is in the record as one proposal, ${proposalId}.`,
    unknown: ({ deed }) => `${UNSURE[deed]} Read the record again before you act.`,
  });
}

/** Send one act, and answer with the state the page stands in. It raises nothing. */
export async function changeStructure(act: StructureAct): Promise<StructureState> {
  return { ...(await writeElement(act)), deed: act.op };
}
