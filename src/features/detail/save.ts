/** One act on the screen, two things in the record: a proposal, and the value it promoted. This
 * file holds the words of that act. */

import type { AttributeEdit } from '@gab/proposal/attribute-value';

import type { Said } from '@/shared/said';
import type { Signed } from '@/shared/write/door';
import { writeElement } from '@/shared/write/elements';
import { writeSaid, type WriteResult, type WriteState } from '@/shared/write/write-state';

import type { PendingEdit } from './draft';

export type SaveState = WriteState<Signed>;

const ready = (count: number): string =>
  count === 1 ? 'One value stands ready to save.' : `${count} values stand ready to save.`;

/** The one sentence the panel reads, and whether it interrupts. It is derived here, and never
 * composed in the view. */
export function saveSaid(state: SaveState, edit: PendingEdit): Said {
  return writeSaid<Signed, object>(state, {
    idle: edit.ready ? ready(edit.count) : edit.reason,
    working: () => 'The change is going to the record.',
    done: (done) =>
      `The value is signed manual. The change is in the record as one proposal, ${done.proposalId}.`,
    unknown: () =>
      'It is not known whether the change was written. Read the record again before you act.',
  });
}

/** Send one act, and answer with the result the panel stands in. It raises nothing. */
export async function saveClaims(
  entityId: string,
  attrs: AttributeEdit,
): Promise<WriteResult<Signed>> {
  return writeElement({ op: 'update_attrs', targetKind: 'entity', targetId: entityId, attrs });
}
