import { z } from 'zod';

export default interface Entity {
  id: string | null;

  type: string | null;

  proposed_type: string | null;

  label: string | null;

  geom: unknown;

  attrs: unknown;

  sources: string[] | null;

  promoted_from: string | null;

  created_at: string | null;

  updated_at: string | null;
}

export const entity = z.object({
  id: z.uuid().nullable(),
  type: z.string().nullable(),
  proposed_type: z.string().nullable(),
  label: z.string().nullable(),
  geom: z.unknown(),
  attrs: z.unknown(),
  sources: z.string().array().nullable(),
  promoted_from: z.uuid().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});
