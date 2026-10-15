/** The product chains of the map. The relation type of a physical link gives its product, because
 * a relation of the release has no attributes. Gas and LNG have no relation type yet: the record
 * gets one when a document supports a gas link, and the chain then has its arcs. */
export const PRODUCTS = [
  { key: 'crude', label: 'Crude oil', relationType: 'crude_flows_to', colour: '#3d2b1f' },
  {
    key: 'products',
    label: 'Refined products',
    relationType: 'products_flow_to',
    colour: '#d4462a',
  },
  { key: 'gas', label: 'Gas and LNG', relationType: null, colour: '#1f8a8a' },
] as const;

export type ProductKey = (typeof PRODUCTS)[number]['key'];
