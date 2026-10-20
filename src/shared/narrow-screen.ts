import { useSyncExternalStore } from 'react';

// External constraint: the user agent tells the width of the screen, and a media query is the one
// way to read it. 768px is the `md` break of the stylesheet, so a class and this value agree.
const QUERY = '(max-width: 767.98px)';

const subscribe = (listener: () => void): (() => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
};

const read = (): boolean => window.matchMedia(QUERY).matches;

// The render at the release has no screen, so it draws the wide shape.
const release = (): boolean => false;

/** True under 768px, the width where a side column becomes a drawer or a sheet. */
export const useNarrowScreen = (): boolean => useSyncExternalStore(subscribe, read, release);
