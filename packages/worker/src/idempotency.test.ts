import { describe, expect, it } from 'vitest';

import { idempotencyKey, promptDigest, type KeyParts } from './idempotency.ts';

const PARTS: KeyParts = {
  documentId: 'doc_8f2a41',
  chunkHash: 'a'.repeat(64),
  readerId: 'extractor@v1',
  servedModel: 'a-family/a-model',
  inputForm: 'page-text',
  promptHash: 'b'.repeat(64),
};

describe('the idempotency key', () => {
  it('is a digest of 64 hexadecimal characters', () => {
    expect(idempotencyKey(PARTS)).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('is the same for one reader that repeats one chunk', () => {
    expect(idempotencyKey({ ...PARTS })).toBe(idempotencyKey(PARTS));
  });

  it.each([
    ['document', { documentId: 'doc_000000' }],
    ['chunk hash', { chunkHash: 'c'.repeat(64) }],
    ['reader', { readerId: 'verifier@v1' }],
    ['served model', { servedModel: 'another-family/a-model' }],
    ['input form', { inputForm: 'table-text' }],
    ['prompt hash', { promptHash: 'd'.repeat(64) }],
  ] as const)('differs when only the %s differs', (_name, change) => {
    expect(idempotencyKey({ ...PARTS, ...change })).not.toBe(idempotencyKey(PARTS));
  });

  it('keeps two parts apart when their characters would run together', () => {
    const joined = idempotencyKey({ ...PARTS, readerId: 'a', inputForm: 'bc' });
    const moved = idempotencyKey({ ...PARTS, readerId: 'ab', inputForm: 'c' });
    expect(joined).not.toBe(moved);
  });

  it.each(Object.keys(PARTS))('refuses an empty %s', (name) => {
    expect(() => idempotencyKey({ ...PARTS, [name]: '  ' })).toThrow(name);
  });
});

describe('the digest of a prompt', () => {
  const MESSAGES = [
    { role: 'system', content: 'read' },
    { role: 'user', content: 'a chunk' },
  ] as const;

  it('is stable for one prompt and changes with one word of it', () => {
    expect(promptDigest(MESSAGES)).toMatch(/^[0-9a-f]{64}$/u);
    expect(promptDigest(MESSAGES)).toBe(promptDigest([...MESSAGES]));
    expect(promptDigest([MESSAGES[0], { role: 'user', content: 'a chunk.' }])).not.toBe(
      promptDigest(MESSAGES),
    );
  });
});
