// External constraint: a browser moves the focus to the page body when the focused button becomes
// `disabled`. A button that waits for an answer is `aria-disabled` and keeps the focus, so it
// paints as the kit paints a disabled button. The handler refuses the click.
export const BUSY_BUTTON =
  'aria-disabled:pointer-events-none aria-disabled:bg-surface-secondary aria-disabled:text-muted-foreground';
