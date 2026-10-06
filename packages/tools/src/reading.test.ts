import { describe, expect, it } from 'vitest';

import { putClaimReading } from './put-claim-reading.ts';
import {
  chunkAnswer,
  claimEntry,
  MAX_CLAIMS_PER_CHUNK,
  readerTwoAnswer,
  readerTwoEntry,
} from './reading.ts';

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

  // A notice of suspicion names a person with a date of birth and an address. The claim keeps the
  // name, and the schema refuses each personal field.
  for (const key of [
    'date_of_birth',
    'address',
    'home_address',
    'passport_number',
    'phone',
    'email',
  ])
    it(`refuses a claim that holds the personal field ${key}`, () => {
      const act = {
        op: 'create_entity',
        type: 'person',
        label: 'Ivan Petrov',
        attrs: { [key]: { v: 'x' } },
      };
      expect(claimEntry.safeParse({ ...ENTRY, act }).success).toBe(false);
    });

  it('takes a claim about a person with no personal field', () => {
    const act = {
      op: 'create_entity',
      type: 'person',
      label: 'Ivan Petrov',
      attrs: { role: { v: 'master' } },
    };
    expect(claimEntry.safeParse({ ...ENTRY, act }).success).toBe(true);
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

  const { act: _act, ...BARE } = ENTRY;
  void _act;

  for (const key of ['confidence', 'evidence_note', 'epistemic', 'reader_no', 'act'])
    it(`refuses the key ${key}`, () => {
      expect(readerTwoEntry.safeParse({ ...BARE, [key]: 1 }).success).toBe(false);
    });

  it('refuses an offset that is not a whole number', () => {
    expect(readerTwoEntry.safeParse({ ...BARE, start: 4.5 }).success).toBe(false);
  });

  it('refuses a span that does not start before it ends', () => {
    expect(readerTwoEntry.safeParse({ ...BARE, start: 10, end: 4 }).success).toBe(false);
  });

  it('refuses a modality outside the five words', () => {
    expect(readerTwoEntry.safeParse({ ...BARE, modality: 'suggests' }).success).toBe(false);
  });

  it('refuses more readings than the cap of one chunk', () => {
    const many = Array.from({ length: MAX_CLAIMS_PER_CHUNK + 1 }, () => BARE);
    expect(readerTwoAnswer.safeParse({ claims: many }).success).toBe(false);
    expect(readerTwoAnswer.safeParse({ claims: many.slice(1) }).success).toBe(true);
  });
});

describe('the input of the door put_claim_reading', () => {
  const SHA = 'a'.repeat(64);
  const ID = '4a3b2c1d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const INPUT = {
    job: ID,
    textExtractor: 'pdf@1',
    page: 1,
    start: 0,
    end: 6,
    modality: 'asserts',
    modelCallId: ID,
    inputForm: 'text',
    readerFingerprint: 'b-model abc',
    chunkHash: SHA,
    idempotencyKey: SHA,
  };

  it('takes a second reading with no claim', () => {
    expect(putClaimReading.input.safeParse(INPUT).success).toBe(true);
  });

  for (const key of ['confidence', 'evidence_note', 'epistemic', 'reader_no', 'readerNo'])
    it(`refuses the key ${key}`, () => {
      expect(putClaimReading.input.safeParse({ ...INPUT, [key]: 1 }).success).toBe(false);
    });

  it('refuses an offset that is not a whole number', () => {
    expect(putClaimReading.input.safeParse({ ...INPUT, end: 6.5 }).success).toBe(false);
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
