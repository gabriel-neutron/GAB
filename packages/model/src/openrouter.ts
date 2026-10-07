import {
  createOpenAICompatible,
  OpenAICompatibleChatLanguageModel,
} from '@ai-sdk/openai-compatible';
import { z } from 'zod';

/** The name of the one provider. The adapter refuses a model of any other provider. */
export const PROVIDER = 'openrouter';

const OPENROUTER = 'https://openrouter.ai/api/v1';

type Env = Readonly<Record<string, string | undefined>>;

type Fetch = typeof fetch;

const filled = z.string().trim().min(1);

const read = (env: Env, name: string, shape: z.ZodType<string>): string => {
  const held = shape.safeParse(env[name]?.trim());
  if (!held.success)
    throw new Error(`${name} is empty, absent or wrong. Set it in the environment file.`);
  return held.data;
};

/** Checks the name of a pinned model and gives it back. Under `auto` the router picks the model
 * of each call, so one job could hold the work of two models. A pinned name is the only name that
 * makes the served model checkable. */
export const pinnedName = (pinned: string): string => {
  const id = filled.parse(pinned);
  if (id.toLowerCase() === 'auto') throw new Error('a model is pinned and never `auto`');
  return id;
};

// A prompt of the research can name a party before a source supports it. `data_collection` keeps
// the prompt from a provider that stores it or trains on it. `require_parameters` keeps the
// router from a provider that drops the tools or the JSON answer format, and then answers in
// prose. No list of other models is sent, so the router never swaps the pinned model.
const ROUTING = { data_collection: 'deny', require_parameters: true } as const;

/** The one model of OpenRouter that an agent pins. The key comes from the environment. The
 * address is OpenRouter, and `OPENROUTER_BASE_URL` changes it only for a proxy or a test double.
 * It throws when the key is absent or when the name is `auto`. */
export const openrouterModel = (
  pinned: string,
  env: Env = process.env,
  send?: Fetch,
): OpenAICompatibleChatLanguageModel => {
  const id = pinnedName(pinned);
  const given = env['OPENROUTER_BASE_URL']?.trim() ?? '';

  const provider = createOpenAICompatible({
    name: PROVIDER,
    baseURL: (given === '' ? OPENROUTER : given).replace(/\/+$/u, ''),
    apiKey: read(env, 'OPENROUTER_API_KEY', filled),
    transformRequestBody: (body) => ({ ...body, provider: ROUTING }),
    ...(send === undefined ? {} : { fetch: send }),
  });
  const made = provider.chatModel(id);
  if (!(made instanceof OpenAICompatibleChatLanguageModel))
    throw new Error('the provider made no chat model');
  return made;
};
