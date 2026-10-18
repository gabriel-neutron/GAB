import type { GlobeStore } from './globe-store';
import { useGlobeState } from './use-globe-state';

/** The sentence that stands in place of the globe when the browser cannot draw it. */
export function UnavailableNotice({ store }: { readonly store: GlobeStore }) {
  const { available } = useGlobeState(store);
  if (available) return null;
  return (
    <p role="status" className="absolute inset-0 flex items-center justify-center p-4 text-center">
      This browser cannot draw the map, because it has no WebGL 2. The list of the entities is below
      the map.
    </p>
  );
}
