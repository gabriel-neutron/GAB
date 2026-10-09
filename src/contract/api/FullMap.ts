import { z } from 'zod';

export default interface FullMap {
  id: string | null;

  type: string | null;

  label: string | null;

  geom: unknown;

  position_precision: string | null;

  parent_id: string | null;

  origin_label: string | null;

  position_precision_label: string | null;
}

export const fullMap = z.object({
  id: z.uuid().nullable(),
  type: z.string().nullable(),
  label: z.string().nullable(),
  geom: z.unknown(),
  position_precision: z.string().nullable(),
  parent_id: z.uuid().nullable(),
  origin_label: z.string().nullable(),
  position_precision_label: z.string().nullable(),
});
