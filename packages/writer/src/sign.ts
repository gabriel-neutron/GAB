import { proposalAct } from '@gab/proposal/payload';
import { writeRequest, type WRITE_OPS } from '@gab/proposal/request';
import { z } from 'zod';

import { readBody } from './body.ts';
import { DECIDED_BY } from './decision.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

const objectBody = z.record(z.string(), z.unknown());

const signedRow = z.object({ proposal_id: z.uuid(), target_id: z.uuid() });

// The door proposes the act and promotes it in one transaction, so the act is written whole or
// not at all. The database holds each rule on the act, and it words its own refusal.
const SIGN = `SELECT proposal_id, target_id FROM public.sign_change($1::text, $2::text,
  $3::jsonb, $4::text[], $5::text, $6::uuid, $7::uuid[])`;

// A top-level field such as `type` names the box the caller must correct, so it leads. A deeper
// path is the address of a value inside a schema, and it is no sentence for a person: the
// message of a nested issue already names the key, so the path is dropped.
const faulted = (issue: { readonly path: PropertyKey[]; readonly message: string }): string => {
  const [first] = issue.path;
  if (issue.path.length !== 1 || typeof first !== 'string') return issue.message;
  return `${first}: ${issue.message}`;
};

/** Sign one act of the operator. It raises nothing, and every failure arrives as a sentence. */
export const sign = async (
  pool: Sessions,
  op: (typeof WRITE_OPS)[number],
  raw: string,
): Promise<
  DoorAct<{ readonly proposalId: string; readonly targetId: string; readonly state: 'signed' }>
> => {
  const given = readBody(raw, objectBody, 'the body is not a JSON object');
  if (given.outcome !== 'read') return given;

  const request = writeRequest.safeParse({ ...given.body, op });
  if (!request.success) return refused(request.error.issues.map(faulted).join('; '));

  const act = proposalAct(request.data);
  const answer = await runStatement(pool, SIGN, [
    DECIDED_BY,
    act.op,
    JSON.stringify(act.payload),
    act.src,
    act.targetKind,
    act.targetId,
    act.names,
  ]);
  if (answer.outcome !== 'answered') return answer;

  const row = signedRow.parse(answer.rows[0]);
  return {
    outcome: 'done',
    reply: { proposalId: row.proposal_id, targetId: row.target_id, state: 'signed' },
  };
};
