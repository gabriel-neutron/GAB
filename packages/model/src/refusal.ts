import { z } from 'zod';

// `error_type` is the stable word. The service gives the same word for every upstream provider.
const errorBody = z.object({
  error: z.object({
    message: z.string().nullish(),
    code: z.union([z.string(), z.number()]).nullish(),
    type: z.string().nullish(),
    metadata: z.object({ error_type: z.string().nullish() }).nullish(),
  }),
});

// The word and the sentence are both lowercase here. An upstream provider writes the word in
// its own case, and a comparison against a lowercase word then fails.
/** The stable word of a refusal, and the sentence beside it, when the body carries them. */
export const refusalOf = (body: unknown): { word: string; said: string } => {
  const held = errorBody.safeParse(body);
  if (!held.success) return { word: '', said: '' };
  return {
    word: String(
      held.data.error.metadata?.error_type ?? held.data.error.code ?? held.data.error.type ?? '',
    ).toLowerCase(),
    said: (held.data.error.message ?? '').toLowerCase(),
  };
};
