import { z } from 'zod';

export default interface Relation {
  id: string | null;

  type: string | null;

  src_kind: string | null;

  src_id: string | null;

  dst_kind: string | null;

  dst_id: string | null;

  valid_from: string | null;

  valid_to: string | null;

  attrs: unknown;

  sources: string[] | null;

  promoted_from: string | null;

  created_at: string | null;

  updated_at: string | null;
}

export const relation = z.object({
  id: z.uuid().nullable(),
  type: z.string().nullable(),
  src_kind: z.string().nullable(),
  src_id: z.uuid().nullable(),
  dst_kind: z.string().nullable(),
  dst_id: z.uuid().nullable(),
  valid_from: z.string().nullable(),
  valid_to: z.string().nullable(),
  attrs: z.unknown(),
  sources: z.string().array().nullable(),
  promoted_from: z.uuid().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
