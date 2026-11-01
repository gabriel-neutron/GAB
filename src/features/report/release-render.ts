import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/** True in the render at the release and in the hydration of its HTML, false in any other render.
 * External constraint: React has no flag for a hydration. The server value of a store is used only
 * in these two renders. */
export const useReleaseRender = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
