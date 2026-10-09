/** The stored text of one page. */
export interface PageText {
  readonly page: number;
  readonly text: string;
}

/** A part of one page that one conversation with the model reads. */
export interface Chunk {
  readonly page: number;
  readonly text: string;
}

/** Checks a chunk cap and gives it back. The configuration calls this at the start of the worker,
 * so a cap out of range fails each extraction job before it reads a chunk. */
export const checkChunkCap = (cap: number): number => {
  if (!Number.isInteger(cap) || cap <= 0)
    throw new Error('the chunk cap is a whole number of code points above zero');
  return cap;
};

/** Cuts each page into parts of at most `cap` code points. A part never crosses a page, so the
 * model cites one page for each claim of a part. */
export const chunkPages = (pages: readonly PageText[], cap: number): Chunk[] => {
  checkChunkCap(cap);

  const chunks: Chunk[] = [];
  for (const { page, text } of pages) {
    // A string index counts UTF-16 units, and the cap counts code points.
    const points = Array.from(text);
    for (let start = 0; start < points.length; start += cap)
      chunks.push({ page, text: points.slice(start, start + cap).join('') });
  }
  return chunks;
};
