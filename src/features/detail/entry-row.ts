import { CAPTION } from './style';

/** The four class lists of a row that takes an entry: the box, the chooser, the caption over
 * them, and the sentence under the row. Every control of this surface draws the same row. */
export const ENTRY_ROW = {
  // The edge of a control comes from `input` (3:1), and the focus ring is 2px with an offset.
  box: 'h-8 rounded-sm border-input bg-transparent px-2 py-0 text-body-sm md:text-body-sm dark:bg-transparent focus-visible:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  chooser:
    'h-8 w-full min-w-0 rounded-sm border border-input bg-transparent px-2 text-body-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:text-muted-foreground',
  caption: `block ${CAPTION}`,
  sentence: 'block text-body-sm text-muted-foreground',
} as const;
