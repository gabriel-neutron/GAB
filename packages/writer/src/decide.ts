import { decisionRequest, type DecisionOp } from '@gab/proposal/request';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

import { DECIDED_BY } from './decided-by.ts';
import { failureFrom, refusalFrom } from './refusal.ts';

/** What one decision became. `blocked` is the act the record refused, and nothing was written.
 * `undecided` is the act whose answer never came back: it may stand in the record. */
export type DecidedAct =
  | {
      readonly outcome: 'decided';
      readonly reply: {
        readonly proposalId: string;
        /** The row the promotion wrote. A rejection writes none, and it answers `null`. */
        readonly targetId: string | null;
        readonly state: 'decided';
      };
    }
  | {
      readonly outcome: 'refused' | 'blocked' | 'unavailable';
      readonly reply: { readonly refusal: string };
    }
  | {
      // The act is named, because a caller that cannot learn what landed reads the record again
      // under that name. A refusal names none, and the two answers never read alike.
      readonly outcome: 'undecided';
      readonly reply: { readonly refusal: string; readonly proposalId: string };
    };

const identifier = z.uuid();

const STATEMENT: Readonly<Record<DecisionOp, string>> = {
  promote_proposal: 'SELECT public.promote_proposal($1::uuid, $2::text) AS id',
  reject_proposal: 'SELECT public.reject_proposal($1::uuid, $2::text)',
};

// A promotion answers with the row it wrote. A rejection writes no row and answers nothing, so
// the reply carries `null` and the caller reads one shape for both acts.
const targetOf = (op: DecisionOp, row: Record<string, unknown> | undefined): string | null =>
  op === 'reject_proposal' ? null : identifier.parse(row?.['id']);

const take = async (
  client: PoolClient,
  op: DecisionOp,
  proposalId: string,
): Promise<DecidedAct> => {
  try {
    const found = await client.query<Record<string, unknown>>(STATEMENT[op], [
      proposalId,
      DECIDED_BY,
    ]);
    return {
      outcome: 'decided',
      reply: { proposalId, targetId: targetOf(op, found.rows[0]), state: 'decided' },
    };
  } catch (cause) {
    // A raised failure states the record moved under the analyst: the act is decided already,
    // or the row it names is gone. Nothing was written, and the queue must be read again.
    const failure = failureFrom(cause);
    if (failure.raised) return { outcome: 'blocked', reply: { refusal: failure.refusal } };
    // The statement may have run whole. The act keeps its name here, and the caller reads it
    // again in the record. A decision that landed must never be reported as a refusal.
    return { outcome: 'undecided', reply: { refusal: failure.doubt, proposalId } };
  }
};

/** Decide one act that waits. It raises nothing, and every failure arrives as a sentence. */
export const decide = async (pool: Pool, op: DecisionOp, raw: string): Promise<DecidedAct> => {
  let given: unknown;
  try {
    given = JSON.parse(raw);
  } catch {
    return { outcome: 'refused', reply: { refusal: 'the body is not a JSON object' } };
  }

  const request = decisionRequest.safeParse(given);
  if (!request.success) return { outcome: 'refused', reply: { refusal: 'the body names no act' } };

  // A pool that cannot give a client has reached no statement, so nothing was written and the
  // answer is a refusal of the service and not of the record.
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (cause) {
    return { outcome: 'unavailable', reply: { refusal: refusalFrom(cause) } };
  }

  try {
    return await take(client, op, request.data.proposalId);
  } finally {
    client.release();
  }
};
