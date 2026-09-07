import { z } from 'zod';

export default interface Layout {
  entity_id: string | null;

  x: number | null;

  y: number | null;
}

export const layout = z.object({
  entity_id: z.uuid().nullable(),
  x: z.number().nullable(),
  y: z.number().nullable(),
});
