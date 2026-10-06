import { z } from 'zod';

// The boundary on what comes back. The service adds fields, and each shape reads the fields it
// needs. A shape keeps no other field. An answer that does not agree with a shape is a fault of
// the service.
const usage = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});

const choice = z.object({
  message: z.object({
    content: z.string().nullish(),
    refusal: z.string().nullish(),
    tool_calls: z
      .array(
        z.object({
          id: z.string().min(1),
          function: z.object({ name: z.string().min(1), arguments: z.string() }),
        }),
      )
      .nullish(),
  }),
  finish_reason: z.string().nullish(),
});

// `usage` is required. The cap is counted from it, and a cap that misses a call is not a cap.
// `model` names the model that answered. A gateway can route a call to another model, and a body
// with no name cannot prove otherwise.
export const completion = z.object({
  model: z.string().nullish(),
  choices: z.array(choice).min(1),
  usage,
});

// A body the completion shape refuses can still carry the figure of what the call cost. The
// count comes from the service alone, and nothing here estimates one.
const paid = z.object({ usage });

/** The token count the service states, or zero when the body carries none. */
export const tokensOf = (body: unknown): number => {
  const held = paid.safeParse(body);
  return held.success ? held.data.usage.total_tokens : 0;
};

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
