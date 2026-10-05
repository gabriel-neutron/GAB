import { z } from 'zod';

export default interface DocumentProvider {
  id: string | null;

  name: string | null;

  licence: string | null;
}

export const documentProvider = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  licence: z.string().nullable(),
});
