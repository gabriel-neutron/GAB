/** The boxes of a new relation, read into one act or into one sentence. The database is the
 * second tier and refuses what this misses; this tier gives a sentence before a round trip. */

import { DATED_RELATIONS } from '@gab/proposal/request';

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

// A day control gives these ten characters, and a browser that draws no day control gives
// plain text. The database holds a date and reads nothing else.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const NO_TYPE = 'Write the type of the relation.';
const NO_TARGET = 'Choose the entity at the other end.';
const NOT_A_DAY = 'Write each end of the interval as a year, a month and a day.';
const BACKWARDS = 'The interval starts after it ends. Correct one of the two days.';

const INTERVAL_BELONGS = `An interval belongs to a relation of ${DATED_RELATIONS.join(', ')}. Clear the two days, or write one of those types.`;

const blank = (given: string): string | null => (given.trim() === '' ? null : given.trim());

/** One typed form, read into the act it carries. `srcId` is the entity the address names. */
export function readLinkDraft(srcId: string, form: LinkForm): LinkDraft {
  const type = form.type.trim();
  const dstId = form.dstId.trim();
  const validFrom = blank(form.validFrom);
  const validTo = blank(form.validTo);

  if (type === '') return { ready: false, reason: NO_TYPE };
  if (dstId === '') return { ready: false, reason: NO_TARGET };

  const dated = validFrom !== null || validTo !== null;
  if (dated && !DATED_RELATIONS.some((word) => word === type))
    return { ready: false, reason: INTERVAL_BELONGS };
  if (validFrom !== null && !DAY.test(validFrom)) return { ready: false, reason: NOT_A_DAY };
  if (validTo !== null && !DAY.test(validTo)) return { ready: false, reason: NOT_A_DAY };
  if (validFrom !== null && validTo !== null && validFrom > validTo)
    return { ready: false, reason: BACKWARDS };

  return { ready: true, act: { op: 'create_relation', type, srcId, dstId, validFrom, validTo } };
}

const READY = 'Ready to make one relation from this entity.';

/** The one sentence the form reads. It stands beside `readLinkDraft` because the two run on one
 * state: what the boxes carry, and what that state says to a person. */
export function linkWords(draft: LinkDraft): string {
  return draft.ready ? READY : draft.reason;
}
