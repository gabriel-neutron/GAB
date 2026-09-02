// One act on one element of the record: an entity or a relation is made, or one is destroyed.
// The body of each act, and the door it goes to, stay inside.

import { sendAct, type WriteOutcome } from './door';

/**
 * The four acts that change the shape of the record. Each end of a new relation is an entity:
 * a relation on a relation is read from the record and this screen writes none. */
export type ElementAct =
  | { readonly op: 'create_entity'; readonly type: string; readonly label: string }
  | {
      readonly op: 'create_relation';
      readonly type: string;
      readonly srcId: string;
      readonly dstId: string;
      readonly validFrom: string | null;
      readonly validTo: string | null;
    }
  | { readonly op: 'delete_entity'; readonly targetId: string }
  | { readonly op: 'delete_relation'; readonly targetId: string };

// An absent end of an interval is a key the body never carries: the request refuses a stated
// null, and `JSON.stringify` drops a key whose value is undefined.
const bodyOf = (act: ElementAct): Readonly<Record<string, unknown>> => {
  switch (act.op) {
    case 'create_entity':
      return { type: act.type, label: act.label };
    case 'create_relation':
      return {
        type: act.type,
        srcId: act.srcId,
        dstId: act.dstId,
        validFrom: act.validFrom ?? undefined,
        validTo: act.validTo ?? undefined,
      };
    case 'delete_entity':
    case 'delete_relation':
      return { targetId: act.targetId };
  }
};

/** Make one element, or destroy one. Every failure arrives as a sentence, and never as a raised
 * error: a screen that must report a refusal cannot report it from a catch. */
export async function writeElement(act: ElementAct): Promise<WriteOutcome> {
  return sendAct(act.op, bodyOf(act));
}
