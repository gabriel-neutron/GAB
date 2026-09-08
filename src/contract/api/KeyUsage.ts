import { z } from 'zod';

export default interface KeyUsage {
  key: string | null;

  owner_kind: string | null;

  owner_type: string | null;

  claims: number | null;
}

export const keyUsage = z.object({
  key: z.string().nullable(),
  owner_kind: z.string().nullable(),
  owner_type: z.string().nullable(),
  claims: z.number().nullable(),
});
