import { z } from 'zod';

export default interface Proposal {
  id: string | null;

  op: string | null;

  target_kind: string | null;

  target_id: string | null;

  payload: unknown;

  src: string[] | null;

  names: string[] | null;

  prior_value: unknown;

  dissent: boolean | null;

  author_role: string | null;

  model_call_id: string | null;

  status: string | null;

  created_at: string | null;

  decided_at: string | null;

  decided_by: string | null;

  batch_id: string | null;

  proposer: string | null;
}

export const proposal = z.object({
  id: z.uuid().nullable(),
  op: z.string().nullable(),
  target_kind: z.string().nullable(),
  target_id: z.uuid().nullable(),
  payload: z.unknown(),
  src: z.string().array().nullable(),
  names: z.uuid().array().nullable(),
  prior_value: z.unknown(),
  dissent: z.boolean().nullable(),
  author_role: z.string().nullable(),
  model_call_id: z.uuid().nullable(),
  status: z.string().nullable(),
  created_at: z.string().nullable(),
  decided_at: z.string().nullable(),
  decided_by: z.string().nullable(),
  batch_id: z.uuid().nullable(),
  proposer: z.string().nullable(),
});
