import type { AlignmentListing, AlignmentRow } from '@gab/release/alignment-rows';

/** What a cell of the matrix says: a mark and words, so a fill is never the only sign. */
export interface ListingWords {
  readonly mark: '●' | '○';
  readonly words: string;
  /** The day when the listing ended, or null. */
  readonly endedOn: string | null;
}

export const listingWords = (listing: AlignmentListing | null): ListingWords =>
  listing === null
    ? { mark: '○', words: 'not listed', endedOn: null }
    : { mark: '●', words: listing.listedOn ?? 'date not in release', endedOn: listing.endedOn };

export interface MatrixCounts {
  readonly rows: number;
  readonly euNotOfac: number;
  readonly ofacOrUkNotEu: number;
  /** Rows with at least one listing that has an end date. */
  readonly ended: number;
}

/** The counts that the legend gives. When no row has an end date, the release tracks no removal. */
export const matrixCounts = (rows: readonly AlignmentRow[]): MatrixCounts => ({
  rows: rows.length,
  euNotOfac: rows.filter((one) => one.euNotOfac).length,
  ofacOrUkNotEu: rows.filter((one) => one.ofacOrUkNotEu).length,
  ended: rows.filter((one) =>
    Object.values(one.listings).some((one) => (one?.endedOn ?? null) !== null),
  ).length,
});
