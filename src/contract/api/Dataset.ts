import { z } from 'zod';

export default interface Dataset {
  disclaimer: string | null;
}

export const dataset = z.object({
  disclaimer: z.string().nullable(),
});
