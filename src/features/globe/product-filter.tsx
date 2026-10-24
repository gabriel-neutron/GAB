import { PRODUCTS } from '@gab/proposal/chain-product';

import { CONTROL } from './control-class';
import type { GlobeStore } from './globe-store';
import { useGlobeState } from './use-globe-state';

export interface ProductFilterProps {
  readonly store: GlobeStore;
}

/** The product chains over the globe: all of them, or one. */
export function ProductFilter({ store }: ProductFilterProps) {
  const { product, available } = useGlobeState(store);
  if (!available) return null;
  return (
    <div
      role="group"
      aria-label="Product chain"
      className="absolute top-2 left-2 flex max-w-[calc(100%-10rem)] flex-wrap gap-1"
    >
      <button
        type="button"
        className={CONTROL}
        aria-pressed={product === 'all'}
        onClick={() => {
          store.setProduct('all');
        }}
      >
        All
      </button>
      {PRODUCTS.map((one) => (
        <button
          key={one.key}
          type="button"
          className={CONTROL}
          aria-pressed={product === one.key}
          onClick={() => {
            store.setProduct(one.key);
          }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4"
            // External constraint: the hue of a product is a hex that the canvas shares.
            style={{ backgroundColor: one.colour }}
          />
          {one.label}
        </button>
      ))}
    </div>
  );
}
