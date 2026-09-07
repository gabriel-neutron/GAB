// The one reading of an ADMIRALTY rating. Two surfaces draw a cited document, and each word a
// reader sees for a rating is decided here, so the two surfaces cannot say different things.

import type { DocumentRow } from './model';

/** What one document says about itself, in the words a surface draws. */
export interface Rating {
  readonly rated: boolean;
  /** `not rated` where it is not rated. Never a dash, and never a zero. */
  readonly score: string;
  readonly scoreOrigin: string;
  /** A low letter or a high figure. The hue marks this, and never the absence of a rating. */
  readonly poor: boolean;
}

const ABSENT: Rating = { rated: false, score: 'not rated', scoreOrigin: '', poor: false };

/** The letter is the reliability of the source and the figure the credibility of the report.
 * The last two bands of each are the poor ones, and they carry the hue. */
const poorBand = (admiralty: string): boolean => {
  const [letter, digit] = [admiralty.slice(0, 1).toUpperCase(), Number(admiralty.slice(1, 2))];
  return ['D', 'E', 'F'].includes(letter) || (Number.isFinite(digit) && digit >= 4);
};

/** The rating and its origin are absent together. An unrated document says so in words, because
 * an absence that reads as a low score turns a hole into a judgement. */
export function readRating(row: DocumentRow | undefined): Rating {
  if (row === undefined) return ABSENT;
  const { admiralty, admiraltyOrigin } = row;
  if (admiralty !== null && admiraltyOrigin !== null) {
    return {
      rated: true,
      score: admiralty,
      scoreOrigin: admiraltyOrigin,
      poor: poorBand(admiralty),
    };
  }
  if (admiralty === null && admiraltyOrigin === null) return ABSENT;
  // A CHECK pairs the two columns and a second one holds the rating to a letter and a figure, so
  // no live row and no blank reaches this line. A hand-built row does, and it must read as
  // neither a rating of the record nor an absence the analyst may trust.
  return {
    rated: false,
    score: 'rating incomplete',
    scoreOrigin: 'a rating and its origin are absent together',
    poor: false,
  };
}
