import { PRODUCT_LINK_TYPES } from '@gab/proposal/relation-types';

export type { ProductKey } from '@gab/proposal/relation-types';

// External constraint: MapLibre parses no oklch colour and no CSS custom property, so each hue of
// a product is in hex. The legend of the page takes the same hex, so it matches the arcs.
/** The product chains of the map, each with the relation type of its physical links. */
export const PRODUCTS = [
  {
    key: 'crude',
    label: 'Crude oil',
    relationType: PRODUCT_LINK_TYPES.crude,
    colour: '#3d2b1f',
  },
  {
    key: 'products',
    label: 'Refined products',
    relationType: PRODUCT_LINK_TYPES.products,
    colour: '#d4462a',
  },
  { key: 'gas', label: 'Gas and LNG', relationType: PRODUCT_LINK_TYPES.gas, colour: '#1f8a8a' },
] as const;
