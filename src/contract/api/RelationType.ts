import { z } from 'zod';

export default interface RelationType {
  key: string | null;

  label: string | null;

  inverse_label: string | null;

  takes_interval: boolean | null;

  retired: boolean | null;
}

export const relationType = z.object({
  key: z.string().nullable(),
  label: z.string().nullable(),
  inverse_label: z.string().nullable(),
  takes_interval: z.boolean().nullable(),
  retired: z.boolean().nullable(),
});
