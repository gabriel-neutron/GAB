import { z } from 'zod';

// The boundary on what comes back. The service adds fields, so the shapes read what they need
// and let the rest go. An answer that does not agree with this shape is a fault of the service.
const usage = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

const choice = z.object({
  message: z.object({
    content: z.string().nullish(),
    refusal: z.string().nullish(),
  }),
  finish_reason: z.string().nullish(),
});

// `usage` is required. The cap is counted from it, and a cap that misses a call is not a cap.
export const completion = z.object({
  choices: z.array(choice).min(1),
  usage,
});

// `error_type` is the stable word. The service gives the same word for every upstream provider.
export const errorBody = z.object({
  error: z.object({
    message: z.string().nullish(),
    metadata: z.object({ error_type: z.string().nullish() }).nullish(),
  }),
});

/** The stable word of a refusal, and the sentence beside it, when the body carries them. */
export const refusalOf = (body: unknown): { word: string; said: string } => {
  const held = errorBody.safeParse(body);
  if (!held.success) return { word: '', said: '' };
  return {
    word: held.data.error.metadata?.error_type ?? '',
    said: (held.data.error.message ?? '').toLowerCase(),
  };
};
