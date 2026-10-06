import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const MAX_PROPOSALS = 200;

const STATUSES = ['pending', 'accepted', 'rejected'] as const;

// One text for each case, so each filter that the caller leaves out is a null that holds for each
// row. An act touches an entity as its target or as one of the elements it names.
const LIST = `SELECT id::text AS id, op, status, target_kind, target_id::text AS target_id,
         payload, src::text[] AS src, names::text[] AS names, dissent, author_role,
         created_at::text AS created_at, decided_at::text AS decided_at
    FROM api.proposal
   WHERE ($1::uuid IS NULL OR target_id = $1::uuid OR $1::uuid = ANY(names))
     AND ($2::text IS NULL OR $2::text = ANY(src::text[]))
     AND ($3::text IS NULL OR status = $3::text)
   ORDER BY created_at DESC, id
   LIMIT $4::int`;

const row = z.strictObject({
  id: z.uuid(),
  op: z.string(),
  status: z.string(),
  target_kind: z.string().nullable(),
  target_id: z.uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
  src: z.array(z.string()),
  names: z.array(z.uuid()),
  dissent: z.boolean(),
  author_role: z.string(),
  created_at: z.string(),
  decided_at: z.string().nullable(),
});

export const listProposals = defineTool({
  name: 'list_proposals',
  description:
    'Lists the proposals, newest first: those that touch one entity, those that cite one ' +
    'document, or the whole queue. The status is pending when you give none; give "any" for ' +
    'each status. Call it before you ' +
    'propose, so you do not propose a fact that waits in the queue. "disputed" says that a value ' +
    'of the act is not in its excerpt, or that a second model did not find it supported.',
  input: z.strictObject({
    entity: z.uuid().optional().describe('the id of an entity that the act targets or names'),
    document: documentId.optional().describe('the id of a document that the act cites'),
    status: z.enum([...STATUSES, 'any']).default('pending'),
    limit: z.number().int().min(1).max(MAX_PROPOSALS).default(50),
  }),
  output: z.strictObject({
    proposals: z.array(
      z.strictObject({
        id: z.uuid(),
        op: z.string(),
        status: z.string(),
        targetKind: z.string().nullable(),
        targetId: z.uuid().nullable(),
        payload: z.record(z.string(), z.unknown()),
        documents: z.array(z.string()),
        names: z.array(z.uuid()),
        disputed: z.boolean(),
        authorRole: z.string(),
        createdAt: z.string(),
        decidedAt: z.string().nullable(),
      }),
    ),
  }),
  async run(session, input) {
    const found = await rowsOf(session, row, LIST, [
      input.entity ?? null,
      input.document ?? null,
      input.status === 'any' ? null : input.status,
      input.limit,
    ]);
    return {
      proposals: found.map((held) => ({
        id: held.id,
        op: held.op,
        status: held.status,
        targetKind: held.target_kind,
        targetId: held.target_id,
        payload: held.payload,
        documents: held.src,
        names: held.names,
        disputed: held.dissent,
        authorRole: held.author_role,
        createdAt: held.created_at,
        decidedAt: held.decided_at,
      })),
    };
  },
});
