import { describe, expect, it } from 'vitest';

import { checkEnvOf, readerFamilyOf, readSecondCheck } from './second-check.ts';

const CHECKER = {
  CHECKER_MODEL: 'other-family/check-model',
  CHECKER_FAMILY: 'other-family',
  CHECKER_FIRST_WAIT_MS: '1000',
  CHECKER_WAIT_GROWTH: '2',
  CHECKER_MAX_WAIT_MS: '30000',
  CHECKER_TIMEOUT_MS: '60000',
  CHECKER_MAX_ANSWER_TOKENS: '2000',
  RESEARCH_CHECK_TOKEN_CAP: '40000',
  OPENROUTER_API_KEY: 'a-stub-key',
};

describe('the values of the check', () => {
  it('keeps only the variables of the check from the file of the stack', () => {
    const file =
      'CHECKER_MODEL=other-family/check-model\nOPENROUTER_API_KEY=a-stub-key\n' +
      'RAW_STORE_SECRET_KEY=a-secret\nGABRIEL_APP_PASSWORD=a-password\n';
    expect(checkEnvOf(file, {})).toStrictEqual({
      CHECKER_MODEL: 'other-family/check-model',
      OPENROUTER_API_KEY: 'a-stub-key',
    });
  });

  it('takes a value that the process sets over the value of the file, and not a blank one', () => {
    const env = checkEnvOf('CHECKER_FAMILY=a\nCHECKER_MODEL=a/b\n', {
      CHECKER_FAMILY: 'b',
      CHECKER_MODEL: ' ',
      GAB_RESEARCH_DATABASE_URL: 'postgresql://x',
    });
    expect(env).toStrictEqual({ CHECKER_FAMILY: 'b', CHECKER_MODEL: 'a/b' });
  });

  it('reads the process alone when the stack has no file', () => {
    expect(checkEnvOf(null, { RESEARCH_CHECK_TOKEN_CAP: '10' })).toStrictEqual({
      RESEARCH_CHECK_TOKEN_CAP: '10',
    });
  });
});

describe('the checker of the research proposals', () => {
  it('is ready when each value is set', () => {
    const check = readSecondCheck(CHECKER);
    expect(check.ready && check.setup.checker.model).toBe('other-family/check-model');
    expect(check.ready && check.setup.tokenCap).toBe(40000);
  });

  for (const name of ['OPENROUTER_API_KEY', 'CHECKER_MODEL', 'RESEARCH_CHECK_TOKEN_CAP'])
    it(`is not ready, with a sentence that names ${name}, when it is absent`, () => {
      const env = Object.fromEntries(Object.entries(CHECKER).filter(([held]) => held !== name));
      const check = readSecondCheck(env);
      expect(check.ready).toBe(false);
      expect(check.ready ? '' : check.reason).toMatch(new RegExp(name, 'u'));
    });
});

describe('the family of the research AI', () => {
  it('reads the family from the name of the client', () => {
    expect(readerFamilyOf('claude-code')).toBe('anthropic');
    expect(readerFamilyOf('codex-mcp-client')).toBe('openai');
    expect(readerFamilyOf('an-editor')).toBeNull();
    expect(readerFamilyOf(undefined)).toBeNull();
  });
});
