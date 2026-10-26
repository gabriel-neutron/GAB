import { z } from 'zod';

export default interface AreaCode {
  system: string | null;

  code: string | null;

  label: string | null;
}

export const areaCode = z.object({
  system: z.string().nullable(),
  code: z.string().nullable(),
  label: z.string().nullable(),
});
