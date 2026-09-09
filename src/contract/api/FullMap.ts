import { z } from 'zod';

export default interface FullMap {
  id: string | null;

  type: string | null;

  label: string | null;

  geom: unknown;

  position_precision: string | null;

  parent_id: string | null;
}

export const fullMap = z.object({
  id: z.uuid().nullable(),
  type: z.string().nullable(),
  label: z.string().nullable(),
  geom: z.unknown(),
  position_precision: z.string().nullable(),
  parent_id: z.uuid().nullable(),
});
