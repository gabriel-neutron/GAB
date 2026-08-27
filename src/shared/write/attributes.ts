// The act that changes an attribute. It names the keys it changes, and the door, the method and
// the status codes stay behind the request module it calls.

import type { WriteRequest } from '@gab/proposal/request';

import { sendAct, type WriteOutcome } from './door';

/** The body of the act, with `op` removed: the address states the act and the caller never does. */
export type AttributeChange = Omit<Extract<WriteRequest, { op: 'update_attrs' }>, 'op'>;

/** Change the attributes of one element. Every failure arrives as a sentence. */
export async function writeAttributes(change: AttributeChange): Promise<WriteOutcome> {
  return sendAct('update_attrs', { ...change });
}
