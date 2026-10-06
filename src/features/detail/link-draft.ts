/** The boxes of a new relation, read into one act or into one sentence. The form asks only for
 * what the button needs; the record holds each rule on the interval, and words its refusal. */

import type { ElementAct } from '@/shared/write/elements';

/** What the analyst has typed. A blank box is the untouched state, and never a stated absence. */
export interface LinkForm {
  readonly type: string;
  readonly dstId: string;
  readonly validFrom: string;
  readonly validTo: string;
}

/** The act the button will send, or the one sentence the analyst reads instead. */
export type LinkDraft =
  | { readonly ready: true; readonly act: Extract<ElementAct, { op: 'create_relation' }> }
  | { readonly ready: false; readonly reason: string };

const NO_TYPE = 'Write the type of the relation.';
const NO_TARGET = 'Choose the entity at the other end.';

const blank = (given: string): string | null => (given.trim() === '' ? null : given.trim());

/** One typed form, read into the act it carries. `srcId` is the entity the address names. */
export function readLinkDraft(srcId: string, form: LinkForm): LinkDraft {
  const type = form.type.trim();
  const dstId = form.dstId.trim();
  const validFrom = blank(form.validFrom);
  const validTo = blank(form.validTo);

  if (type === '') return { ready: false, reason: NO_TYPE };
  if (dstId === '') return { ready: false, reason: NO_TARGET };
  return { ready: true, act: { op: 'create_relation', type, srcId, dstId, validFrom, validTo } };
}

const READY = 'Ready to make one relation from this entity.';

/** The one sentence the form reads. It stands beside `readLinkDraft` because the two run on one
 * state: what the boxes carry, and what that state says to a person. */
export function linkWords(draft: LinkDraft): string {
  return draft.ready ? READY : draft.reason;
}
