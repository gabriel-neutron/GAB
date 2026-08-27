import { z } from 'zod';

export default interface KeyUsage {
  key: string | null;

  stem: string | null;

  kind: string | null;

  unit: string | null;

  retired: boolean | null;

  entity_type: string | null;

  claims: number | null;
}

export const keyUsage = z.object({
  key: z.string().nullable(),
  stem: z.string().nullable(),
  kind: z.string().nullable(),
  unit: z.string().nullable(),
  retired: z.boolean().nullable(),
  entity_type: z.string().nullable(),
  claims: z.number().nullable(),
});
