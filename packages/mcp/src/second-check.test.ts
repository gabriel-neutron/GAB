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
  GABRIEL_CHECKER_PASSWORD: 'a-checker-secret',
};

const RESEARCH = 'postgresql://gabriel_research:a-research-secret@127.0.0.1:5432/gabriel';

// The pool of the checker opens nothing here: the test reads only its address.
const opened: string[] = [];
const poolOf = (address: string) => {
  opened.push(address);
  return { connect: () => Promise.reject(new Error('a unit test opens no session')) };
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

  it('reads a file that Notepad saved with a byte order mark', () => {
    expect(checkEnvOf('\uFEFFCHECKER_MODEL=a/b\n', {})).toStrictEqual({ CHECKER_MODEL: 'a/b' });
  });

  it('keeps the password of the checker role', () => {
    expect(
      checkEnvOf('GABRIEL_CHECKER_PASSWORD=x\nGABRIEL_RESEARCH_PASSWORD=y\n', {}),
    ).toStrictEqual({ GABRIEL_CHECKER_PASSWORD: 'x' });
  });

  it('reads the process alone when the stack has no file', () => {
    expect(checkEnvOf(null, { RESEARCH_CHECK_TOKEN_CAP: '10' })).toStrictEqual({
      RESEARCH_CHECK_TOKEN_CAP: '10',
    });
  });
});

describe('the checker of the research proposals', () => {
  it('is ready when each value is set', () => {
    opened.length = 0;
    const check = readSecondCheck(CHECKER, RESEARCH, poolOf);
    expect(check.ready && check.setup.checker.model).toBe('other-family/check-model');
    expect(check.ready && check.setup.tokenCap).toBe(40000);
    expect(opened).toStrictEqual([
      'postgresql://gabriel_checker:a-checker-secret@127.0.0.1:5432/gabriel',
    ]);
  });

  for (const name of [
    'OPENROUTER_API_KEY',
    'CHECKER_MODEL',
    'RESEARCH_CHECK_TOKEN_CAP',
    'GABRIEL_CHECKER_PASSWORD',
  ])
    it(`is not ready, with a sentence that names ${name}, when it is absent`, () => {
      const env = Object.fromEntries(Object.entries(CHECKER).filter(([held]) => held !== name));
      const check = readSecondCheck(env, RESEARCH, poolOf);
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
