import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (listener: () => void): (() => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
};

const read = (): boolean => window.matchMedia(QUERY).matches;

// The render at the release has no screen, so it draws the page with motion. The hydration uses
// the same value first and then the value of the screen, so the two renders agree.
const release = (): boolean => false;

/** True when the reader asks for reduced motion. Use it in place of `useReducedMotion` of Motion,
 * which reads the screen in the first render and so breaks the hydration of the release page. */
export const useReduceMotion = (): boolean => useSyncExternalStore(subscribe, read, release);
