import { machineAct } from '@gab/proposal/machine';
import { writeRequest } from '@gab/proposal/request';
import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool, ToolRefusal, type Session } from './tool.ts';

// A machine proposes a new fact or a new attribute with the document that holds it. A change of a
// name or a type and a deletion rewrite what the operator already decided, and no machine
// proposes one through this tool.
const PROPOSED_OPS: readonly string[] = ['create_entity', 'create_relation', 'update_attrs'];

const MAX_DOCUMENTS = 20;

const PROPOSE = `SELECT public.propose_change($1::text, $2::jsonb, $3::text[], $4::text,
  $5::uuid, $6::uuid[], NULL, false, $7::uuid)::text AS id`;

const identified = z.strictObject({ id: z.uuid() });

const held = z.strictObject({ attrs: z.unknown() });

const TABLE = { entity: 'api.entity', relation: 'api.relation' } as const;

type Endpoint = keyof typeof TABLE;

const attributesOf = async (session: Session, kind: Endpoint, id: string): Promise<unknown> => {
  const found = await rowsOf(
    session,
    held,
    `SELECT attrs FROM ${TABLE[kind]} WHERE id = $1::uuid`,
    [id],
  );
  return found[0]?.attrs;
};

const present = async (session: Session, kind: Endpoint, id: string): Promise<boolean> =>
  (
    await rowsOf(
      session,
      identified,
      `SELECT id::text AS id FROM ${TABLE[kind]} WHERE id = $1::uuid`,
      [id],
    )
  ).length === 1;

// The promotion fails on an end that does not exist, after the proposal is stored. The read here
// removes a failure that nobody chose.
const missingEnd = async (
  session: Session,
  request: z.output<typeof writeRequest>,
): Promise<string | null> => {
  if (request.op !== 'create_relation') return null;
  if (!(await present(session, request.srcKind, request.srcId)))
    return `the source ${request.srcId} does not exist`;
  if (!(await present(session, request.dstKind, request.dstId)))
    return `the target ${request.dstId} does not exist`;
  return null;
};

export const proposeChange = defineTool({
  name: 'propose_change',
  description:
    'Proposes one change to the record: a new entity, a new relation between two entities, or ' +
    'attributes to add to an entity or a relation. You name the documents that hold the claim, ' +
    'and the proposal cites those and no others. The change waits for the operator to decide. ' +
    'Call lookup_entity first, so you do not propose an entity the record already holds.',
  input: z.strictObject({
    act: writeRequest.refine((act) => PROPOSED_OPS.includes(act.op), {
      message: `a machine proposes one of ${PROPOSED_OPS.join(', ')}`,
    }),
    documents: z.array(documentId).min(1).max(MAX_DOCUMENTS),
    modelCallId: z.uuid().optional(),
  }),
  output: z.strictObject({ proposalId: z.uuid(), op: z.string() }),
  async run(session, input) {
    // The check runs before any SQL. An attribute update reads the target next, and this pass
    // reads an empty target, so every refusal that does not depend on the target is raised here.
    const checked = machineAct(input.act, input.documents, {});
    if (!checked.ready) throw new ToolRefusal(checked.refusal);

    const gap = await missingEnd(session, input.act);
    if (gap !== null) throw new ToolRefusal(gap);

    let prior: unknown = null;
    if (input.act.op === 'update_attrs') {
      prior = await attributesOf(session, input.act.targetKind, input.act.targetId);
      if (prior === undefined)
        throw new ToolRefusal(`the target ${input.act.targetId} does not exist`);
    }

    const draft = machineAct(input.act, input.documents, prior);
    if (!draft.ready) throw new ToolRefusal(draft.refusal);
    const { act } = draft;

    const [made] = await rowsOf(session, identified, PROPOSE, [
      act.op,
      JSON.stringify(act.payload),
      [...act.src],
      act.targetKind,
      act.targetId,
      [...act.names],
      input.modelCallId ?? null,
    ]);
    if (made === undefined)
      throw new Error('the door stored a proposal and returned no identifier');
    return { proposalId: made.id, op: act.op };
  },
});
