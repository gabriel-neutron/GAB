/** One act on the screen, two things in the record: a proposal, and the entity it promoted. This
 * file holds the words of that act. */

import type { Said } from '@/shared/said';
import type { Signed } from '@/shared/write/door';
import { writeElement, type ElementAct } from '@/shared/write/elements';
import { writeSaid, type WriteResult, type WriteState } from '@/shared/write/write-state';

import type { EntityDraft } from './entity-draft';

export type CreateState = WriteState<Signed>;

// A type the record does not hold is taken and never refused: the entity stands as `unknown`
// and the word keeps its place beside it, so an extraction is never lost to a vocabulary.
const READY =
  'Ready to make one entity. A type the record does not hold stands as unknown, and the word you wrote is kept beside it.';

/** The one sentence the dialog reads, and whether it interrupts. It is derived here, and never
 * composed in the view. */
export function creationSaid(state: CreateState, draft: EntityDraft): Said {
  return writeSaid<Signed, object>(state, {
    idle: draft.ready ? READY : draft.reason,
    working: () => 'The new entity is going to the record.',
    done: (done) =>
      `The entity is signed manual. It is in the record as one proposal, ${done.proposalId}.`,
    unknown: () =>
      'It is not known whether the entity was made. Read the record again before you act.',
  });
}

/** Send one act, and answer with the result the dialog stands in. It raises nothing. */
export async function createEntity(
  act: Extract<ElementAct, { op: 'create_entity' }>,
): Promise<WriteResult<Signed>> {
  return writeElement(act);
}
