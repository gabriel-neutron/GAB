import { useEffect, useRef } from 'react';
import { mountPrototype } from './prototype-shell';

/**
 * The whole React surface of the map feature, and it is deliberately this small.
 *
 * ADR 0004 §3: one `ref`, one imperative adapter, and every other value outside React. There is
 * no state here, no dependency that can change, and therefore no re-render — the effect runs
 * once at mount and once more in development, where React double-invokes it. `mountPrototype`
 * clears the node it is given and returns a cleanup that removes the map, so the second
 * invocation replaces the first instead of adding a second map beside it.
 *
 * `fixed inset-0` because the requirement is a full page: one view fills the screen. It leaves
 * the padding of the root layout, and it covers the theme switch that lives there. That is a
 * fact about the layout, which ADR 0004 defers, and not about the map.
 */
export function MapPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return undefined;
    return mountPrototype(node);
  }, []);

  return <div ref={ref} className="fixed inset-0" />;
}
