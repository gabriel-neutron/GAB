import { memo, useEffect, useRef } from 'react';
import { mountSurface, type BarKey } from './prototype-shell';

export { BAR_KEYS, BAR_NAMES, nextBar, parseBar, type BarKey } from './prototype-shell';

/**
 * The whole React surface of the map feature, and it is deliberately this small.
 *
 * ADR 0004 §3: one `ref`, one imperative adapter, and every other value outside React. There is
 * no state here, and one prop that changes only when the operator flips the prototype switch.
 *
 * **`memo` is load-bearing, not an optimisation.** The route re-renders on every selection,
 * because the selected identifier is in the address and the detail sidebar reads it. Without
 * `memo`, each of those re-renders would reach the component that holds the live canvas. With
 * it, this component re-renders only when `bar` changes, which is exactly when the map is
 * supposed to be torn down and rebuilt.
 *
 * The route owns the size: this returns a flex child, not a fixed layer, because the sidebar
 * stands beside it.
 */
export const MapPage = memo(function MapPage({ bar }: { readonly bar: BarKey }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    return mountSurface(node, bar);
  }, [bar]);

  return <div ref={ref} className="min-w-0 flex-1" />;
});
