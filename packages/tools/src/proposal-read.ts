import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

const READ = `SELECT id::text AS id, op, status, target_kind, target_id::text AS target_id,
         payload, src::text[] AS src, names::text[] AS names, author_role,
         created_at::text AS created_at, decided_at::text AS decided_at
  FROM api.proposal WHERE id = $1::uuid`;

const row = z.strictObject({
  id: z.uuid(),
  op: z.string(),
  status: z.string(),
  target_kind: z.string().nullable(),
  target_id: z.uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  src: z.array(z.string()),
  names: z.array(z.uuid()),
  author_role: z.string(),
  created_at: z.string(),
  decided_at: z.string().nullable(),
});

export const proposalRead = defineTool({
  name: 'proposal_read',
  description:
    'Reads one proposal: its act, its payload, the documents it cites, its status and the role ' +
    'that proposed it.',
  input: z.strictObject({ proposal: z.uuid() }),
  output: z.strictObject({
    id: z.uuid(),
    op: z.string(),
    status: z.string(),
    targetKind: z.string().nullable(),
    targetId: z.uuid().nullable(),
    payload: z.record(z.string(), z.unknown()),
    src: z.array(z.string()),
    names: z.array(z.uuid()),
    authorRole: z.string(),
    createdAt: z.string(),
    decidedAt: z.string().nullable(),
  }),
  async run(session, input) {
    const [held] = await rowsOf(session, row, READ, [input.proposal]);
    if (held === undefined) throw new ToolRefusal(`the proposal ${input.proposal} does not exist`);
    return {
      id: held.id,
      op: held.op,
      status: held.status,
      targetKind: held.target_kind,
      targetId: held.target_id,
      payload: held.payload,
      src: held.src,
      names: held.names,
      authorRole: held.author_role,
      createdAt: held.created_at,
      decidedAt: held.decided_at,
    };
  },
});
