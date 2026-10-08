import { numberOf, readModelConfig, readTokenCap, type ModelConfig } from '@gab/model';

import { checkChunkCap } from './chunk.ts';

export type { ModelConfig };

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

/** What the operator sets for the rating of authors, and for the build of the reference set. */
export interface RaterConfig {
  /** The strongest pinned model that OpenRouter gives. It builds the reference set once, and it
   * rates each new author name. */
  readonly model: ModelConfig;
  /** The tokens that one rating, or one build of the set, may spend. */
  readonly tokenCap: number;
}

type Env = Readonly<Record<string, string | undefined>>;

// The range of the chunk cap is a rule of the chunks. The sentence names the variable.
const chunkCapOf = (cap: number): number => {
  try {
    return checkChunkCap(cap);
  } catch (fault) {
    throw new Error(
      `EXTRACTOR_CHUNK_CAP: ${fault instanceof Error ? fault.message : String(fault)}`,
      { cause: fault },
    );
  }
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
  const tokenCap = readTokenCap(env, 'EXTRACTOR_TOKEN_CAP');
  const turnCap = turnCapOf(env);
  const chunkCap = numberOf(env, 'EXTRACTOR_CHUNK_CAP');
  const config = {
    reader,
    checker,
    tokenCap,
    turnCap,
    chunkCap: chunkCapOf(chunkCap),
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
  const tokenCap = readTokenCap(env, 'LEAD_TOKEN_CAP');
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
  tokenCap: readTokenCap(env, 'MAPPER_TOKEN_CAP'),
});

/** Reads the configuration of the rater. It throws a sentence that names the variable when a
 * value is absent, blank or wrong. */
export const readRaterConfig = (env: Env): RaterConfig => ({
  model: readModelConfig('RATER', env),
  tokenCap: readTokenCap(env, 'RATER_TOKEN_CAP'),
});
