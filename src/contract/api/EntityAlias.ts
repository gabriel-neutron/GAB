import { z } from 'zod';

export default interface EntityAlias {
  absorbed_id: string | null;

  survivor_id: string | null;

  merged_at: string | null;
}

export const entityAlias = z.object({
  absorbed_id: z.uuid().nullable(),
  survivor_id: z.uuid().nullable(),
  merged_at: z.string().nullable(),
});
