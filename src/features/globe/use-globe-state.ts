import { useSyncExternalStore } from 'react';

import type { GlobeState, GlobeStore } from './globe-store';

/** The state of the store of the globe, for a panel beside the canvas. */
export const useGlobeState = (store: GlobeStore): GlobeState =>
  useSyncExternalStore(store.subscribe, store.get);
