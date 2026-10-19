import { PRODUCT_LINK_TYPES } from './relation-types.ts';

export type { ProductKey } from './relation-types.ts';

// External constraint: MapLibre parses no oklch colour and no CSS custom property, so each hue of
// a product is in hex, a light one for the dark ground of the map. The filter of the page takes the
// same hex, so it matches the arcs.
/** The product chains of the map, each with the relation type of its physical links. */
export const PRODUCTS = [
  {
    key: 'crude',
    label: 'Crude oil',
    relationType: PRODUCT_LINK_TYPES.crude,
    colour: '#f2b04a',
  },
  {
    key: 'products',
    label: 'Refined products',
    relationType: PRODUCT_LINK_TYPES.products,
    colour: '#ff6b4a',
  },
  { key: 'gas', label: 'Gas and LNG', relationType: PRODUCT_LINK_TYPES.gas, colour: '#3fd0c9' },
] as const;
