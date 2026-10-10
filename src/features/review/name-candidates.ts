import { z } from 'zod';

import { askWriter } from '@/shared/write/door';
import type { WriteResult } from '@/shared/write/write-state';

// Departure: three exports, one job. The operator reads the merge candidates across a Latin and a
// Cyrillic spelling, and confirms or refuses each one. The read is private, so all three go
// through the writer.

/** One entity of a candidate: its identifier, its label, and its name that matched. */
export interface CandidateEntity {
  readonly id: string;
  readonly label: string;
  readonly name: string;
}

/** Two entities of one type whose Latin and Cyrillic names give one transliteration key. */
export interface NameCandidate {
  readonly key: string;
  readonly type: string;
  readonly first: CandidateEntity;
  readonly second: CandidateEntity;
}

/** The candidates, or the sentence that says why the page holds none. */
export type CandidatesRead =
  | { readonly state: 'held'; readonly candidates: readonly NameCandidate[] }
  | { readonly state: 'private'; readonly why: string };

const NO_WRITER =
  'The merge candidates are private, and the write service on this machine did not give them. ' +
  'Start the write service, then open this page again.';

const entity = z.object({ id: z.string(), label: z.string(), name: z.string() });
const held = z.object({
  candidates: z.array(
    z.object({ key: z.string(), type: z.string(), first: entity, second: entity }),
  ),
});

/** Reads the candidates that wait for the operator. It raises nothing. */
export async function readNameCandidates(): Promise<CandidatesRead> {
  const read = await askWriter('/private/name-candidates', {}, held);
  switch (read.step) {
    case 'done':
      return { state: 'held', candidates: read.candidates };
    case 'refused':
      return { state: 'private', why: `The candidates cannot be read: ${read.refusal}` };
    case 'unknown':
      return { state: 'private', why: NO_WRITER };
  }
}

// The writer starts a refusal with the field of the body to correct. The page sends the body
// itself, so the operator has no field to correct and reads the sentence alone.
const withoutField = <Done extends object>(result: WriteResult<Done>): WriteResult<Done> =>
  result.step === 'refused'
    ? { ...result, refusal: result.refusal.replace(/^(?:survivorId|absorbedId): /u, '') }
    : result;

/** Confirm one candidate: the absorbed entity merges into the survivor, and its label becomes a
 * former name of the survivor. A lost answer is a doubt: the merge may stand. */
export async function confirmNameCandidate(
  survivorId: string,
  absorbedId: string,
): Promise<WriteResult> {
  return withoutField(
    await askWriter(
      '/write/confirm-name-candidate',
      { survivorId, absorbedId },
      z.object({ proposalId: z.string() }),
    ),
  );
}

/** Refuse one candidate. The command never proposes the pair again. */
export async function refuseNameCandidate(firstId: string, secondId: string): Promise<WriteResult> {
  return askWriter(
    '/write/refuse-name-candidate',
    { firstId, secondId },
    z.object({ refused: z.number() }),
  );
}
