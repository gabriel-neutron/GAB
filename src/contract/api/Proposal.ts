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

  confidence: number | null;

  dissent: boolean | null;

  author_role: string | null;

  status: string | null;

  created_at: string | null;

  decided_at: string | null;

  decided_by: string | null;
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
  confidence: z.number().nullable(),
  dissent: z.boolean().nullable(),
  author_role: z.string().nullable(),
  status: z.string().nullable(),
  created_at: z.string().nullable(),
  decided_at: z.string().nullable(),
  decided_by: z.string().nullable(),
});
