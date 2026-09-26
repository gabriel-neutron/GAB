/** The four class lists of a row that takes an entry: the box, the chooser, the caption over
 * them, and the sentence under the row. Three controls of this surface draw the same row. */
export const ENTRY_ROW = {
  box: 'h-6 rounded-none px-1.5 py-0 text-xs md:text-xs',
  // The kit has no native select, and the edge of a control comes from `input` and never
  // `border`. The `focus-visible` recipe is the kit's own, copied whole: `ring` alone paints
  // `currentcolor`.
  chooser:
    'h-6 w-full min-w-0 rounded-none border border-input bg-transparent px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
  caption: 'block text-small/4 tracking-caps text-label uppercase',
  sentence: 'block text-small/4 text-label',
} as const;
