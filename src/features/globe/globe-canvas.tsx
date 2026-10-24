// The element that carries the canvas holds no React state. Its parents render it with the same
// two values at each render, and the memo below stops a render that comes from the chrome beside
// it. The chrome reads the store and never the instance.

import { memo, useEffect, useRef } from 'react';

import type { GlobeData } from './globe-data';
import { mountGlobe } from './globe-adapter';
import type { GlobeStore } from './globe-store';
import { selectedEntity } from './selected-entity';

export interface GlobeCanvasProps {
  readonly data: GlobeData;
  readonly store: GlobeStore;
  readonly flat: boolean;
  /** The entity that the reader selected, or null. This function must be the same function at each
   * render of the caller, or the canvas mounts again. */
  readonly onSelect: (id: string | null) => void;
}

export const GlobeCanvas = memo(function GlobeCanvas({
  data,
  store,
  flat,
  onSelect,
}: GlobeCanvasProps) {
  const host = useRef<HTMLDivElement | null>(null);

  // React runs setup, cleanup, setup in development: `mountGlobe` ends an instance that it finds on
  // the element, and this cleanup ends the subscription, so two runs leave one globe.
  useEffect(() => {
    const container = host.current;
    if (container === null) return;
    const handle = mountGlobe({ container, data, store, flat });
    let last = selectedEntity(store.get());
    const stop = store.subscribe(() => {
      const next = selectedEntity(store.get());
      if (next === last) return;
      last = next;
      onSelect(next);
    });
    return () => {
      stop();
      handle?.destroy();
      store.dispose();
    };
  }, [data, store, flat, onSelect]);

  return (
    <div
      ref={host}
      role="region"
      aria-label="Map of the entities with a position"
      className="size-full"
    />
  );
});
