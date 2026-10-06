import type { WriteRequest } from '@gab/proposal/request';

import { sendAct, type Signed } from './door';
import type { WriteResult } from './write-state';

/** Departure: each end of a new relation is an entity, so no relation is written on a relation.
 * A `null` name or type is a column the act leaves as it stands, and one of the two is set. */
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
  | Readonly<Extract<WriteRequest, { op: 'update_attrs' }>>
  | ({ readonly op: 'update_entity'; readonly targetId: string } & (
      | { readonly label: string; readonly type: string | null }
      | { readonly label: null; readonly type: string }
    ))
  | { readonly op: 'delete_entity'; readonly targetId: string }
  | { readonly op: 'delete_relation'; readonly targetId: string };

// External constraint: the request refuses a stated null, so an absent end of an interval, or a
// column the act leaves, is a key the body never carries. `JSON.stringify` drops a key whose
// value is undefined.
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
    case 'update_attrs':
      return { targetKind: act.targetKind, targetId: act.targetId, attrs: act.attrs };
    case 'update_entity':
      return {
        targetId: act.targetId,
        label: act.label ?? undefined,
        type: act.type ?? undefined,
      };
    case 'delete_entity':
    case 'delete_relation':
      return { targetId: act.targetId };
  }
};

/** Every failure arrives as a sentence, and never as a raised error: a screen that must report a
 * refusal cannot report it from a catch. */
export async function writeElement(act: ElementAct): Promise<WriteResult<Signed>> {
  return sendAct(act.op, bodyOf(act));
}
