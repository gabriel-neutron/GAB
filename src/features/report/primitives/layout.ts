/** The page measures: `bleed` puts a block across the full width of the page, `view` is the
 * height of the visible report under the site header and the part bar, `top` is the sticky top. */
export const layout = {
  // The report page sets the container and the two variables; the fallbacks keep a story usable.
  bleed: 'relative w-[100cqw] ml-[calc(50%-50cqw)]',
  view: 'h-[var(--report-view,100svh)]',
  minView: 'min-h-[var(--report-view,100svh)]',
  top: 'top-[var(--report-bar,0px)]',
} as const;
