/** The class lists of the design system that every panel of the detail page shares. The chrome
 * session should move them to `src/shared` with the glyph. */

/** `caption`: 12px mono, uppercase, the instrument voice. */
export const CAPTION = 'font-mono text-caption uppercase text-label';

/** `data`: 12px mono for identifiers, dates and counts. */
export const DATA = 'font-mono text-data tabular-nums';

/** GhostLink: text on a 1px `border` underline that turns `foreground` on hover. */
export const GHOST_LINK =
  'rounded-none border-b border-border pb-px text-foreground transition-colors duration-150 hover:border-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const TAG =
  'inline-flex h-5 items-center gap-1.5 rounded-sm border px-1.5 font-mono text-caption uppercase whitespace-nowrap';

/** StatusTag variants. A hue is never the only mark: each carries a word. */
export const TAG_CLASS = {
  default: `${TAG} border-border text-label`,
  candidate: `${TAG} border-dashed border-candidate text-candidate`,
  dissent: `${TAG} border-dissent text-dissent`,
  figure: `${TAG} border-figure bg-figure text-on-figure`,
} as const;
