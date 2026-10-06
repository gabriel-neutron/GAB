import { createHash } from 'node:crypto';

/** The stored text of one page. */
export interface PageText {
  readonly page: number;
  readonly text: string;
}

/** A part of one page that one conversation with the model reads. */
export interface Chunk {
  readonly page: number;
  /** The first code point of the chunk, counted from the start of its page. */
  readonly start: number;
  readonly text: string;
  /** The digest of the page, the start and the text. A key of a reading holds it. */
  readonly hash: string;
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Cuts each page into parts of at most `cap` code points. A part never crosses a page, so a claim
 * that crosses a border is read by no reader, and every reader of one page misses it alike. The
 * cut falls at fixed boundaries, so a second reader gets the same parts. */
export const chunkPages = (pages: readonly PageText[], cap: number): Chunk[] => {
  if (!Number.isInteger(cap) || cap <= 0)
    throw new Error('the chunk cap is a whole number of code points above zero');

  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    // A string index counts UTF-16 units, and the stored offsets count code points.
    const points = Array.from(text);
    for (let start = 0; start < points.length; start += cap) {
      const part = points.slice(start, start + cap).join('');
      chunks.push({ page, start, text: part, hash: sha256(JSON.stringify([page, start, part])) });
    }
  }
  return chunks;
};

/** The length of a text in code points. */
export const codePoints = (text: string): number => Array.from(text).length;
