// Departure: a panel opens in a commit after the keyboard act that asked for it, and an effect is
// not allowed here. So the act leaves a note, and a marker element that mounts with the new panel
// reads the note in its ref callback. The note holds one panel at a time, because a page shows
// one card, and it expires, so a selection that changes no panel leaves no note for a later click.

const NOTE_LIFE_MS = 500;

interface Note {
  readonly opener: HTMLElement;
  readonly at: number;
}

let note: Note | null = null;
let opener: HTMLElement | null = null;

// External constraint: `:focus-visible` is true for a control that the keyboard reached, and false
// for one that a pointer clicked. An old engine throws on the selector, and then we say "no".
const reachedByKeyboard = (element: HTMLElement): boolean => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};

/** Call it in the handler of an act that opens or changes a panel. Only a control that the
 * keyboard reached asks for the focus. `from` is the control that gets the focus back. */
export function askPanelFocus(from: Element | null = document.activeElement): void {
  if (from instanceof HTMLElement && reachedByKeyboard(from)) {
    note = { opener: from, at: Date.now() };
    return;
  }
  // A panel that a pointer opens ends the claim of the old one.
  note = null;
  opener = null;
}

/** The ref callback of the marker, the last child of the panel. It moves the focus to the
 * heading of the panel, or to the panel itself when it has no heading. */
export function landOnPanel(marker: HTMLElement | null): void {
  const region = marker?.parentElement;
  if (region === null || region === undefined) return;
  const asked = note;
  note = null;
  if (asked === null || Date.now() - asked.at > NOTE_LIFE_MS) return;
  opener = asked.opener;
  const target = region.querySelector<HTMLElement>('h1, h2, h3') ?? region;
  // A heading is not in the order of the Tab key, and a script may still focus it.
  target.tabIndex = -1;
  target.focus();
}

/** Call it when the panel closes. It gives the focus back to the control that opened the panel.
 * It does nothing where a pointer opened the panel. Where the control has left the page or is
 * hidden, the focus goes to `fallback`. */
export function returnPanelFocus(fallback: HTMLElement | null = null): void {
  const back = opener;
  opener = null;
  if (back === null) return;
  const usable = back.isConnected && back.getClientRects().length > 0;
  (usable ? back : fallback)?.focus();
}
