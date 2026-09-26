/** The act names only the column that changes, because the writer refuses an act that changes
 * nothing. A blank name is refused here before a round trip. */

import type { ElementAct } from '@/shared/write/elements';

export interface NameAndType {
  readonly label: string;
  readonly type: string;
}

type RenameDraft =
  | { readonly ready: true; readonly act: Extract<ElementAct, { op: 'update_entity' }> }
  | { readonly ready: false; readonly reason: string };

const NO_NAME = 'Write a name for the entity.';
const NO_CHANGE = 'Change the name or the type, and then save.';

export function readRenameDraft(
  entityId: string,
  stored: NameAndType,
  form: NameAndType,
): RenameDraft {
  const typed = form.label.trim();
  if (typed === '') return { ready: false, reason: NO_NAME };

  const label = typed === stored.label ? null : typed;
  const type = form.type === stored.type ? null : form.type;
  if (label !== null)
    return { ready: true, act: { op: 'update_entity', targetId: entityId, label, type } };
  if (type !== null)
    return { ready: true, act: { op: 'update_entity', targetId: entityId, label, type } };
  return { ready: false, reason: NO_CHANGE };
}

export function renameWords(draft: RenameDraft): string {
  if (!draft.ready) return draft.reason;
  const { label, type } = draft.act;
  if (label !== null && type !== null) return 'Ready to save a new name and a new type.';
  return label !== null ? 'Ready to save a new name.' : 'Ready to save a new type.';
}
