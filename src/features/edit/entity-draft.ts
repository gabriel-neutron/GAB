/** The two boxes of the new entity, read into one act or into one sentence. The record is the
 * second tier and refuses what this misses; this tier gives a sentence before a round trip. */

import type { ElementAct } from '@/shared/write/elements';

/** What the analyst has typed. Both boxes are plain text, and a blank is the untouched state. */
export interface EntityForm {
  readonly type: string;
  readonly label: string;
}

/** The act the button will send, or the one sentence the analyst reads instead. */
export type EntityDraft =
  | { readonly ready: true; readonly act: Extract<ElementAct, { op: 'create_entity' }> }
  | { readonly ready: false; readonly reason: string };

const NOTHING = 'Write the type of the entity, and the name it stands under.';
const NO_TYPE = 'Write the type of the entity.';
const NO_NAME = 'Write the name the entity stands under.';

/** One typed form, read into the act it carries. A name of spaces alone is a blank name. */
export function readEntityDraft(form: EntityForm): EntityDraft {
  const type = form.type.trim();
  const label = form.label.trim();

  if (type === '' && label === '') return { ready: false, reason: NOTHING };
  if (type === '') return { ready: false, reason: NO_TYPE };
  if (label === '') return { ready: false, reason: NO_NAME };

  return { ready: true, act: { op: 'create_entity', type, label } };
}
