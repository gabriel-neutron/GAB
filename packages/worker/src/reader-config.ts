import { checkLine, checkTokenCap, pinnedName, type ModelLine } from '@gab/model';

import { checkChunkCap } from './chunk.ts';

/** One pinned model of OpenRouter, its family, and how the adapter reaches it. */
export interface ModelConfig {
  readonly model: string;
  /** The family of the model. A check by a model of the same family shares its blind spots. */
  readonly family: string;
  readonly line: ModelLine;
}

/** What the operator sets for the extractor. Each value is calibrated on real traffic, so no
 * code constant gives one. */
export interface ReaderConfig {
  readonly reader: ModelConfig;
  /** The model of another family that checks each item against its passage. */
  readonly checker: ModelConfig;
  /** The tokens that one job may spend, on both models together. */
  readonly tokenCap: number;
  /** The questions that the reader may ask in one job. */
  readonly turnCap: number;
  /** The longest chunk, in code points. */
  readonly chunkCap: number;
}

/** What the operator sets for the lead agent. */
export interface LeadConfig {
  /** The pinned model that chooses the searches and the pages. */
  readonly model: ModelConfig;
  /** The tokens that one lead may spend. A lead has no page limit, so this is its one stop. */
  readonly tokenCap: number;
}

/** What the operator sets for the mapper. */
export interface MapperConfig {
  /** The pinned model that maps the columns of a table. */
  readonly model: ModelConfig;
  /** The tokens that one mapping may spend. */
  readonly tokenCap: number;
}

type Env = Readonly<Record<string, string | undefined>>;

const textOf = (env: Env, name: string): string => {
  const value = env[name]?.trim() ?? '';
  if (value === '')
    throw new Error(`${name} is empty or absent. Set it in the environment file, with no default.`);
  return value;
};

const numberOf = (env: Env, name: string): number => {
  const text = textOf(env, name);
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error(`${name} is "${text}", and it is not a number.`);
  return value;
};

// The range of each value is a rule of the model package and of the chunks. Here the check of its
// owner runs at the start, and the sentence names the variables.
const checked = <T>(name: string, check: () => T): T => {
  try {
    return check();
  } catch (fault) {
    throw new Error(`${name}: ${fault instanceof Error ? fault.message : String(fault)}`, {
      cause: fault,
    });
  }
};

/** Reads one model from the variables that start with `prefix`. */
const readModelConfig = (prefix: string, env: Env): ModelConfig => {
  const name = (part: string): string => `${prefix}_${part}`;
  const model = textOf(env, name('MODEL'));
  const line = {
    firstWaitMs: numberOf(env, name('FIRST_WAIT_MS')),
    waitGrowth: numberOf(env, name('WAIT_GROWTH')),
    maxWaitMs: numberOf(env, name('MAX_WAIT_MS')),
    timeoutMs: numberOf(env, name('TIMEOUT_MS')),
    maxAnswerTokens: numberOf(env, name('MAX_ANSWER_TOKENS')),
  };
  return {
    model: checked(name('MODEL'), () => pinnedName(model)),
    family: textOf(env, name('FAMILY')),
    line: checked(`${prefix}_* (the line)`, () => checkLine(line)),
  };
};

const turnCapOf = (env: Env): number => {
  const cap = numberOf(env, 'EXTRACTOR_TURN_CAP');
  if (!Number.isInteger(cap) || cap <= 0)
    throw new Error(`EXTRACTOR_TURN_CAP is "${cap}", and it must be a whole number above zero.`);
  return cap;
};

/** Reads the configuration of the extractor and of its checker. It throws a sentence that names
 * the variable when a value is absent, blank or wrong. */
export const readExtractorConfig = (env: Env): ReaderConfig => {
  const reader = readModelConfig('EXTRACTOR', env);
  const checker = readModelConfig('CHECKER', env);
  const tokenCap = numberOf(env, 'EXTRACTOR_TOKEN_CAP');
  const turnCap = turnCapOf(env);
  const chunkCap = numberOf(env, 'EXTRACTOR_CHUNK_CAP');
  const config = {
    reader,
    checker,
    tokenCap: checked('EXTRACTOR_TOKEN_CAP', () => checkTokenCap(tokenCap)),
    turnCap,
    chunkCap: checked('EXTRACTOR_CHUNK_CAP', () => checkChunkCap(chunkCap)),
  };
  if (config.checker.family.toLowerCase() === reader.family.toLowerCase())
    throw new Error(
      `CHECKER_FAMILY is "${config.checker.family}", and the checker must be of another family ` +
        'than the extractor.',
    );
  return config;
};

/** Reads the configuration of the lead agent. It asks the model of the extractor, which is
 * pinned and calls tools, and it has a token budget of its own. A lead with no search engine
 * finds no page, so a search setting is required too. */
export const readLeadConfig = (env: Env): LeadConfig => {
  const cap = numberOf(env, 'LEAD_TOKEN_CAP');
  const tokenCap = checked('LEAD_TOKEN_CAP', () => checkTokenCap(cap));
  const searches = ['SEARXNG_URL', 'BRAVE_SEARCH_API_KEY'].some(
    (name) => (env[name]?.trim() ?? '') !== '',
  );
  if (!searches)
    throw new Error(
      'SEARXNG_URL is empty or absent, and no BRAVE_SEARCH_API_KEY is set. A lead needs a ' +
        'search engine.',
    );
  return { model: readModelConfig('EXTRACTOR', env), tokenCap };
};

/** Reads the configuration of the mapper. It throws a sentence that names the variable when a
 * value is absent, blank or wrong. */
export const readMapperConfig = (env: Env): MapperConfig => ({
  model: readModelConfig('MAPPER', env),
  tokenCap: checked('MAPPER_TOKEN_CAP', () => checkTokenCap(numberOf(env, 'MAPPER_TOKEN_CAP'))),
});
