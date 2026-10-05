import { describe, expect, it } from 'vitest';

import { chunkAnswer, claimEntry, readerTwoEntry } from './reading.ts';

const ACT = { op: 'create_entity', type: 'vessel', label: 'Nayara' };

const ENTRY = { act: ACT, page: 1, start: 4, end: 10, modality: 'asserts' };

describe('the entry of the first reader', () => {
  it('takes an entry with no adverse key', () => {
    expect(claimEntry.parse(ENTRY)).toStrictEqual(ENTRY);
  });

  it('takes adverse true', () => {
    expect(claimEntry.parse({ ...ENTRY, adverse: true }).adverse).toBe(true);
  });

  it('refuses adverse false, because a reader never clears the flag', () => {
    expect(claimEntry.safeParse({ ...ENTRY, adverse: false }).success).toBe(false);
  });

  for (const key of [
    'confidence',
    'evidence_note',
    'quote',
    'excerpt',
    'reader_no',
    'access',
    'origin',
    'originator',
    'same_family',
  ])
    it(`refuses the key ${key}`, () => {
      expect(
        claimEntry.safeParse({ ...ENTRY, [key]: key === 'confidence' ? 0.9 : 'x' }).success,
      ).toBe(false);
    });

  it('refuses a span that does not start before it ends', () => {
    expect(claimEntry.safeParse({ ...ENTRY, start: 10, end: 10 }).success).toBe(false);
  });

  it('refuses a modality outside the five words', () => {
    expect(claimEntry.safeParse({ ...ENTRY, modality: 'suggests' }).success).toBe(false);
  });

  it('refuses an entry with no act', () => {
    const { act, ...bare } = ENTRY;
    void act;
    expect(claimEntry.safeParse(bare).success).toBe(false);
  });
});

describe('the entry of the second reader', () => {
  it('takes a span and the enums', () => {
    const { act, ...bare } = ENTRY;
    void act;
    expect(readerTwoEntry.parse(bare)).toStrictEqual(bare);
  });

  it('refuses an act', () => {
    expect(readerTwoEntry.safeParse(ENTRY).success).toBe(false);
  });
});

describe('the answer for one chunk', () => {
  it('refuses a key beside the claims', () => {
    expect(chunkAnswer.safeParse({ claims: [ENTRY], confidence: 1 }).success).toBe(false);
  });

  it('takes an empty list', () => {
    expect(chunkAnswer.parse({ claims: [] })).toStrictEqual({ claims: [] });
  });
});
