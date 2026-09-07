import { z } from 'zod';

export default interface FullGraph {
  id: string | null;

  type: string | null;

  label: string | null;

  x: number | null;

  y: number | null;
}

export const fullGraph = z.object({
  id: z.uuid().nullable(),
  type: z.string().nullable(),
  label: z.string().nullable(),
  x: z.number().nullable(),
  y: z.number().nullable(),
});
