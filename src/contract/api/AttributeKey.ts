import { z } from 'zod';

export default interface AttributeKey {
  key: string | null;

  stem: string | null;

  kind: string | null;

  label: string | null;

  unit: string | null;

  pattern: string | null;

  retired: boolean | null;
}

export const attributeKey = z.object({
  key: z.string().nullable(),
  stem: z.string().nullable(),
  kind: z.string().nullable(),
  label: z.string().nullable(),
  unit: z.string().nullable(),
  pattern: z.string().nullable(),
  retired: z.boolean().nullable(),
});
