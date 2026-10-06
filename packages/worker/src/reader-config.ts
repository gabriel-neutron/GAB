import type { AgentModel } from '@gab/model';

/** What the operator sets for one reader. Each value is calibrated on real traffic, so no code
 * constant gives one. */
export interface ReaderConfig {
  readonly model: AgentModel;
  /** The family of the model. Two readers of one family share their blind spots. */
  readonly family: string;
  /** The tokens that one job may spend. */
  readonly tokenCap: number;
  /** The questions that one job may ask. */
  readonly turnCap: number;
  /** The longest chunk, in code points. */
  readonly chunkCap: number;
}

type Env = Readonly<Record<string, string | undefined>>;

const ENDPOINTS: readonly AgentModel['endpoint'][] = ['freellmapi', 'openrouter'];

const textOf = (env: Env, name: string): string => {
  const value = env[name]?.trim() ?? '';
  if (value === '')
    throw new Error(`${name} is empty or absent. Set it in the environment file, with no default.`);
  return value;
};

const numberOf = (env: Env, name: string, whole: boolean): number => {
  const text = textOf(env, name);
  const value = Number(text);
  const fits = Number.isFinite(value) && value > 0 && (!whole || Number.isInteger(value));
  if (!fits)
    throw new Error(
      `${name} is "${text}", and it must be a ${whole ? 'whole number' : 'number'} above zero.`,
    );
  return value;
};

/** Reads the configuration of one reader from the variables that start with `prefix`. It throws a
 * sentence that names the variable when a value is absent, blank or wrong. */
export const readReaderConfig = (prefix: string, env: Env): ReaderConfig => {
  const name = (part: string): string => `${prefix}_${part}`;

  const endpoint = textOf(env, name('ENDPOINT'));
  const known = ENDPOINTS.find((one) => one === endpoint);
  if (known === undefined)
    throw new Error(
      `${name('ENDPOINT')} is "${endpoint}", and it must be ${ENDPOINTS.join(' or ')}.`,
    );

  // The gateway picks the model of each call under `auto`, and the key of a reading then holds a
  // model that nobody pinned.
  const model = textOf(env, name('MODEL'));
  if (model.toLowerCase() === 'auto')
    throw new Error(`${name('MODEL')} is auto, and a reader runs on a pinned model.`);

  return {
    model: {
      endpoint: known,
      model,
      firstWaitMs: numberOf(env, name('FIRST_WAIT_MS'), true),
      waitGrowth: numberOf(env, name('WAIT_GROWTH'), false),
      maxWaitMs: numberOf(env, name('MAX_WAIT_MS'), true),
      timeoutMs: numberOf(env, name('TIMEOUT_MS'), true),
      maxAnswerTokens: numberOf(env, name('MAX_ANSWER_TOKENS'), true),
    },
    family: textOf(env, name('FAMILY')),
    tokenCap: numberOf(env, name('TOKEN_CAP'), true),
    turnCap: numberOf(env, name('TURN_CAP'), true),
    chunkCap: numberOf(env, name('CHUNK_CAP'), true),
  };
};

const sameFamily = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

/** The second reader, or null unless its switch is the word `true`. It throws when a value is
 * absent or wrong, and when its family is the family of the extractor: two readers of one family
 * share their errors, so their second reading proves nothing. */
export const readReader2 = (env: Env, extractor: ReaderConfig): ReaderConfig | null => {
  if (env['READER2_ENABLED'] !== 'true') return null;
  const config = readReaderConfig('READER2', env);
  if (sameFamily(config.family, extractor.family))
    throw new Error(
      `READER2_FAMILY is "${config.family}", the same family as EXTRACTOR_FAMILY. The second ` +
        'reader runs on a model of another family.',
    );
  return config;
};
