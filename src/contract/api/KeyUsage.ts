import { z } from 'zod';

export default interface KeyUsage {
  key: string | null;

  owner_kind: string | null;

  owner_type: string | null;

  declared: boolean | null;

  stem: string | null;

  kind: string | null;

  unit: string | null;

  retired: boolean | null;

  claims: number | null;
}

export const keyUsage = z.object({
  key: z.string().nullable(),
  owner_kind: z.string().nullable(),
  owner_type: z.string().nullable(),
  declared: z.boolean().nullable(),
  stem: z.string().nullable(),
  kind: z.string().nullable(),
  unit: z.string().nullable(),
  retired: z.boolean().nullable(),
  claims: z.number().nullable(),
});
