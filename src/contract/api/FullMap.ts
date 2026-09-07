import { z } from 'zod';

export default interface FullMap {
  id: string | null;

  type: string | null;

  label: string | null;

  geom: unknown;
}

export const fullMap = z.object({
  id: z.uuid().nullable(),
  type: z.string().nullable(),
  label: z.string().nullable(),
  geom: z.unknown(),
});
