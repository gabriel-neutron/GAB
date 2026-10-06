import {
  createOpenAICompatible,
  OpenAICompatibleChatLanguageModel,
} from '@ai-sdk/openai-compatible';
import { z } from 'zod';

/** The name of the free-model gateway. The adapter refuses a model of any other provider. */
export const GATEWAY = 'freellmapi';

type Env = Readonly<Record<string, string | undefined>>;

type Fetch = typeof fetch;

const filled = z.string().trim().min(1);

const read = (env: Env, name: string, shape: z.ZodType<string>): string => {
  const held = shape.safeParse(env[name]?.trim());
  if (!held.success)
    throw new Error(`${name} is empty, absent or wrong. Set it in the environment file.`);
  return held.data;
};

/** Checks the name of a pinned model and gives it back. Under `auto` the gateway picks the model
 * of each call, so one job could hold the work of two models. A pinned name is the only name that
 * makes the served model checkable. */
export const pinnedName = (pinned: string): string => {
  const id = filled.parse(pinned);
  if (id.toLowerCase() === 'auto') throw new Error('a model is pinned and never `auto`');
  return id;
};

/** The one model of the free-model gateway that an agent pins. The address of the gateway depends
 * on the machine that hosts it, so the environment gives it and no code constant does. It throws
 * when a variable is absent or when the name is `auto`. */
export const gatewayModel = (
  pinned: string,
  env: Env = process.env,
  send?: Fetch,
): OpenAICompatibleChatLanguageModel => {
  const id = pinnedName(pinned);

  const provider = createOpenAICompatible({
    name: GATEWAY,
    baseURL: read(env, 'FREELLMAPI_BASE_URL', z.url()).replace(/\/+$/u, ''),
    apiKey: read(env, 'FREELLMAPI_API_KEY', filled),
    ...(send === undefined ? {} : { fetch: send }),
  });
  const made = provider.chatModel(id);
  if (!(made instanceof OpenAICompatibleChatLanguageModel))
    throw new Error('the provider made no chat model');
  return made;
};
