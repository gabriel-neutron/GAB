import { describe, expect, it } from 'vitest';

import { readExtractorConfig, readLeadConfig } from './reader-config.ts';

const FULL = {
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
  CHECKER_MODEL: 'b-family/b-model',
  CHECKER_FAMILY: 'b-family',
  CHECKER_FIRST_WAIT_MS: '500',
  CHECKER_WAIT_GROWTH: '3',
  CHECKER_MAX_WAIT_MS: '30000',
  CHECKER_TIMEOUT_MS: '20000',
  CHECKER_MAX_ANSWER_TOKENS: '800',
};

describe('the configuration of the extractor', () => {
  it('reads every value from the environment', () => {
    expect(readExtractorConfig(FULL)).toStrictEqual({
      reader: {
        model: 'a-family/a-model',
        family: 'a-family',
        line: {
          firstWaitMs: 1000,
          waitGrowth: 2,
          maxWaitMs: 60000,
          timeoutMs: 30000,
          maxAnswerTokens: 2000,
        },
      },
      checker: {
        model: 'b-family/b-model',
        family: 'b-family',
        line: {
          firstWaitMs: 500,
          waitGrowth: 3,
          maxWaitMs: 30000,
          timeoutMs: 20000,
          maxAnswerTokens: 800,
        },
      },
      tokenCap: 50000,
      turnCap: 40,
      chunkCap: 6000,
    });
  });

  for (const name of Object.keys(FULL))
    it(`stops with a sentence that names ${name} when it is absent`, () => {
      const env = Object.fromEntries(Object.entries(FULL).filter(([held]) => held !== name));
      expect(() => readExtractorConfig(env)).toThrow(new RegExp(name, 'u'));
    });

  it('stops on a blank value', () => {
    expect(() => readExtractorConfig({ ...FULL, EXTRACTOR_FAMILY: '  ' })).toThrow(
      /EXTRACTOR_FAMILY/u,
    );
  });

  it('stops on a value that is not a number', () => {
    expect(() => readExtractorConfig({ ...FULL, EXTRACTOR_TURN_CAP: 'forty' })).toThrow(
      /EXTRACTOR_TURN_CAP/u,
    );
  });

  // The ranges are rules of the model package and of the chunks. The worker calls those checks at
  // its start, so a value out of range stops the start and no job.
  it('stops at the start on the model auto', () => {
    expect(() => readExtractorConfig({ ...FULL, CHECKER_MODEL: 'auto' })).toThrow(
      /CHECKER_MODEL.*auto/u,
    );
  });

  it.each([
    ['EXTRACTOR_TIMEOUT_MS', '0', /EXTRACTOR_.*timeoutMs/su],
    ['CHECKER_WAIT_GROWTH', '0.5', /CHECKER_.*waitGrowth/su],
    ['CHECKER_MAX_ANSWER_TOKENS', '-1', /CHECKER_.*maxAnswerTokens/su],
    ['EXTRACTOR_TOKEN_CAP', '0', /EXTRACTOR_TOKEN_CAP.*token cap/u],
    ['EXTRACTOR_CHUNK_CAP', '1.5', /EXTRACTOR_CHUNK_CAP.*chunk cap/u],
    ['EXTRACTOR_TURN_CAP', '0', /EXTRACTOR_TURN_CAP/u],
  ])('stops at the start when %s is %s', (name, value, said) => {
    expect(() => readExtractorConfig({ ...FULL, [name]: value })).toThrow(said);
  });

  it('stops when the checker is of the family of the reader', () => {
    expect(() => readExtractorConfig({ ...FULL, CHECKER_FAMILY: ' A-Family ' })).toThrow(
      /CHECKER_FAMILY.*another family/u,
    );
  });

  it('holds no default: an empty environment names the first value it needs', () => {
    expect(() => readExtractorConfig({})).toThrow(/EXTRACTOR_/u);
  });
});

describe('the configuration of the lead agent', () => {
  const LEAD = { ...FULL, LEAD_TOKEN_CAP: '200000', SEARXNG_URL: 'http://127.0.0.1:8080' };

  it('asks the model of the extractor with a token budget of its own', () => {
    const read = readLeadConfig(LEAD);
    expect(read.model).toStrictEqual(readExtractorConfig(FULL).reader);
    expect(read.tokenCap).toBe(200000);
  });

  it('stops with a sentence that names LEAD_TOKEN_CAP when it is absent', () => {
    expect(() => readLeadConfig({ ...LEAD, LEAD_TOKEN_CAP: undefined })).toThrow(/LEAD_TOKEN_CAP/u);
  });

  it('stops on a token cap out of range', () => {
    expect(() => readLeadConfig({ ...LEAD, LEAD_TOKEN_CAP: '-5' })).toThrow(
      /LEAD_TOKEN_CAP.*token cap/u,
    );
  });

  it('stops with a sentence that names SEARXNG_URL when no search engine is set', () => {
    expect(() => readLeadConfig({ ...LEAD, SEARXNG_URL: ' ' })).toThrow(/SEARXNG_URL/u);
  });

  it('takes a Brave key alone as the search engine', () => {
    const read = readLeadConfig({ ...LEAD, SEARXNG_URL: undefined, BRAVE_SEARCH_API_KEY: 'k' });
    expect(read.tokenCap).toBe(200000);
  });
});
