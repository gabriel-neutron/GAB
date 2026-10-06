import { describe, expect, it } from 'vitest';

import { readReaderConfig } from './reader-config.ts';

const FULL = {
  EXTRACTOR_ENDPOINT: 'freellmapi',
  EXTRACTOR_MODEL: 'a-family/a-model',
  EXTRACTOR_FAMILY: 'a-family',
  EXTRACTOR_FIRST_WAIT_MS: '1000',
  EXTRACTOR_WAIT_GROWTH: '2',
  EXTRACTOR_MAX_WAIT_MS: '60000',
  EXTRACTOR_TIMEOUT_MS: '30000',
  EXTRACTOR_MAX_ANSWER_TOKENS: '2000',
  EXTRACTOR_TOKEN_CAP: '50000',
  EXTRACTOR_TURN_CAP: '40',
  EXTRACTOR_CHUNK_CAP: '6000',
};

describe('the configuration of a reader', () => {
  it('reads every value from the environment', () => {
    expect(readReaderConfig('EXTRACTOR', FULL)).toStrictEqual({
      model: {
        endpoint: 'freellmapi',
        model: 'a-family/a-model',
        firstWaitMs: 1000,
        waitGrowth: 2,
        maxWaitMs: 60000,
        timeoutMs: 30000,
        maxAnswerTokens: 2000,
      },
      family: 'a-family',
      tokenCap: 50000,
      turnCap: 40,
      chunkCap: 6000,
    });
  });

  for (const name of Object.keys(FULL))
    it(`stops with a sentence that names ${name} when it is absent`, () => {
      const env = Object.fromEntries(Object.entries(FULL).filter(([held]) => held !== name));
      expect(() => readReaderConfig('EXTRACTOR', env)).toThrow(new RegExp(name, 'u'));
    });

  it('stops on a blank value', () => {
    expect(() => readReaderConfig('EXTRACTOR', { ...FULL, EXTRACTOR_FAMILY: '  ' })).toThrow(
      /EXTRACTOR_FAMILY/u,
    );
  });

  it('stops on the model auto', () => {
    expect(() => readReaderConfig('EXTRACTOR', { ...FULL, EXTRACTOR_MODEL: 'auto' })).toThrow(
      /EXTRACTOR_MODEL.*auto/u,
    );
  });

  it('stops on a number that is not a whole number above zero', () => {
    expect(() => readReaderConfig('EXTRACTOR', { ...FULL, EXTRACTOR_TURN_CAP: '0' })).toThrow(
      /EXTRACTOR_TURN_CAP/u,
    );
  });

  it('holds no default: an empty environment names the first value it needs', () => {
    expect(() => readReaderConfig('EXTRACTOR', {})).toThrow(/EXTRACTOR_/u);
  });
});
