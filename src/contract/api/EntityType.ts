import { z } from 'zod';

export default interface EntityType {
  key: string | null;

  label: string | null;

  colour_light: string | null;

  colour_dark: string | null;

  ord: number | null;

  retired: boolean | null;
}

export const entityType = z.object({
  key: z.string().nullable(),
  label: z.string().nullable(),
  colour_light: z.string().nullable(),
  colour_dark: z.string().nullable(),
  ord: z.number().nullable(),
  retired: z.boolean().nullable(),
});
