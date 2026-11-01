import { useSyncExternalStore } from 'react';

// External constraint: a media query is the one way to read the width of the screen. 1280px is
// the `xl` break of the stylesheet, so a class and this value agree.
const QUERY = '(min-width: 1280px)';

const subscribe = (listener: () => void): (() => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
};

const read = (): boolean => window.matchMedia(QUERY).matches;

// The render at the release has no screen. A closed note draws the same marker at each width.
const release = (): boolean => false;

/** True from 1280px, the width where a note opens in the margin and not in a sheet. */
export const useMarginScreen = (): boolean => useSyncExternalStore(subscribe, read, release);
