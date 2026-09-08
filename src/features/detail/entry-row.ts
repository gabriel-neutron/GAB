/** The three class lists of a row that takes an entry: the box, the caption over it, and the
 * sentence under the row. Two controls of this surface draw the same row, so they read one. */
export const ENTRY_ROW = {
  box: 'h-6 rounded-none px-1.5 py-0 text-xs md:text-xs',
  caption: 'block text-small/4 tracking-caps text-label uppercase',
  sentence: 'block text-small/4 text-label',
} as const;
